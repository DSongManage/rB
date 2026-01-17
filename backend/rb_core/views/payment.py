"""
Payment Intent API views for the dual payment system.

Provides endpoints for:
- Creating purchase intents
- Selecting payment method
- Processing balance payments
- Checking intent status
"""

import logging
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rb_core.models import (
    Chapter,
    Content,
    Purchase,
    BatchPurchase,
    PurchaseIntent,
    UserBalance,
    Cart,
)
from rb_core.services import get_solana_service

logger = logging.getLogger(__name__)

# Constants
COINBASE_MINIMUM = Decimal('5.00')
INTENT_EXPIRY_MINUTES = 30


class CreatePurchaseIntentView(APIView):
    """
    Create a purchase intent - first step in the new payment flow.

    POST /api/payment/intent/

    Body:
        { "chapter_id": 123 }
        OR { "content_id": 456 }
        OR { "cart": true }

    Response:
    {
        "intent_id": 123,
        "item": { "title": "Chapter 1", "price": "2.99" },
        "total_amount": "2.99",
        "balance": {
            "current": "10.00",
            "display": "$10.00",
            "sufficient": true,
            "after_purchase": "7.01"
        },
        "payment_options": [
            {
                "method": "balance",
                "available": true,
                "label": "Pay with renaissBlock Balance",
                "description": "$10.00 available"
            },
            {
                "method": "coinbase",
                "available": true,
                "label": "Add Funds with Card",
                "description": "Apple Pay, Debit Card",
                "minimum_add": "5.00",
                "explanation": "Add $5.00 to your account..."
            },
            {
                "method": "direct_crypto",
                "available": true,
                "label": "Pay with Crypto Wallet",
                "description": "Phantom, Solflare, etc."
            }
        ],
        "expires_at": "2024-01-15T11:30:00Z"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        chapter_id = request.data.get('chapter_id')
        content_id = request.data.get('content_id')
        is_cart = request.data.get('cart', False)

        # Validate request
        if not any([chapter_id, content_id, is_cart]):
            return Response({
                'error': 'Must specify chapter_id, content_id, or cart=true'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check wallet
        wallet_address = user.wallet_address
        if not wallet_address:
            return Response({
                'error': 'No wallet connected',
                'message': 'Please connect a wallet before making a purchase.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get item details and price
            item_info = self._get_item_info(user, chapter_id, content_id, is_cart)
            if 'error' in item_info:
                return Response(item_info, status=status.HTTP_400_BAD_REQUEST)

            # Get user's current balance
            solana_service = get_solana_service()
            try:
                balance = solana_service.get_cached_balance(user)
            except Exception as e:
                logger.warning(f"Failed to get balance for user {user.id}: {e}")
                balance = Decimal('0')

            # Calculate payment options
            total_amount = item_info['price']
            balance_sufficient = balance >= total_amount
            coinbase_minimum = self._calculate_coinbase_minimum(balance, total_amount)

            # Create purchase intent
            with transaction.atomic():
                intent = PurchaseIntent.objects.create(
                    user=user,
                    chapter_id=chapter_id if chapter_id else None,
                    content_id=content_id if content_id else None,
                    is_cart_purchase=is_cart,
                    cart_snapshot=item_info.get('cart_snapshot'),
                    item_price=total_amount,
                    total_amount=total_amount,
                    user_balance_at_creation=balance,
                    balance_sufficient=balance_sufficient,
                    coinbase_minimum_add=coinbase_minimum,
                    expires_at=timezone.now() + timedelta(minutes=INTENT_EXPIRY_MINUTES),
                )

            # Build response
            after_purchase = balance - total_amount if balance_sufficient else Decimal('0')

            response_data = {
                'intent_id': intent.id,
                'item': {
                    'title': item_info['title'],
                    'price': str(total_amount),
                    'display_price': f"${total_amount:.2f}",
                },
                'total_amount': str(total_amount),
                'display_total': f"${total_amount:.2f}",
                'balance': {
                    'current': str(balance),
                    'display': f"${balance:.2f}",
                    'sufficient': balance_sufficient,
                    'after_purchase': str(after_purchase) if balance_sufficient else None,
                },
                'payment_options': self._build_payment_options(
                    balance, total_amount, coinbase_minimum, balance_sufficient
                ),
                'expires_at': intent.expires_at.isoformat(),
            }

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating purchase intent: {e}")
            return Response({
                'error': 'Failed to create purchase intent',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_item_info(self, user, chapter_id, content_id, is_cart):
        """Get item details and validate ownership."""
        if chapter_id:
            try:
                chapter = Chapter.objects.select_related('content').get(id=chapter_id)
            except Chapter.DoesNotExist:
                return {'error': 'Chapter not found'}

            # Check if already owned
            if chapter.is_owned_by(user):
                return {'error': 'You already own this chapter', 'code': 'ALREADY_OWNED'}

            return {
                'title': chapter.title,
                'price': chapter.price_usd,
                'type': 'chapter',
            }

        elif content_id:
            try:
                content = Content.objects.get(id=content_id)
            except Content.DoesNotExist:
                return {'error': 'Content not found'}

            # Check if already owned
            if content.is_owned_by(user):
                return {'error': 'You already own this content', 'code': 'ALREADY_OWNED'}

            return {
                'title': content.title,
                'price': content.price_usd,
                'type': 'content',
            }

        elif is_cart:
            try:
                cart = Cart.objects.get(user=user)
            except Cart.DoesNotExist:
                return {'error': 'Cart not found or empty'}

            if cart.items.count() == 0:
                return {'error': 'Cart is empty'}

            # Get cart snapshot and total
            cart_items = []
            total = Decimal('0')
            for item in cart.items.all():
                cart_items.append({
                    'chapter_id': item.chapter_id if item.chapter else None,
                    'content_id': item.content_id if item.content else None,
                    'title': item.chapter.title if item.chapter else item.content.title,
                    'price': str(item.chapter.price_usd if item.chapter else item.content.price_usd),
                })
                total += item.chapter.price_usd if item.chapter else item.content.price_usd

            return {
                'title': f"{len(cart_items)} items",
                'price': total,
                'type': 'cart',
                'cart_snapshot': {'items': cart_items},
            }

        return {'error': 'Invalid request'}

    def _calculate_coinbase_minimum(self, balance, total_amount):
        """Calculate minimum amount user must add via Coinbase."""
        needed = total_amount - balance
        if needed <= 0:
            return Decimal('0')
        return max(needed, COINBASE_MINIMUM)

    def _build_payment_options(self, balance, total_amount, coinbase_minimum, balance_sufficient):
        """Build payment options list for the response."""
        options = []

        # Option 1: Pay with Balance (primary if sufficient)
        balance_option = {
            'method': 'balance',
            'available': balance_sufficient,
            'label': 'Pay with renaissBlock Balance',
            'description': f"${balance:.2f} available",
            'primary': balance_sufficient,
        }
        if not balance_sufficient:
            shortfall = total_amount - balance
            balance_option['description'] = f"${balance:.2f} available (need ${shortfall:.2f} more)"
        options.append(balance_option)

        # Option 2: Coinbase Onramp
        remaining_after = coinbase_minimum - (total_amount - balance) if coinbase_minimum > 0 else Decimal('0')
        coinbase_option = {
            'method': 'coinbase',
            'available': True,
            'label': 'Add Funds with Card',
            'description': 'Apple Pay, Debit Card',
            'primary': not balance_sufficient,
            'minimum_add': str(coinbase_minimum),
        }
        if coinbase_minimum > 0:
            coinbase_option['explanation'] = (
                f"Add ${coinbase_minimum:.2f} to your account. "
                f"This covers your ${total_amount:.2f} purchase"
                + (f" and leaves ${remaining_after:.2f} for future purchases." if remaining_after > 0 else ".")
            )
        options.append(coinbase_option)

        # Option 3: Direct Crypto
        options.append({
            'method': 'direct_crypto',
            'available': True,
            'label': 'Pay with Crypto Wallet',
            'description': 'Phantom, Solflare, etc.',
            'primary': False,
        })

        return options


class SelectPaymentMethodView(APIView):
    """
    Select payment method for a purchase intent.

    POST /api/payment/intent/<intent_id>/select/

    Body: { "method": "balance" | "coinbase" | "direct_crypto" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, intent_id):
        user = request.user
        method = request.data.get('method')

        if method not in ['balance', 'coinbase', 'direct_crypto']:
            return Response({
                'error': 'Invalid payment method',
                'valid_methods': ['balance', 'coinbase', 'direct_crypto']
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            intent = PurchaseIntent.objects.get(id=intent_id, user=user)
        except PurchaseIntent.DoesNotExist:
            return Response({
                'error': 'Purchase intent not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if expired
        if intent.is_expired:
            return Response({
                'error': 'Purchase intent has expired',
                'code': 'EXPIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if already completed
        if intent.status in ['completed', 'processing']:
            return Response({
                'error': 'Purchase is already being processed',
                'code': 'ALREADY_PROCESSING'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate balance payment
        if method == 'balance' and not intent.balance_sufficient:
            return Response({
                'error': 'Insufficient balance for this payment method',
                'code': 'INSUFFICIENT_BALANCE'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update intent
        intent.payment_method = method
        intent.status = 'payment_method_selected'
        intent.save()

        return Response({
            'intent_id': intent.id,
            'payment_method': method,
            'status': intent.status,
            'next_step': self._get_next_step(method, intent),
        })

    def _get_next_step(self, method, intent):
        """Return instructions for next step based on payment method."""
        if method == 'balance':
            return {
                'action': 'pay_with_balance',
                'endpoint': f'/api/payment/intent/{intent.id}/pay-with-balance/',
                'description': 'Call this endpoint to execute the balance payment'
            }
        elif method == 'coinbase':
            return {
                'action': 'initiate_coinbase',
                'endpoint': f'/api/coinbase/onramp/{intent.id}/',
                'description': 'Call this endpoint to get Coinbase widget configuration'
            }
        elif method == 'direct_crypto':
            return {
                'action': 'initiate_direct_crypto',
                'endpoint': f'/api/direct-crypto/initiate/{intent.id}/',
                'description': 'Call this endpoint to get payment address and memo'
            }


class PayWithBalanceView(APIView):
    """
    Execute purchase using existing USDC balance with platform-sponsored fees.

    POST /api/payment/intent/<intent_id>/pay-with-balance/

    This initiates a sponsored signing flow where platform pays SOL fees:
    1. Backend builds transaction with platform as fee payer
    2. Returns serialized message for user to sign
    3. User signs with Web3Auth (only as token authority)
    4. User calls /submit/ endpoint with signature
    5. Backend adds platform signature and submits transaction
    6. Backend confirms and creates Purchase
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, intent_id):
        user = request.user

        try:
            intent = PurchaseIntent.objects.get(id=intent_id, user=user)
        except PurchaseIntent.DoesNotExist:
            return Response({
                'error': 'Purchase intent not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Validate intent state
        if intent.is_expired:
            return Response({
                'error': 'Purchase intent has expired'
            }, status=status.HTTP_400_BAD_REQUEST)

        if intent.status in ['completed', 'processing']:
            return Response({
                'error': 'Purchase is already being processed'
            }, status=status.HTTP_400_BAD_REQUEST)

        if intent.payment_method != 'balance':
            return Response({
                'error': 'Payment method not set to balance'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify balance is still sufficient
        solana_service = get_solana_service()
        try:
            current_balance = solana_service.get_cached_balance(user, force_sync=True)
        except Exception as e:
            logger.error(f"Failed to verify balance: {e}")
            return Response({
                'error': 'Failed to verify balance'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if current_balance < intent.total_amount:
            return Response({
                'error': 'Insufficient balance',
                'current_balance': str(current_balance),
                'required': str(intent.total_amount),
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get platform wallet address
        platform_wallet = getattr(settings, 'PLATFORM_USDC_ADDRESS', None)
        if not platform_wallet:
            logger.error("PLATFORM_USDC_ADDRESS not configured")
            return Response({
                'error': 'Platform configuration error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Calculate payment splits (platform fee + collaborator shares)
        transfers = self._calculate_payment_splits(intent, platform_wallet)
        if not transfers:
            return Response({
                'error': 'Failed to calculate payment distribution'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Build sponsored transaction (platform pays fees)
        from rb_core.services.sponsored_transaction_service import get_sponsored_transaction_service
        try:
            sponsored_service = get_sponsored_transaction_service()
            # Use multi-transfer if there are collaborators, single transfer otherwise
            if len(transfers) > 1:
                tx_data = sponsored_service.build_sponsored_multi_transfer(
                    user_wallet=user.wallet_address,
                    transfers=transfers,
                )
            else:
                # Single recipient - use original function
                tx_data = sponsored_service.build_sponsored_usdc_transfer(
                    user_wallet=user.wallet_address,
                    recipient_wallet=transfers[0][0],
                    amount=transfers[0][1],
                )
        except ValueError as e:
            logger.error(f"Platform wallet not configured: {e}")
            return Response({
                'error': 'Platform wallet configuration error',
                'message': 'Please contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Failed to build sponsored transaction: {e}")
            return Response({
                'error': 'Failed to prepare transaction',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Update intent status
        intent.status = 'awaiting_signature'
        intent.save()

        # Return transaction data for client-side signing
        response_data = {
            'intent_id': intent.id,
            'status': 'awaiting_signature',
            'serialized_transaction': tx_data['serialized_transaction'],
            'serialized_message': tx_data['serialized_message'],
            'blockhash': tx_data['blockhash'],
            'platform_pubkey': tx_data['platform_pubkey'],
            'user_pubkey': tx_data['user_pubkey'],
            'amount': tx_data['amount'],
            'instructions': (
                'Sign this transaction with your wallet to authorize the USDC transfer. '
                'The platform will pay the transaction fee for you. '
                'After signing, call the submit endpoint with your signature.'
            ),
            'submit_endpoint': f'/api/payment/intent/{intent.id}/submit/',
        }

        # Add recipient info (single transfer) or num_transfers (multi)
        if 'recipient' in tx_data:
            response_data['recipient'] = tx_data['recipient']
        if 'num_transfers' in tx_data:
            response_data['num_transfers'] = tx_data['num_transfers']
            response_data['transfers'] = [(w, str(a)) for w, a in transfers]

        return Response(response_data)

    def _calculate_payment_splits(self, intent, platform_wallet: str) -> list[tuple[str, Decimal]]:
        """
        Calculate payment distribution for a purchase.

        For collaborative content:
        - Platform receives 10% of total
        - Remaining 90% is split among collaborators by their revenue_percentage

        For non-collaborative content:
        - Platform receives 10%
        - Creator receives 90%

        Returns:
            List of (wallet_address, amount) tuples
        """
        from rb_core.models import CollaboratorRole, CollaborativeProject
        import json

        total_amount = intent.total_amount
        platform_fee_rate = Decimal('0.10')  # 10% platform fee
        creator_pool_rate = Decimal('0.90')  # 90% to creators

        platform_fee = (total_amount * platform_fee_rate).quantize(Decimal('0.000001'))
        creator_pool = total_amount - platform_fee

        transfers = []

        # Check if this is a cart purchase with multiple items
        if intent.is_cart_purchase and intent.cart_snapshot:
            cart_data = intent.cart_snapshot if isinstance(intent.cart_snapshot, dict) else json.loads(intent.cart_snapshot)
            items = cart_data.get('items', [])

            # For simplicity, calculate splits for each item and aggregate
            all_transfers = {}  # wallet -> amount
            all_transfers[platform_wallet] = Decimal('0')

            for item in items:
                content_id = item.get('content_id')
                item_price = Decimal(item.get('price', '0'))
                item_platform_fee = (item_price * platform_fee_rate).quantize(Decimal('0.000001'))
                item_creator_pool = item_price - item_platform_fee

                all_transfers[platform_wallet] += item_platform_fee

                if content_id:
                    # Check for collaborative project
                    try:
                        content = Content.objects.get(id=content_id)
                        collab_project = CollaborativeProject.objects.filter(
                            published_content_id=content_id
                        ).first()

                        if collab_project:
                            # Get collaborator splits
                            collaborators = CollaboratorRole.objects.filter(
                                project=collab_project,
                                status='accepted'
                            ).select_related('user__profile')

                            for collab in collaborators:
                                wallet = collab.user.wallet_address
                                if wallet:
                                    share = (item_creator_pool * Decimal(collab.revenue_percentage) / Decimal('100')).quantize(Decimal('0.000001'))
                                    all_transfers[wallet] = all_transfers.get(wallet, Decimal('0')) + share
                        else:
                            # Non-collaborative - pay the creator
                            creator_wallet = content.creator.wallet_address if hasattr(content, 'creator') else None
                            if creator_wallet:
                                all_transfers[creator_wallet] = all_transfers.get(creator_wallet, Decimal('0')) + item_creator_pool
                            else:
                                # Fallback: add to platform if no creator wallet
                                all_transfers[platform_wallet] += item_creator_pool
                    except Content.DoesNotExist:
                        # Content not found, give to platform
                        all_transfers[platform_wallet] += item_creator_pool
                else:
                    # No content_id, give to platform
                    all_transfers[platform_wallet] += item_creator_pool

            # Convert to list of tuples
            for wallet, amount in all_transfers.items():
                if amount > Decimal('0'):
                    transfers.append((wallet, amount))

        else:
            # Single item purchase
            content_id = None
            content = None

            # Try to find content from cart snapshot or intent
            if intent.cart_snapshot:
                cart_data = intent.cart_snapshot if isinstance(intent.cart_snapshot, dict) else json.loads(intent.cart_snapshot)
                items = cart_data.get('items', [])
                if items:
                    content_id = items[0].get('content_id')

            if content_id:
                try:
                    content = Content.objects.get(id=content_id)
                except Content.DoesNotExist:
                    pass

            # Check for collaborative project
            collab_project = None
            if content_id:
                collab_project = CollaborativeProject.objects.filter(
                    published_content_id=content_id
                ).first()

            if collab_project:
                # Add platform fee
                transfers.append((platform_wallet, platform_fee))

                # Get collaborator splits
                collaborators = CollaboratorRole.objects.filter(
                    project=collab_project,
                    status='accepted'
                ).select_related('user__profile')

                for collab in collaborators:
                    wallet = collab.user.wallet_address
                    if wallet:
                        share = (creator_pool * Decimal(collab.revenue_percentage) / Decimal('100')).quantize(Decimal('0.000001'))
                        if share > Decimal('0'):
                            transfers.append((wallet, share))
                            logger.info(f"Collaborator {collab.user.username}: {collab.revenue_percentage}% = ${share}")

                logger.info(f"Collaborative purchase: {len(transfers)} transfers for content {content_id}")
            else:
                # Non-collaborative content - send everything to platform
                # (platform will distribute later or it's a solo creator)
                transfers.append((platform_wallet, total_amount))
                logger.info(f"Non-collaborative purchase: sending ${total_amount} to platform")

        return transfers


class SubmitSponsoredPaymentView(APIView):
    """
    Submit user-signed transaction for sponsored payment.

    POST /api/payment/intent/<intent_id>/submit/

    Body:
    {
        "signed_transaction": "base64_encoded_transaction_with_user_signature",
        "user_signature_index": 1
    }

    The platform adds its signature (as fee payer) and submits the transaction.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, intent_id):
        user = request.user
        signed_transaction = request.data.get('signed_transaction')
        user_signature_index = request.data.get('user_signature_index')

        if not signed_transaction:
            return Response({
                'error': 'Signed transaction required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if user_signature_index is None:
            return Response({
                'error': 'User signature index required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            intent = PurchaseIntent.objects.get(id=intent_id, user=user)
        except PurchaseIntent.DoesNotExist:
            return Response({
                'error': 'Purchase intent not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if intent.status != 'awaiting_signature':
            return Response({
                'error': 'Intent not in awaiting_signature status',
                'current_status': intent.status
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update status to processing
        intent.status = 'processing'
        intent.save()

        # Submit transaction with platform signature
        from rb_core.services.sponsored_transaction_service import get_sponsored_transaction_service
        try:
            sponsored_service = get_sponsored_transaction_service()
            tx_signature = sponsored_service.submit_user_signed_transaction(
                signed_transaction=signed_transaction,
                user_signature_index=user_signature_index,
            )
        except Exception as e:
            logger.error(f"Failed to submit sponsored transaction: {e}")
            intent.status = 'failed'
            intent.failure_reason = str(e)
            intent.save()
            return Response({
                'error': 'Failed to submit transaction',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Store the signature immediately for recovery purposes
        # This allows frontend to recover if the response doesn't reach them
        intent.solana_tx_signature = tx_signature
        intent.save()

        # Confirm transaction
        try:
            confirmed = sponsored_service.confirm_transaction(tx_signature)
            if not confirmed:
                # Transaction may still confirm, continue with async processing
                logger.warning(f"Transaction {tx_signature} not immediately confirmed")
        except Exception as e:
            logger.error(f"Transaction confirmation check failed: {e}")

        # Update intent status
        intent.status = 'payment_received'
        intent.save()

        # Trigger purchase processing - try async first, fall back to sync
        from rb_core.tasks import process_balance_purchase_task
        purchase_result = None
        try:
            # Try to queue async task (requires Celery broker)
            result = process_balance_purchase_task.delay(intent.id, tx_signature)
            logger.info(f"Queued async purchase processing for intent {intent.id}")
        except Exception as e:
            logger.warning(f"Celery not available, processing synchronously: {e}")
            # Fall back to synchronous processing using .apply()
            try:
                # Use apply() with throw=False to run sync without raising broker errors
                sync_result = process_balance_purchase_task.apply(
                    args=[intent.id, tx_signature],
                    throw=False
                )
                if sync_result.successful():
                    purchase_result = sync_result.result
                    logger.info(f"Synchronous purchase processing completed: {purchase_result}")
                else:
                    logger.error(f"Synchronous purchase processing failed: {sync_result.result}")
            except Exception as sync_error:
                logger.error(f"Synchronous purchase processing failed: {sync_error}")
                # Don't fail the request - payment was received, purchase will be created later

        return Response({
            'intent_id': intent.id,
            'status': 'processing',
            'message': 'Payment submitted. Your purchase is being processed.',
            'signature': tx_signature,
        })


class ConfirmBalancePaymentView(APIView):
    """
    Legacy endpoint for confirming balance payments.
    Kept for backward compatibility - redirects to new flow.

    POST /api/payment/intent/<intent_id>/confirm/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, intent_id):
        return Response({
            'error': 'This endpoint is deprecated',
            'message': 'Please use the new sponsored payment flow via /pay-with-balance/ and /submit/',
        }, status=status.HTTP_400_BAD_REQUEST)


class PurchaseIntentStatusView(APIView):
    """
    Get status of a purchase intent.

    GET /api/payment/intent/<intent_id>/status/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, intent_id):
        user = request.user

        try:
            intent = PurchaseIntent.objects.get(id=intent_id, user=user)
        except PurchaseIntent.DoesNotExist:
            return Response({
                'error': 'Purchase intent not found'
            }, status=status.HTTP_404_NOT_FOUND)

        response_data = {
            'intent_id': intent.id,
            'status': intent.status,
            'payment_method': intent.payment_method,
            'item': intent.get_item_display(),
            'total_amount': str(intent.total_amount),
            'created_at': intent.created_at.isoformat(),
            'expires_at': intent.expires_at.isoformat(),
            'is_expired': intent.is_expired,
        }

        # Include transaction signature if available (for recovery after network errors)
        if intent.solana_tx_signature:
            response_data['solana_tx_signature'] = intent.solana_tx_signature

        # Include purchase info if completed
        if intent.status == 'completed':
            if intent.purchase:
                response_data['purchase_id'] = intent.purchase.id
                response_data['nft_mint_address'] = intent.purchase.nft_mint_address
            elif intent.batch_purchase:
                response_data['batch_purchase_id'] = intent.batch_purchase.id

        # Include error if failed
        if intent.status == 'failed':
            response_data['failure_reason'] = intent.failure_reason

        return Response(response_data)
