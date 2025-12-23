import stripe
import logging
from decimal import Decimal
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from ..models import Content, Chapter, Purchase
from ..utils import calculate_fees
from ..payment_utils import calculate_payment_breakdown

logger = logging.getLogger(__name__)

# Stripe minimum charge is $0.50 USD
STRIPE_MINIMUM_CHARGE = Decimal('0.50')

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class CreateCheckoutSessionView(APIView):
    """
    Create Stripe Checkout session for purchasing content or chapters.

    Supports both legacy Content purchases and new Chapter purchases.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        content_id = request.data.get('content_id')
        chapter_id = request.data.get('chapter_id')

        print(f'[Checkout] Request received: chapter_id={chapter_id}, content_id={content_id}')

        if not content_id and not chapter_id:
            return Response(
                {'error': 'Either content_id or chapter_id is required', 'code': 'MISSING_ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # CRITICAL: Verify user has a wallet address before allowing purchase
                # NFT minting requires a valid Solana wallet
                if not request.user.wallet_address:
                    return Response(
                        {
                            'error': 'You need a Web3Auth wallet to purchase NFTs. Please create one in your profile.',
                            'code': 'NO_WALLET',
                            'action': 'CREATE_WALLET'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Handle chapter purchase
                if chapter_id:
                    try:
                        chapter = Chapter.objects.select_for_update().select_related('book_project__creator').get(id=chapter_id)
                    except Chapter.DoesNotExist:
                        return Response(
                            {'error': 'Chapter not found', 'code': 'CHAPTER_NOT_FOUND'},
                            status=status.HTTP_404_NOT_FOUND
                        )

                    # Check if user already purchased this chapter
                    if Purchase.objects.filter(user=request.user, chapter=chapter, status='completed').exists():
                        return Response(
                            {'error': 'You already own this chapter', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    # Calculate payment breakdown with CC fee pass-through
                    # chapter.price is a DecimalField on the Chapter model
                    chapter_price = chapter.price
                    print(f'[Checkout] Chapter price from model: ${chapter_price}')
                    breakdown = calculate_payment_breakdown(chapter_price)
                    print(f'[Checkout] Fee breakdown: buyer_total=${breakdown["buyer_total"]}, chapter_price=${breakdown["chapter_price"]}')

                    price = breakdown['buyer_total']  # Buyer pays this amount (includes CC fee)
                    item_title = f'{chapter.book_project.title} - Chapter {chapter.order}: {chapter.title}'
                    item_description = (
                        f'By {chapter.book_project.creator.username} | '
                        f'Chapter: ${breakdown["chapter_price"]:.2f} + '
                        f'CC Fee: ${breakdown["credit_card_fee"]:.2f}'
                    )
                    cancel_url = f"{settings.FRONTEND_URL}/chapters/{chapter.id}"

                # Handle content purchase (art, music, film, books, etc.)
                elif content_id:
                    content = Content.objects.select_for_update().get(id=content_id)

                    if content.inventory_status != 'minted':
                        return Response(
                            {'error': 'Content not available for purchase', 'code': 'NOT_MINTED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if content.editions <= 0:
                        return Response(
                            {'error': 'Content is sold out', 'code': 'SOLD_OUT'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if content.is_owned_by(request.user):
                        return Response(
                            {'error': 'You already own this content', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    # Calculate payment breakdown with CC fee pass-through
                    content_price = content.price_usd
                    print(f'[Checkout] Content price from model: ${content_price}')
                    breakdown = calculate_payment_breakdown(content_price)
                    print(f'[Checkout] Fee breakdown: buyer_total=${breakdown["buyer_total"]}, content_price=${breakdown["chapter_price"]}')

                    price = breakdown['buyer_total']  # Buyer pays this amount (includes CC fee)
                    item_title = content.title
                    item_description = (
                        f'By {content.creator.username} | '
                        f'Price: ${breakdown["chapter_price"]:.2f} + '
                        f'CC Fee: ${breakdown["credit_card_fee"]:.2f}'
                    )
                    cancel_url = f"{settings.FRONTEND_URL}/content/{content.id}"

                # Validate minimum charge amount for Stripe
                if Decimal(str(price)) < STRIPE_MINIMUM_CHARGE:
                    return Response(
                        {
                            'error': f'Minimum purchase amount is ${STRIPE_MINIMUM_CHARGE}. Please add more items to your cart.',
                            'code': 'BELOW_MINIMUM',
                            'minimum': str(STRIPE_MINIMUM_CHARGE),
                            'current_total': str(price)
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                logger.info(
                    f'[Checkout] Creating session: '
                    f'chapter_id={chapter_id}, content_id={content_id}, '
                    f'user_id={request.user.id}, price=${price}'
                )

                # Prepare metadata for Stripe session (includes fee breakdown for all purchases)
                session_metadata = {
                    'chapter_id': str(chapter_id) if chapter_id else '',
                    'content_id': str(content_id) if content_id else '',
                    'user_id': str(request.user.id),
                    'item_price': str(breakdown['chapter_price']),
                    'credit_card_fee': str(breakdown['credit_card_fee']),
                    'buyer_total': str(breakdown['buyer_total']),
                }

                # Create Stripe Checkout Session
                try:
                    checkout_session = stripe.checkout.Session.create(
                        payment_method_types=['card'],
                        line_items=[{
                            'price_data': {
                                'currency': 'usd',
                                'product_data': {
                                    'name': item_title,
                                    'description': item_description,
                                },
                                'unit_amount': int(Decimal(str(price)) * 100),  # Convert to cents using Decimal
                            },
                            'quantity': 1,
                        }],
                        mode='payment',
                        success_url=f"{settings.FRONTEND_URL}/purchase/success?session_id={{CHECKOUT_SESSION_ID}}",
                        cancel_url=cancel_url,
                        metadata=session_metadata,
                    )

                    # Create Purchase record with fee breakdown fields (applies to ALL purchases)
                    purchase_data = {
                        'user': request.user,
                        'content': content if content_id else None,
                        'chapter': chapter if chapter_id else None,
                        'purchase_price_usd': price,
                        'gross_amount': price,
                        'stripe_checkout_session_id': checkout_session.id,
                        'status': 'payment_pending',
                        'payment_provider': 'stripe',
                        # Fee breakdown fields (for all purchase types)
                        'chapter_price': breakdown['chapter_price'],  # Reusing field name for item price
                        'credit_card_fee': breakdown['credit_card_fee'],
                        'buyer_total': breakdown['buyer_total'],
                    }

                    print(f'[Checkout] Adding fee breakdown to purchase: item_price={breakdown["chapter_price"]}, cc_fee={breakdown["credit_card_fee"]}, buyer_total={breakdown["buyer_total"]}')

                    purchase = Purchase.objects.create(**purchase_data)

                    print(f'[Checkout] ✅ Purchase #{purchase.id} created with chapter_price={purchase.chapter_price}')

                    # Prepare response
                    response_data = {
                        'checkout_url': checkout_session.url,
                        'session_id': checkout_session.id,
                        'purchase_id': purchase.id
                    }

                    # Add breakdown for chapter purchases
                    if chapter_id:
                        response_data['breakdown'] = breakdown['breakdown_display']

                    return Response(response_data, status=status.HTTP_200_OK)

                except stripe.StripeError as e:
                    logger.error(f'[Checkout] Stripe error: {e}')
                    return Response(
                        {'error': str(e), 'code': 'STRIPE_ERROR'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found', 'code': 'CONTENT_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'[Checkout] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e), 'code': 'INTERNAL_ERROR'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FeeBreakdownView(APIView):
    """
    Calculate and return fee breakdown for a given chapter price.

    Used by frontend to show transparent pricing before purchase.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get fee breakdown for a chapter price."""
        try:
            chapter_price = request.query_params.get('chapter_price')

            if not chapter_price:
                return Response(
                    {'error': 'chapter_price query parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Convert to Decimal
            chapter_price = Decimal(str(chapter_price))

            # Calculate breakdown
            breakdown = calculate_payment_breakdown(chapter_price)

            return Response({
                'breakdown_display': breakdown['breakdown_display'],
                'raw_breakdown': {
                    'chapter_price': str(breakdown['chapter_price']),
                    'credit_card_fee': str(breakdown['credit_card_fee']),
                    'buyer_total': str(breakdown['buyer_total']),
                    'creator_share_90': str(breakdown['creator_share_90']),
                    'platform_share_10': str(breakdown['platform_share_10']),
                }
            }, status=status.HTTP_200_OK)

        except (ValueError, TypeError) as e:
            return Response(
                {'error': f'Invalid chapter_price: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'[FeeBreakdown] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DevProcessPurchaseView(APIView):
    """
    DEVELOPMENT ONLY: Process a pending purchase synchronously.

    This bypasses the Stripe webhook + Celery workflow for local testing.
    DO NOT USE IN PRODUCTION.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Process a purchase immediately (dev mode only)."""
        # Only allow in DEBUG mode
        if not settings.DEBUG:
            return Response(
                {'error': 'This endpoint is only available in DEBUG mode'},
                status=status.HTTP_403_FORBIDDEN
            )

        purchase_id = request.data.get('purchase_id')

        if not purchase_id:
            return Response(
                {'error': 'purchase_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            purchase = Purchase.objects.get(id=purchase_id)

            # Verify this is the user's purchase
            if purchase.user != request.user:
                return Response(
                    {'error': 'Not your purchase'},
                    status=status.HTTP_403_FORBIDDEN
                )

            logger.info(f'[DEV] Processing purchase {purchase_id} synchronously')

            # Simulate webhook: Mark as payment_completed
            purchase.status = 'payment_completed'
            purchase.gross_amount = purchase.purchase_price_usd
            # Calculate realistic Stripe fee (2.9% + $0.30)
            purchase.stripe_fee = (purchase.purchase_price_usd * Decimal('0.029')) + Decimal('0.30')
            purchase.net_after_stripe = purchase.purchase_price_usd - purchase.stripe_fee
            purchase.save()

            logger.info(f'[DEV] Updated purchase {purchase_id} to payment_completed')

            # Run atomic purchase processing synchronously (instead of Celery)
            from ..tasks import process_atomic_purchase

            # Call the task function directly (not .delay())
            try:
                # Import the actual function, not the Celery task
                from ..tasks import process_atomic_purchase as task_func

                # If it's a Celery task, get the underlying function
                if hasattr(task_func, 'run'):
                    result = task_func.run(purchase_id)
                else:
                    # Call directly if not a Celery task
                    result = task_func(purchase_id)

                logger.info(f'[DEV] ✅ Purchase {purchase_id} processed successfully')

                # Refresh purchase to get updated data
                purchase.refresh_from_db()

                return Response({
                    'success': True,
                    'purchase_id': purchase.id,
                    'status': purchase.status,
                    'message': 'Purchase processed successfully (dev mode)'
                }, status=status.HTTP_200_OK)

            except Exception as e:
                logger.error(f'[DEV] ❌ Error processing purchase: {e}', exc_info=True)
                return Response(
                    {'error': f'Processing failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Purchase.DoesNotExist:
            return Response(
                {'error': 'Purchase not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'[DEV] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
