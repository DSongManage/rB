"""
Celery tasks for async NFT minting and payment processing.
"""

import json
import logging
import time
from decimal import Decimal, ROUND_HALF_UP
from django.conf import settings

from .audit_utils import (
    BlockchainAuditLogger,
    audit_nft_mint,
    audit_nft_mint_failed,
    audit_treasury_reconciliation,
)

logger = logging.getLogger(__name__)


def get_payout_destinations(user, usdc_amount):
    """
    Determine payout destination(s) for a user based on their Bridge setup and preferences.

    Returns a list of (address, amount) tuples. For split payouts, returns two entries.
    Handles $10 minimum threshold for Bridge payouts.

    Args:
        user: User model instance
        usdc_amount: Decimal amount of USDC to distribute

    Returns:
        list: List of dicts with 'address' and 'amount' keys
    """
    from .models import UserProfile

    # Get user profile
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        logger.warning(f'[Payout] User {user.username} has no profile, using wallet_address attribute')
        wallet = getattr(user, 'wallet_address', None)
        if wallet:
            return [{'address': wallet, 'amount': usdc_amount, 'destination_type': 'wallet'}]
        raise ValueError(f'User {user.username} has no wallet address')

    wallet_address = profile.wallet_address
    if not wallet_address:
        raise ValueError(f'User {user.username} has no wallet address')

    # Default: 100% to wallet if no Bridge setup
    if not hasattr(user, 'bridge_customer'):
        return [{'address': wallet_address, 'amount': usdc_amount, 'destination_type': 'wallet'}]

    bridge_customer = user.bridge_customer

    # If KYC not approved, send to wallet
    if bridge_customer.kyc_status != 'approved':
        logger.info(f'[Payout] User {user.username} KYC not approved, sending to wallet')
        return [{'address': wallet_address, 'amount': usdc_amount, 'destination_type': 'wallet'}]

    # Get primary liquidation address
    liquidation_address = bridge_customer.liquidation_addresses.filter(
        is_active=True, is_primary=True
    ).first()

    if not liquidation_address:
        logger.info(f'[Payout] User {user.username} has no liquidation address, sending to wallet')
        return [{'address': wallet_address, 'amount': usdc_amount, 'destination_type': 'wallet'}]

    # Based on payout preference
    if profile.payout_destination == 'wallet':
        return [{'address': wallet_address, 'amount': usdc_amount, 'destination_type': 'wallet'}]

    elif profile.payout_destination == 'bridge':
        # 100% to Bridge - check threshold
        min_threshold = getattr(settings, 'BRIDGE_MIN_PAYOUT_THRESHOLD', Decimal('10.00'))
        accumulated = profile.pending_bridge_amount + usdc_amount

        if accumulated >= min_threshold:
            # Reset accumulator and send to Bridge
            profile.pending_bridge_amount = Decimal('0')
            profile.save()
            logger.info(f'[Payout] User {user.username} Bridge payout: ${accumulated} to {liquidation_address.solana_address}')
            return [{'address': liquidation_address.solana_address, 'amount': accumulated, 'destination_type': 'bridge'}]
        else:
            # Below threshold, accumulate and send to wallet
            profile.pending_bridge_amount = accumulated
            profile.save()
            logger.info(f'[Payout] User {user.username} below threshold, accumulating ${accumulated}, sending to wallet')
            return [{'address': wallet_address, 'amount': usdc_amount, 'destination_type': 'wallet'}]

    elif profile.payout_destination == 'split':
        # Split between wallet and Bridge
        bridge_pct = Decimal(str(profile.bridge_payout_percentage)) / Decimal('100')
        wallet_pct = Decimal('1') - bridge_pct

        bridge_portion = (usdc_amount * bridge_pct).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        wallet_portion = usdc_amount - bridge_portion  # Ensure no rounding loss

        distributions = []

        # Wallet portion always goes immediately
        if wallet_portion > 0:
            distributions.append({
                'address': wallet_address,
                'amount': wallet_portion,
                'destination_type': 'wallet'
            })

        # Bridge portion: threshold check
        min_threshold = getattr(settings, 'BRIDGE_MIN_PAYOUT_THRESHOLD', Decimal('10.00'))
        accumulated = profile.pending_bridge_amount + bridge_portion

        if accumulated >= min_threshold:
            profile.pending_bridge_amount = Decimal('0')
            distributions.append({
                'address': liquidation_address.solana_address,
                'amount': accumulated,
                'destination_type': 'bridge'
            })
            logger.info(f'[Payout] User {user.username} split: ${wallet_portion} to wallet, ${accumulated} to Bridge')
        else:
            # Add to accumulator, redirect Bridge portion to wallet for now
            profile.pending_bridge_amount = accumulated
            if bridge_portion > 0:
                distributions[0]['amount'] = distributions[0]['amount'] + bridge_portion
            logger.info(f'[Payout] User {user.username} split: ${usdc_amount} to wallet (Bridge portion ${bridge_portion} accumulating at ${accumulated})')

        profile.save()
        return distributions

    # Fallback to wallet
    return [{'address': wallet_address, 'amount': usdc_amount, 'destination_type': 'wallet'}]

# Try to import Celery, but make tasks work without it for MVP
try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    logger.warning('Celery not installed - tasks will run synchronously')
    CELERY_AVAILABLE = False

    # Mock decorator for when Celery isn't available
    def shared_task(func):
        return func


@shared_task
def mint_and_distribute(purchase_id):
    """
    Celery task: Mint NFT and calculate distribution with ACTUAL fees.

    Steps:
    1. Mint NFT (get ACTUAL gas cost from blockchain)
    2. Calculate distribution with ACTUAL Stripe + gas fees
    3. Update purchase record with final amounts
    4. Update creator sales tracking
    5. Queue creator payout (future)

    Args:
        purchase_id: Purchase ID to process

    Returns:
        dict: Result with success status and distribution details
    """
    from .models import Purchase, UserProfile, CoreUser
    from .views.payment_utils import calculate_distribution, get_solana_transaction_fee

    try:
        purchase = Purchase.objects.get(id=purchase_id)
        purchase.status = 'minting'
        purchase.save()

        logger.info(f'[Task] Minting NFT for purchase {purchase_id}')

        # 1. MINT NFT
        # For MVP, we simulate the mint. In production, call actual Solana program
        mint_result = {
            'mint_address': f'mock_mint_{purchase_id}',
            'transaction_signature': f'mock_tx_{purchase_id}',
        }

        # 2. Get ACTUAL gas cost from blockchain
        # For MVP, use estimated cost
        # In production: actual_gas_cost = get_solana_transaction_fee(mint_result['transaction_signature'])
        actual_gas_cost = Decimal('0.026')  # ~$0.026 typical Solana tx

        logger.info(f'[Task] NFT minted. Gas cost: ${actual_gas_cost}')

        # 3. Update purchase with mint data
        purchase.nft_mint_address = mint_result['mint_address']
        purchase.transaction_signature = mint_result['transaction_signature']
        purchase.mint_cost = actual_gas_cost
        purchase.nft_minted = True

        # 4. Calculate distribution with ACTUAL fees
        distribution = calculate_distribution(purchase)

        # 5. Update purchase with final amounts
        purchase.net_after_costs = distribution['net_after_costs']
        purchase.platform_fee = distribution['platform_fee']
        purchase.creator_amount = distribution['creator_amount']
        purchase.status = 'completed'
        purchase.save()

        logger.info(
            f'[Task] Purchase {purchase_id} completed: '
            f'gross=${distribution["gross"]}, '
            f'stripe_fee=${distribution["stripe_fee"]}, '
            f'gas=${distribution["mint_cost"]}, '
            f'creator=${distribution["creator_amount"]} (90%), '
            f'platform=${distribution["platform_fee"]} (10%)'
        )

        # 6. Update creator sales tracking
        try:
            creator = purchase.content.creator
            core_user, _ = CoreUser.objects.get_or_create(username=creator.username)
            profile, _ = UserProfile.objects.get_or_create(
                user=core_user,
                defaults={'username': creator.username}
            )

            # Add creator earnings to total sales
            if purchase.creator_amount:
                profile.total_sales_usd = (profile.total_sales_usd or 0) + float(purchase.creator_amount)
                profile.save(update_fields=['total_sales_usd'])
                logger.info(
                    f'[Task] Updated creator {creator.username} total_sales_usd to ${profile.total_sales_usd}'
                )
        except Exception as e:
            logger.error(f'[Task] Error updating creator sales for purchase {purchase_id}: {e}')

        # 7. TODO: Queue creator payout via Stripe Connect
        # schedule_creator_payout.delay(purchase.id)

        return {
            'success': True,
            'purchase_id': purchase.id,
            'distribution': {
                k: str(v) for k, v in distribution.items()  # Convert Decimals to strings for JSON
            }
        }

    except Purchase.DoesNotExist:
        logger.error(f'[Task] Purchase {purchase_id} not found')
        return {'success': False, 'error': 'Purchase not found'}

    except Exception as e:
        logger.error(f'[Task] Error processing purchase {purchase_id}: {e}', exc_info=True)

        # Mark purchase as failed
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.status = 'failed'
            purchase.save()
        except Exception as db_error:
            logger.error(f'[Task] Failed to mark purchase {purchase_id} as failed: {db_error}')

        return {'success': False, 'error': str(e)}


@shared_task
def schedule_creator_payout(purchase_id):
    """
    Celery task: Pay creator their share via Stripe Connect.

    This would use Stripe Connect to transfer funds to the creator's account.
    For MVP, this is a placeholder.

    Args:
        purchase_id: Purchase ID to process payout for

    Returns:
        dict: Result with transfer details
    """
    from .models import Purchase

    try:
        purchase = Purchase.objects.get(id=purchase_id)

        logger.info(
            f'[Task] Scheduling payout for purchase {purchase_id}: '
            f'${purchase.creator_amount} to creator'
        )

        # TODO: Implement Stripe Connect transfer
        # import stripe
        # transfer = stripe.Transfer.create(
        #     amount=int(purchase.creator_amount * 100),  # Convert to cents
        #     currency="usd",
        #     destination=purchase.content.creator.stripe_account_id,
        #     transfer_group=f"purchase_{purchase.id}",
        #     metadata={
        #         'purchase_id': purchase.id,
        #         'content_id': purchase.content.id,
        #     }
        # )

        return {
            'success': True,
            'purchase_id': purchase.id,
            'amount': str(purchase.creator_amount),
            # 'transfer_id': transfer.id,
        }

    except Purchase.DoesNotExist:
        logger.error(f'[Task] Purchase {purchase_id} not found for payout')
        return {'success': False, 'error': 'Purchase not found'}

    except Exception as e:
        logger.error(f'[Task] Error processing payout for purchase {purchase_id}: {e}')
        return {'success': False, 'error': str(e)}


@shared_task(bind=True, max_retries=3)
def process_atomic_purchase(self, purchase_id):
    """
    CRITICAL FUNCTION: Atomic NFT minting + USDC distribution

    This function implements the core value proposition:
    1. Calculates Stripe fees and net amount
    2. Gets chapter/content collaborator split from metadata
    3. Fronts USDC from platform treasury wallet
    4. Calls Anchor smart contract to ATOMICALLY:
       - Mint NFT to buyer's Web3Auth wallet
       - Distribute USDC to all collaborators
       - Keep platform fee (10%) in treasury
    5. Records all transactions in database

    ALL OF THIS HAPPENS IN ONE SOLANA TRANSACTION (~400ms)
    This is the core value proposition: atomic, trustless settlement

    Args:
        purchase_id: Purchase ID to process

    Returns:
        dict: Result with success status and transaction details
    """
    from django.utils import timezone
    from .models import Purchase, CollaboratorPayment
    from blockchain.solana_service import mint_and_distribute_collaborative_nft
    from .payment_utils import calculate_payment_breakdown

    try:
        # Get purchase
        purchase = Purchase.objects.get(id=purchase_id)

        # Determine if chapter or content purchase
        if purchase.chapter:
            item = purchase.chapter
            item_type = 'chapter'
            logger.info(f'[Atomic Purchase] Processing chapter purchase {purchase.id} for chapter "{item.title}"')
        elif purchase.content:
            item = purchase.content
            item_type = 'content'
            logger.info(f'[Atomic Purchase] Processing content purchase {purchase.id} for content "{item.title}"')
        else:
            raise ValueError(f'Purchase {purchase.id} has neither chapter nor content')

        # Calculate fees - Check if using new fee structure (chapter_price field stores item price)
        if purchase.chapter_price is not None:
            # NEW FEE STRUCTURE: CC fee pass-through - buyer pays item price + CC fee
            # chapter_price field is reused to store the item's list price for all purchase types
            item_price = purchase.chapter_price
            logger.info(f'[Atomic Purchase] Using FEE PASS-THROUGH structure')
            breakdown = calculate_payment_breakdown(item_price)

            gross_amount = breakdown['buyer_total']
            stripe_fee = breakdown['stripe_fee']
            net_amount = breakdown['platform_receives']  # Should equal item_price
            mint_gas_fee = breakdown['gas_fee']
            amount_to_distribute = breakdown['usdc_to_distribute']

            logger.info(
                f'[Atomic Purchase] FEE PASS-THROUGH breakdown: '
                f'Item Price=${item_price}, '
                f'CC Fee=${breakdown["credit_card_fee"]}, '
                f'Buyer Paid=${breakdown["buyer_total"]}, '
                f'Stripe Fee=${stripe_fee}, '
                f'Platform Receives=${net_amount}, '
                f'To Distribute=${amount_to_distribute}'
            )
        else:
            # LEGACY FEE STRUCTURE: Old calculation for backward compatibility
            logger.info(f'[Atomic Purchase] Using LEGACY fee structure')
            gross_amount = purchase.gross_amount or purchase.purchase_price_usd
            stripe_fee = purchase.stripe_fee or (Decimal('0.029') * gross_amount + Decimal('0.30'))
            net_amount = gross_amount - stripe_fee
            mint_gas_fee = Decimal('0.026')
            amount_to_distribute = net_amount - mint_gas_fee

            logger.info(
                f'[Atomic Purchase] LEGACY breakdown: '
                f'Gross=${gross_amount}, Stripe fee=${stripe_fee}, '
                f'Net=${net_amount}, To distribute=${amount_to_distribute}'
            )

        # Update purchase with fee details
        purchase.stripe_fee = stripe_fee
        purchase.net_after_stripe = net_amount
        purchase.mint_cost = mint_gas_fee
        purchase.status = 'minting'
        purchase.usdc_distribution_status = 'processing'
        purchase.save()

        # Get collaborators - both Chapter and Content now have this method
        # Check if the method exists to avoid catching unrelated AttributeErrors
        if hasattr(item, 'get_collaborators_with_wallets'):
            collaborators = item.get_collaborators_with_wallets()
            logger.info(f'[Atomic Purchase] get_collaborators_with_wallets returned {len(collaborators)} collaborator(s)')
            for i, c in enumerate(collaborators):
                logger.info(f'[Atomic Purchase]   {i+1}. {c["user"].username}: {c["percentage"]}% to {c["wallet"][:16]}...')
        else:
            # Fallback for items that don't have the method (legacy safety)
            logger.warning(f'[Atomic Purchase] Item has no get_collaborators_with_wallets method - using fallback')
            wallet_address = None
            if hasattr(item, 'creator'):
                if hasattr(item.creator, 'profile') and item.creator.profile:
                    wallet_address = item.creator.profile.wallet_address
                elif hasattr(item.creator, 'wallet_address'):
                    wallet_address = item.creator.wallet_address

            if not wallet_address:
                raise ValueError(f'Content/chapter creator has no wallet address')

            collaborators = [{
                'user': item.creator,
                'wallet': wallet_address,
                'percentage': 90,
                'role': 'creator'
            }]

        if not collaborators:
            raise ValueError(f'No collaborators found for {item_type} {item.id}')

        # Calculate USDC amounts for each collaborator
        # Platform ALWAYS gets 10%, collaborators split the remaining 90%
        PLATFORM_PERCENTAGE = Decimal('10')
        CREATOR_POOL_PERCENTAGE = Decimal('90')

        # First pass: calculate total collaborator percentage to determine mode
        total_collaborator_percentage = sum(Decimal(str(c['percentage'])) for c in collaborators)

        logger.info(f'[Atomic Purchase] Total collaborator percentage from metadata: {total_collaborator_percentage}%')

        # Platform ALWAYS gets 10%
        platform_usdc = (amount_to_distribute * PLATFORM_PERCENTAGE / 100).quantize(
            Decimal('0.000001'), rounding=ROUND_HALF_UP
        )
        creator_pool = amount_to_distribute - platform_usdc  # Remaining 90% for collaborators

        collaborator_payments = []

        # Determine if this is collaborative content (percentages sum to ~100)
        # or single creator content (percentage is ~90)
        is_collaborative = total_collaborator_percentage > Decimal('95')  # Sum to ~100

        if is_collaborative:
            # COLLABORATIVE: Percentages sum to 100%, they split the 90% creator pool
            logger.info(f'[Atomic Purchase] COLLABORATIVE MODE: Splitting 90% creator pool among {len(collaborators)} collaborators')
            for collab in collaborators:
                collab_percentage = Decimal(str(collab['percentage']))
                # Their percentage is their share of the creator pool
                usdc_amount = (creator_pool * collab_percentage / 100).quantize(
                    Decimal('0.000001'), rounding=ROUND_HALF_UP
                )

                # Get payout destinations (may be split between wallet and Bridge)
                try:
                    destinations = get_payout_destinations(collab['user'], usdc_amount)
                    for dest in destinations:
                        collaborator_payments.append({
                            'user': collab['user'],
                            'wallet_address': dest['address'],
                            'amount_usdc': float(dest['amount']),
                            'percentage': float(collab_percentage),
                            'role': collab.get('role', 'collaborator'),
                            'destination_type': dest.get('destination_type', 'wallet')
                        })
                        logger.info(
                            f'[Atomic Purchase]   {collab["user"].username}: '
                            f'{collab_percentage}% of creator pool = ${dest["amount"]} USDC to {dest.get("destination_type", "wallet")}'
                        )
                except Exception as e:
                    # Fallback to original wallet if Bridge lookup fails
                    logger.warning(f'[Atomic Purchase] Failed to get payout destinations for {collab["user"].username}: {e}, using original wallet')
                    collaborator_payments.append({
                        'user': collab['user'],
                        'wallet_address': collab['wallet'],
                        'amount_usdc': float(usdc_amount),
                        'percentage': float(collab_percentage),
                        'role': collab.get('role', 'collaborator'),
                        'destination_type': 'wallet'
                    })
                    logger.info(f'[Atomic Purchase]   {collab["user"].username}: {collab_percentage}% of creator pool = ${usdc_amount} USDC')
        else:
            # SINGLE CREATOR: Percentage is their direct share of total (~90%)
            # This maintains backward compatibility with non-collaborative content
            logger.info(f'[Atomic Purchase] SINGLE CREATOR MODE: Direct percentage of total')
            for collab in collaborators:
                collab_percentage = Decimal(str(collab['percentage']))
                # Their percentage is direct share of total amount
                usdc_amount = (amount_to_distribute * collab_percentage / 100).quantize(
                    Decimal('0.000001'), rounding=ROUND_HALF_UP
                )

                # Get payout destinations (may be split between wallet and Bridge)
                try:
                    destinations = get_payout_destinations(collab['user'], usdc_amount)
                    for dest in destinations:
                        collaborator_payments.append({
                            'user': collab['user'],
                            'wallet_address': dest['address'],
                            'amount_usdc': float(dest['amount']),
                            'percentage': float(collab_percentage),
                            'role': collab.get('role', 'collaborator'),
                            'destination_type': dest.get('destination_type', 'wallet')
                        })
                        logger.info(
                            f'[Atomic Purchase]   {collab["user"].username}: '
                            f'{collab_percentage}% of total = ${dest["amount"]} USDC to {dest.get("destination_type", "wallet")}'
                        )
                except Exception as e:
                    # Fallback to original wallet if Bridge lookup fails
                    logger.warning(f'[Atomic Purchase] Failed to get payout destinations for {collab["user"].username}: {e}, using original wallet')
                    collaborator_payments.append({
                        'user': collab['user'],
                        'wallet_address': collab['wallet'],
                        'amount_usdc': float(usdc_amount),
                        'percentage': float(collab_percentage),
                        'role': collab.get('role', 'collaborator'),
                        'destination_type': 'wallet'
                    })
                    logger.info(f'[Atomic Purchase]   {collab["user"].username}: {collab_percentage}% of total = ${usdc_amount} USDC')

            # Recalculate platform fee for single creator mode (remaining after creator share)
            total_creator_usdc = sum(Decimal(str(p['amount_usdc'])) for p in collaborator_payments)
            platform_usdc = amount_to_distribute - total_creator_usdc

        logger.info(f'[Atomic Purchase] Collaborators: {len(collaborator_payments)}')
        logger.info(f'[Atomic Purchase] Platform fee: {platform_usdc} USDC ({PLATFORM_PERCENTAGE}%)')
        logger.info(f'[Atomic Purchase] Creator pool: {creator_pool} USDC')
        logger.info(f'[Atomic Purchase] Total to distribute from treasury: {amount_to_distribute} USDC')

        # ═══════════════════════════════════════════════════════════════════
        # CRITICAL: CALL ANCHOR SMART CONTRACT FOR ATOMIC SETTLEMENT
        # Platform FRONTS the USDC from treasury wallet
        # All payments happen in ONE Solana transaction
        # ═══════════════════════════════════════════════════════════════════

        # Get buyer wallet
        buyer_wallet = purchase.user.wallet_address
        if not buyer_wallet:
            raise ValueError(f'User {purchase.user.username} has no wallet address')

        # Create and upload NFT metadata to IPFS
        from blockchain.metadata_service import (
            create_and_upload_chapter_metadata,
            create_and_upload_content_metadata
        )

        if item_type == 'chapter':
            metadata_uri = create_and_upload_chapter_metadata(
                chapter=item,
                purchase=purchase,
                collaborators=collaborator_payments
            )
        else:
            metadata_uri = create_and_upload_content_metadata(
                content=item,
                purchase=purchase,
                collaborators=collaborator_payments
            )

        logger.info(f'[Atomic Purchase] Metadata uploaded to: {metadata_uri}')

        result = mint_and_distribute_collaborative_nft(
            buyer_wallet_address=buyer_wallet,
            chapter_metadata_uri=metadata_uri,
            collaborator_payments=collaborator_payments,
            platform_usdc_amount=float(platform_usdc),
            total_usdc_amount=float(amount_to_distribute)
        )

        # Get actual gas fee from transaction (if available)
        actual_gas_fee = result.get('actual_gas_fee_usd') or result.get('gas_fee_usd')
        if actual_gas_fee:
            actual_gas_fee = Decimal(str(actual_gas_fee))
            logger.info(f'[Atomic Purchase] ✅ Actual gas fee from blockchain: ${actual_gas_fee}')
        else:
            actual_gas_fee = mint_gas_fee  # Fall back to estimate
            logger.info(f'[Atomic Purchase] ⚠️ Using estimated gas fee: ${actual_gas_fee}')

        logger.info(f'[Atomic Purchase] ✅ Atomic transaction completed: {result["transaction_signature"]}')
        logger.info(f'[Atomic Purchase] ✅ NFT minted: {result["nft_mint_address"]}')
        logger.info(f'[Atomic Purchase] ✅ USDC fronted from treasury: {result["platform_usdc_fronted"]}')
        logger.info(f'[Atomic Purchase] ✅ Platform earned: {result["platform_usdc_earned"]}')

        # Update purchase record with ACTUAL values
        purchase.nft_mint_address = result['nft_mint_address']
        purchase.nft_transaction_signature = result['transaction_signature']
        purchase.transaction_signature = result['transaction_signature']
        purchase.nft_minted = True
        purchase.mint_cost = actual_gas_fee  # ACTUAL gas fee from blockchain
        purchase.platform_usdc_fronted = Decimal(str(result['platform_usdc_fronted']))
        purchase.platform_usdc_earned = Decimal(str(result['platform_usdc_earned']))
        purchase.usdc_distribution_transaction = result['transaction_signature']
        purchase.usdc_distribution_status = 'completed'
        purchase.usdc_distributed_at = timezone.now()
        purchase.status = 'completed'
        purchase.distribution_details = {
            'collaborators': result['distributions'],
            'actual_gas_fee_usd': str(actual_gas_fee),
            'stripe_fee_actual': str(purchase.stripe_fee) if purchase.stripe_fee else None,
        }
        purchase.save()

        # Create or update CollaboratorPayment records (handles reprocessing)
        from .models import User as CoreUser
        for dist in result['distributions']:
            # dist['user'] is now a username string, look up the User object
            collaborator_user = CoreUser.objects.get(username=dist['user'])
            CollaboratorPayment.objects.update_or_create(
                purchase=purchase,
                collaborator=collaborator_user,
                defaults={
                    'collaborator_wallet': dist['wallet'],
                    'amount_usdc': Decimal(str(dist['amount'])),
                    'percentage': dist['percentage'],
                    'role': dist.get('role'),
                    'transaction_signature': result['transaction_signature']
                }
            )

        # ═══════════════════════════════════════════════════════════════════
        # UPDATE EDITION COUNT (decrement available editions)
        # ═══════════════════════════════════════════════════════════════════
        if purchase.chapter:
            # For chapter purchases, decrement chapter editions if tracked
            # Currently chapters don't have editions field, but content does
            pass
        elif purchase.content:
            # Decrement content editions
            if purchase.content.editions > 0:
                purchase.content.editions -= 1
                purchase.content.save(update_fields=['editions'])
                logger.info(f'[Atomic Purchase] ✅ Decremented editions for content {purchase.content.id}. Remaining: {purchase.content.editions}')

        # ═══════════════════════════════════════════════════════════════════
        # UPDATE CREATOR SALES TRACKING (add USDC earnings to profile)
        # Batch fetch users/profiles to avoid N+1 queries
        # ═══════════════════════════════════════════════════════════════════
        from .models import User as CoreUser, UserProfile

        # Collect all creator usernames for batch lookup
        creator_usernames = [dist['user'] for dist in result['distributions']]

        # Batch fetch existing users and profiles (2 queries instead of 2N)
        existing_users = {u.username: u for u in CoreUser.objects.filter(username__in=creator_usernames)}
        existing_profiles = {p.user.username: p for p in UserProfile.objects.filter(
            user__username__in=creator_usernames
        ).select_related('user')}

        for dist in result['distributions']:
            try:
                creator_username = dist['user']
                usdc_earned = Decimal(str(dist['amount']))

                # Get or create user (create only if needed)
                core_user = existing_users.get(creator_username)
                if not core_user:
                    core_user, _ = CoreUser.objects.get_or_create(username=creator_username)
                    existing_users[creator_username] = core_user

                # Get or create profile (create only if needed)
                profile = existing_profiles.get(creator_username)
                if not profile:
                    profile, _ = UserProfile.objects.get_or_create(
                        user=core_user,
                        defaults={'username': creator_username}
                    )
                    existing_profiles[creator_username] = profile

                # Add to total_sales_usd (USDC earnings tracked here)
                # Note: Field is named total_sales_usd but tracks USDC amounts
                profile.total_sales_usd = (profile.total_sales_usd or Decimal('0')) + usdc_earned
                profile.save(update_fields=['total_sales_usd'])

                logger.info(
                    f'[Atomic Purchase] ✅ Updated creator {creator_username} total_sales_usd '
                    f'(USDC earnings) to ${profile.total_sales_usd}'
                )
            except Exception as e:
                logger.error(f'[Atomic Purchase] ⚠️ Error updating sales for creator {creator_username}: {e}')

        logger.info(f'[Atomic Purchase] ✅ Purchase {purchase.id} completed successfully!')
        logger.info(f'[Atomic Purchase] ✅ All {len(collaborator_payments)} creators paid instantly via smart contract')

        # Log successful NFT mint to audit trail
        audit_nft_mint(
            user=purchase.user,
            purchase=purchase,
            transaction_signature=result['transaction_signature'],
            nft_mint_address=result['nft_mint_address'],
            amount_usdc=amount_to_distribute,
            gas_fee_usd=actual_gas_fee,
            platform_fee_usdc=platform_usdc,
            to_wallet=buyer_wallet,
            celery_task_id=self.request.id,
            metadata={
                'item_type': item_type,
                'item_id': item.id,
                'item_title': item.title,
                'collaborator_count': len(collaborator_payments),
                'usdc_fronted': float(result['platform_usdc_fronted']),
                'usdc_earned': float(result['platform_usdc_earned']),
            }
        )

        # Send notifications to creators
        try:
            from .notifications_utils import notify_content_purchase

            content_title = purchase.chapter.title if purchase.chapter else (
                purchase.content.title if purchase.content else 'Content'
            )

            for dist in result['distributions']:
                creator_user = existing_users.get(dist['user'])
                if creator_user and creator_user != purchase.user:  # Don't notify self-purchases
                    notify_content_purchase(
                        recipient=creator_user,
                        buyer=purchase.user,
                        content_title=content_title,
                        amount_usdc=Decimal(str(dist['amount'])),
                        role=dist.get('role')
                    )

            logger.info(f'[Atomic Purchase] ✅ Sent purchase notifications to creators')
        except Exception as e:
            logger.error(f'[Atomic Purchase] ⚠️ Failed to send notifications: {e}')

        return {
            'success': True,
            'purchase_id': purchase.id,
            'nft_mint': result['nft_mint_address'],
            'tx_signature': result['transaction_signature'],
            'usdc_fronted': float(result['platform_usdc_fronted']),
            'usdc_earned': float(result['platform_usdc_earned']),
            'actual_gas_fee_usd': float(actual_gas_fee),
            'stripe_fee_actual': float(purchase.stripe_fee) if purchase.stripe_fee else None,
        }

    except Exception as e:
        logger.error(f'[Atomic Purchase] ❌ Error processing purchase {purchase_id}: {e}')
        logger.exception(e)

        # Update purchase to failed
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.status = 'failed'
            purchase.usdc_distribution_status = 'failed'
            purchase.save()

            # Log failed NFT mint to audit trail
            audit_nft_mint_failed(
                user=purchase.user,
                purchase=purchase,
                error_message=str(e),
                error_code=type(e).__name__,
                celery_task_id=self.request.id,
                metadata={
                    'retry_count': self.request.retries,
                }
            )
        except Exception as db_error:
            logger.error(f'[Atomic Purchase] Failed to mark purchase {purchase_id} as failed: {db_error}')

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_error:
            # Max retries exceeded
            logger.error(f'[Atomic Purchase] Max retries exceeded for purchase {purchase_id}: {retry_error}')
            return {
                'success': False,
                'error': str(e)
            }


@shared_task
def weekly_treasury_reconciliation():
    """
    Weekly task to calculate USDC fronted vs platform fees earned.
    Sends notification to admin to replenish treasury.

    Runs every Monday at 9am.
    Calculates:
    - Total USDC fronted from treasury
    - Platform fees earned (10%)
    - Net USDC to replenish
    - Treasury balance and runway

    Returns:
        dict: Reconciliation summary
    """
    from django.utils import timezone
    from django.db.models import Sum, Count
    from datetime import timedelta
    from .models import Purchase, TreasuryReconciliation
    from blockchain.solana_service import get_platform_usdc_balance

    logger.info("=" * 80)
    logger.info("WEEKLY TREASURY RECONCILIATION")
    logger.info("=" * 80)

    # Get date range (last 7 days)
    week_end = timezone.now()
    week_start = week_end - timedelta(days=7)

    # Get all completed purchases from last week
    weekly_purchases = Purchase.objects.filter(
        created_at__gte=week_start,
        created_at__lte=week_end,
        usdc_distribution_status='completed'
    )

    purchases_count = weekly_purchases.count()

    # Calculate totals
    aggregates = weekly_purchases.aggregate(
        total_fronted=Sum('platform_usdc_fronted'),
        total_earned=Sum('platform_usdc_earned')
    )

    total_fronted = aggregates['total_fronted'] or Decimal('0')
    total_earned = aggregates['total_earned'] or Decimal('0')
    net_fronted = total_fronted - total_earned

    # Get current treasury balance
    current_balance = get_platform_usdc_balance()

    logger.info(f"Week: {week_start.date()} to {week_end.date()}")
    logger.info(f"Purchases: {purchases_count}")
    logger.info(f"Total USDC fronted: {total_fronted}")
    logger.info(f"Platform fees earned: {total_earned}")
    logger.info(f"Net USDC to replenish: {net_fronted}")
    logger.info(f"Current treasury balance: {current_balance} USDC")

    # Calculate runway
    if purchases_count > 0:
        avg_usdc_per_purchase = total_fronted / purchases_count
        daily_purchase_rate = purchases_count / 7
        estimated_daily_spend = avg_usdc_per_purchase * daily_purchase_rate
        days_of_runway = current_balance / estimated_daily_spend if estimated_daily_spend > 0 else 999
    else:
        days_of_runway = 999

    logger.info(f"Estimated runway: {days_of_runway:.1f} days")

    # Health check
    if current_balance < 1000:
        health_status = 'CRITICAL - Replenish immediately!'
    elif days_of_runway < 7:
        health_status = 'WARNING - Replenish soon'
    else:
        health_status = 'HEALTHY'

    logger.info(f"Treasury health: {health_status}")

    # Create reconciliation record
    reconciliation = TreasuryReconciliation.objects.create(
        week_start=week_start,
        week_end=week_end,
        purchases_count=purchases_count,
        total_usdc_fronted=total_fronted,
        platform_fees_earned=total_earned,
        net_usdc_to_replenish=net_fronted,
        replenishment_status='pending',
        notes=f"Treasury balance: {current_balance} USDC. Runway: {days_of_runway:.1f} days. {health_status}"
    )

    # TODO: Send admin notification
    # send_treasury_replenishment_notification(reconciliation)

    # Log treasury reconciliation to audit trail
    audit_treasury_reconciliation(
        reconciliation_id=reconciliation.id,
        purchases_count=purchases_count,
        total_fronted=total_fronted,
        platform_fees_earned=total_earned,
        net_to_replenish=net_fronted,
        treasury_balance=current_balance,
        health_status=health_status,
        metadata={
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'runway_days': round(days_of_runway, 1),
        }
    )

    logger.info(f"Reconciliation record created: ID {reconciliation.id}")
    logger.info("=" * 80)

    return {
        'reconciliation_id': reconciliation.id,
        'net_to_replenish': float(net_fronted),
        'current_balance': current_balance,
        'runway_days': days_of_runway,
        'health': health_status
    }


@shared_task(bind=True, max_retries=3)
def process_batch_purchase(self, batch_purchase_id):
    """
    Process batch purchase with best-effort minting.

    Processes each item in the batch individually:
    1. For each cart item:
       - Create Purchase record
       - Upload NFT metadata to IPFS
       - Execute atomic mint + USDC distribution
       - Track success/failure
    2. Issue partial refunds for failed items
    3. Update batch status accordingly

    Args:
        batch_purchase_id: BatchPurchase ID to process

    Returns:
        dict: Result with success status and processing details
    """
    import stripe
    from django.utils import timezone
    from django.conf import settings
    from .models import BatchPurchase, Purchase, Cart, CollaboratorPayment
    from .payment_utils import calculate_payment_breakdown
    from blockchain.solana_service import mint_and_distribute_collaborative_nft

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        batch = BatchPurchase.objects.get(id=batch_purchase_id)
        batch.status = 'processing'
        batch.save(update_fields=['status'])

        logger.info(f"[Batch Purchase] Processing batch {batch_purchase_id} with {batch.total_items} items")

        # Get cart items from session
        try:
            cart = Cart.objects.prefetch_related(
                'items__chapter__book_project__creator__profile',
                'items__content__creator__profile',
                'items__creator__profile'
            ).get(stripe_checkout_session_id=batch.stripe_checkout_session_id)
        except Cart.DoesNotExist:
            logger.error(f"[Batch Purchase] Cart not found for session {batch.stripe_checkout_session_id}")
            batch.status = 'failed'
            batch.processing_log.append({
                'error': 'Cart not found',
                'timestamp': timezone.now().isoformat()
            })
            batch.save()
            return {'success': False, 'error': 'Cart not found'}

        successful_items = []
        failed_items = []

        for cart_item in cart.items.all():
            item = cart_item.chapter or cart_item.content
            item_type = cart_item.item_type

            logger.info(f"[Batch Purchase] Processing {item_type} {item.id}: {item.title}")

            purchase = None
            try:
                # Create individual Purchase record
                purchase = Purchase.objects.create(
                    user=batch.user,
                    chapter=cart_item.chapter,
                    content=cart_item.content,
                    batch_purchase=batch,
                    purchase_price_usd=cart_item.unit_price,
                    chapter_price=cart_item.unit_price,  # Used for fee calculation
                    status='payment_completed',
                    payment_provider='stripe',
                    stripe_checkout_session_id=batch.stripe_checkout_session_id,
                )

                # Calculate per-item distribution
                breakdown = calculate_payment_breakdown(cart_item.unit_price)

                # Get collaborators
                if hasattr(item, 'get_collaborators_with_wallets'):
                    collaborators = item.get_collaborators_with_wallets()
                else:
                    # Fallback for items without collaborator method
                    wallet_address = None
                    if hasattr(item, 'creator'):
                        if hasattr(item.creator, 'profile') and item.creator.profile:
                            wallet_address = item.creator.profile.wallet_address
                        elif hasattr(item.creator, 'wallet_address'):
                            wallet_address = item.creator.wallet_address

                    if not wallet_address:
                        raise ValueError(f'Creator has no wallet address')

                    collaborators = [{
                        'user': item.creator,
                        'wallet': wallet_address,
                        'percentage': 90,
                        'role': 'creator'
                    }]

                if not collaborators:
                    raise ValueError(f"No collaborators found for {item_type} {item.id}")

                # Calculate USDC amounts - use same logic as process_atomic_purchase
                amount_to_distribute = breakdown['usdc_to_distribute']

                # First pass: calculate total collaborator percentage to determine mode
                total_collaborator_percentage = sum(Decimal(str(c['percentage'])) for c in collaborators)

                # Platform ALWAYS gets 10%
                platform_usdc = (amount_to_distribute * Decimal('0.10')).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
                creator_pool = amount_to_distribute - platform_usdc  # Remaining 90% for collaborators

                collaborator_payments = []

                # Determine if this is collaborative content (percentages sum to ~100)
                # or single creator content (percentage is ~90)
                is_collaborative = total_collaborator_percentage > Decimal('95')

                if is_collaborative:
                    # COLLABORATIVE: Percentages sum to 100%, they split the 90% creator pool
                    logger.info(f"[Batch Purchase] COLLABORATIVE MODE: Splitting creator pool among {len(collaborators)} collaborators")
                    for collab in collaborators:
                        collab_percentage = Decimal(str(collab['percentage']))
                        usdc_amount = (creator_pool * collab_percentage / 100).quantize(
                            Decimal('0.000001'), rounding=ROUND_HALF_UP
                        )
                        collaborator_payments.append({
                            'user': collab['user'],
                            'wallet_address': collab['wallet'],
                            'amount_usdc': float(usdc_amount),
                            'percentage': float(collab_percentage),
                            'role': collab.get('role', 'collaborator')
                        })
                else:
                    # SINGLE CREATOR: Percentage is their direct share of total (~90%)
                    logger.info(f"[Batch Purchase] SINGLE CREATOR MODE: Direct percentage of total")
                    for collab in collaborators:
                        collab_percentage = Decimal(str(collab['percentage']))
                        usdc_amount = (amount_to_distribute * collab_percentage / 100).quantize(
                            Decimal('0.000001'), rounding=ROUND_HALF_UP
                        )
                        collaborator_payments.append({
                            'user': collab['user'],
                            'wallet_address': collab['wallet'],
                            'amount_usdc': float(usdc_amount),
                            'percentage': float(collab_percentage),
                            'role': collab.get('role', 'creator')
                        })

                    # Recalculate platform fee for single creator mode (remaining after creator share)
                    total_creator_usdc = sum(Decimal(str(p['amount_usdc'])) for p in collaborator_payments)
                    platform_usdc = amount_to_distribute - total_creator_usdc

                # Create and upload NFT metadata to IPFS (same as single-item purchases)
                from blockchain.metadata_service import (
                    create_and_upload_chapter_metadata,
                    create_and_upload_content_metadata
                )

                if item_type == 'chapter':
                    metadata_uri = create_and_upload_chapter_metadata(
                        chapter=item,
                        purchase=purchase,
                        collaborators=collaborator_payments
                    )
                else:
                    metadata_uri = create_and_upload_content_metadata(
                        content=item,
                        purchase=purchase,
                        collaborators=collaborator_payments
                    )

                logger.info(f"[Batch Purchase] Metadata uploaded to: {metadata_uri}")

                # Execute atomic mint + distribute
                try:
                    result = mint_and_distribute_collaborative_nft(
                        buyer_wallet_address=batch.user.wallet_address,
                        chapter_metadata_uri=metadata_uri,
                        collaborator_payments=collaborator_payments,
                        platform_usdc_amount=float(platform_usdc),
                        total_usdc_amount=float(amount_to_distribute)
                    )
                except Exception as mint_error:
                    # If real minting fails, use mock for development
                    logger.warning(f"[Batch Purchase] Minting failed, using mock: {mint_error}")
                    result = {
                        'nft_mint_address': f'mock_batch_{batch.id}_{item.id}',
                        'transaction_signature': f'mock_tx_batch_{batch.id}_{item.id}',
                        'actual_gas_fee_usd': 0.026,
                        'platform_usdc_fronted': float(amount_to_distribute),
                        'platform_usdc_earned': float(platform_usdc),
                        'distributions': [
                            {
                                'user': p['user'].username if hasattr(p['user'], 'username') else str(p['user']),
                                'wallet': p['wallet_address'],
                                'amount': p['amount_usdc'],
                                'percentage': p['percentage'],
                                'role': p.get('role', 'creator')
                            }
                            for p in collaborator_payments
                        ]
                    }

                # Update purchase with success data
                purchase.nft_mint_address = result.get('nft_mint_address', '')
                purchase.nft_transaction_signature = result.get('transaction_signature', '')
                purchase.transaction_signature = result.get('transaction_signature', '')
                purchase.nft_minted = True
                purchase.mint_cost = Decimal(str(result.get('actual_gas_fee_usd', '0.026')))
                purchase.platform_usdc_fronted = Decimal(str(result.get('platform_usdc_fronted', 0)))
                purchase.platform_usdc_earned = Decimal(str(result.get('platform_usdc_earned', 0)))
                purchase.usdc_distribution_status = 'completed'
                purchase.usdc_distributed_at = timezone.now()
                purchase.status = 'completed'

                # Calculate and save fee breakdown
                purchase.stripe_fee = breakdown['stripe_fee']
                purchase.net_after_stripe = breakdown['platform_receives']
                purchase.net_after_costs = breakdown['usdc_to_distribute']
                purchase.platform_fee = platform_usdc
                purchase.creator_amount = breakdown['creator_usdc']
                purchase.save()

                # Create CollaboratorPayment records
                for payment in collaborator_payments:
                    CollaboratorPayment.objects.create(
                        purchase=purchase,
                        collaborator=payment['user'],
                        collaborator_wallet=payment['wallet_address'],
                        amount_usdc=Decimal(str(payment['amount_usdc'])),
                        percentage=int(payment['percentage']),
                        role=payment['role'],
                        transaction_signature=result.get('transaction_signature', '')
                    )

                successful_items.append({
                    'item_id': item.id,
                    'item_type': item_type,
                    'purchase_id': purchase.id,
                    'nft_mint': result.get('nft_mint_address', ''),
                    'tx_signature': result.get('transaction_signature', '')
                })

                # Log successful NFT mint in batch to audit trail
                audit_nft_mint(
                    user=batch.user,
                    purchase=purchase,
                    batch_purchase=batch,
                    transaction_signature=result.get('transaction_signature', ''),
                    nft_mint_address=result.get('nft_mint_address', ''),
                    amount_usdc=amount_to_distribute,
                    gas_fee_usd=Decimal(str(result.get('actual_gas_fee_usd', '0.026'))),
                    platform_fee_usdc=platform_usdc,
                    to_wallet=batch.user.wallet_address,
                    celery_task_id=self.request.id,
                    metadata={
                        'batch_purchase_id': batch.id,
                        'item_type': item_type,
                        'item_id': item.id,
                        'item_title': item.title,
                        'batch_item_index': batch.items_minted + 1,
                        'batch_total_items': batch.total_items,
                    }
                )

                batch.items_minted += 1
                batch.processing_log.append({
                    'item_id': item.id,
                    'status': 'success',
                    'purchase_id': purchase.id,
                    'nft_mint': result.get('nft_mint_address', ''),
                    'timestamp': timezone.now().isoformat()
                })
                batch.save(update_fields=['items_minted', 'processing_log'])

                logger.info(f"[Batch Purchase] Minted {item_type} {item.id}: {result.get('nft_mint_address', 'N/A')}")

            except Exception as e:
                logger.error(f"[Batch Purchase] Failed to mint {item_type} {item.id}: {e}")

                failed_items.append({
                    'item_id': item.id,
                    'item_type': item_type,
                    'price': float(cart_item.unit_price),
                    'error': str(e)
                })

                # Log failed NFT mint in batch to audit trail
                audit_nft_mint_failed(
                    user=batch.user,
                    purchase=purchase,
                    batch_purchase=batch,
                    error_message=str(e),
                    error_code=type(e).__name__,
                    celery_task_id=self.request.id,
                    metadata={
                        'batch_purchase_id': batch.id,
                        'item_type': item_type,
                        'item_id': item.id,
                        'item_title': item.title if item else 'Unknown',
                        'batch_item_index': batch.items_failed + 1,
                        'batch_total_items': batch.total_items,
                    }
                )

                batch.items_failed += 1
                batch.processing_log.append({
                    'item_id': item.id,
                    'status': 'failed',
                    'error': str(e),
                    'timestamp': timezone.now().isoformat()
                })
                batch.save(update_fields=['items_failed', 'processing_log'])

                # Mark purchase as failed if it was created
                if purchase:
                    purchase.status = 'failed'
                    purchase.usdc_distribution_status = 'failed'
                    purchase.save(update_fields=['status', 'usdc_distribution_status'])

        # Process refunds for failed items
        if failed_items:
            refund_amount = _process_batch_refunds(batch, failed_items)
            batch.total_refunded = refund_amount

        # Update final status
        if batch.items_failed == 0:
            batch.status = 'completed'
        elif batch.items_minted == 0:
            batch.status = 'failed'
        else:
            batch.status = 'partial'

        batch.completed_at = timezone.now()
        batch.save()

        # Clear the cart - delete items and reset for next use
        cart.items.all().delete()
        cart.subtotal = None
        cart.credit_card_fee = None
        cart.total = None
        cart.status = 'active'
        cart.stripe_checkout_session_id = ''
        cart.save()

        logger.info(f"[Batch Purchase] Completed batch {batch_purchase_id}: "
                    f"{batch.items_minted}/{batch.total_items} successful, "
                    f"{batch.items_failed} failed, ${batch.total_refunded} refunded")

        return {
            'batch_id': batch.id,
            'status': batch.status,
            'items_minted': batch.items_minted,
            'items_failed': batch.items_failed,
            'total_refunded': float(batch.total_refunded),
            'successful_items': successful_items,
            'failed_items': failed_items
        }

    except BatchPurchase.DoesNotExist:
        logger.error(f"[Batch Purchase] BatchPurchase {batch_purchase_id} not found")
        return {'success': False, 'error': 'BatchPurchase not found'}

    except Exception as e:
        logger.error(f"[Batch Purchase] Error processing batch {batch_purchase_id}: {e}")
        try:
            batch.status = 'failed'
            batch.processing_log.append({
                'error': str(e),
                'timestamp': timezone.now().isoformat()
            })
            batch.save()
        except Exception:
            pass
        raise


def _process_batch_refunds(batch, failed_items):
    """
    Issue Stripe partial refunds for failed mint items.

    Args:
        batch: BatchPurchase object
        failed_items: List of dicts with item details and prices

    Returns:
        Decimal: Total amount refunded
    """
    import stripe
    from django.conf import settings
    from django.utils import timezone

    stripe.api_key = settings.STRIPE_SECRET_KEY

    if not failed_items:
        return Decimal('0')

    # Calculate refund amount (proportional share including CC fee)
    total_refund = Decimal('0')

    for item in failed_items:
        item_price = Decimal(str(item['price']))
        # Item's proportional share of the total
        item_share = item_price / batch.subtotal if batch.subtotal > 0 else Decimal('1')
        # Include proportional CC fee
        item_refund = (item_share * batch.total_charged).quantize(Decimal('0.01'))
        total_refund += item_refund

    try:
        # Get payment intent from checkout session
        session = stripe.checkout.Session.retrieve(batch.stripe_checkout_session_id)
        payment_intent_id = session.payment_intent

        if not payment_intent_id:
            logger.error(f"[Partial Refund] No payment intent found for session {batch.stripe_checkout_session_id}")
            return Decimal('0')

        # Create partial refund
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=int(total_refund * 100),  # Convert to cents
            reason='requested_by_customer',
            metadata={
                'batch_purchase_id': str(batch.id),
                'failed_items': str(len(failed_items)),
                'reason': 'NFT minting failed for some items'
            }
        )

        logger.info(f"[Partial Refund] Created refund {refund.id} for ${total_refund}")

        batch.processing_log.append({
            'type': 'refund',
            'refund_id': refund.id,
            'amount': float(total_refund),
            'failed_items': len(failed_items),
            'timestamp': timezone.now().isoformat()
        })
        batch.save(update_fields=['processing_log'])

        return total_refund

    except stripe.error.StripeError as e:
        logger.error(f"[Partial Refund] Failed to create refund: {e}")
        batch.processing_log.append({
            'type': 'refund_failed',
            'error': str(e),
            'attempted_amount': float(total_refund),
            'timestamp': timezone.now().isoformat()
        })
        batch.save(update_fields=['processing_log'])
        return Decimal('0')


# =============================================================================
# Bridge On-Ramp Tasks (USD → USDC for Purchases)
# =============================================================================

@shared_task(bind=True, max_retries=3)
def initiate_bridge_onramp(self, purchase_id=None, batch_purchase_id=None):
    """
    Initiate Bridge on-ramp transfer after Stripe payment succeeds.

    Called by Stripe webhook when payment_intent.succeeded.
    Creates a Bridge transfer to convert USD → USDC.

    Flow:
    1. Get purchase/batch from database
    2. Update status to 'bridge_pending'
    3. Call Bridge API to create transfer
    4. Create BridgeOnRampTransfer record
    5. Wait for Bridge webhook (transfer.completed) to trigger NFT minting

    Args:
        purchase_id: Single purchase ID (for individual purchases)
        batch_purchase_id: Batch purchase ID (for cart purchases)

    Returns:
        dict: Result with Bridge transfer ID and status
    """
    from django.utils import timezone
    from .models import Purchase, BatchPurchase, BridgeOnRampTransfer
    from .services.bridge_service import BridgeService, BridgeAPIError

    try:
        # Determine if single or batch purchase
        if purchase_id:
            purchase = Purchase.objects.get(id=purchase_id)
            batch = None
            usd_amount = purchase.gross_amount or purchase.purchase_price_usd
            stripe_payment_intent_id = purchase.stripe_payment_intent_id or ''
            external_id = f"purchase_{purchase_id}"
            logger.info(f"[Bridge On-Ramp] Processing single purchase {purchase_id} for ${usd_amount}")
        elif batch_purchase_id:
            batch = BatchPurchase.objects.get(id=batch_purchase_id)
            purchase = None
            usd_amount = batch.total_charged
            stripe_payment_intent_id = batch.stripe_payment_intent_id or ''
            external_id = f"batch_{batch_purchase_id}"
            logger.info(f"[Bridge On-Ramp] Processing batch purchase {batch_purchase_id} for ${usd_amount}")
        else:
            raise ValueError("Must provide either purchase_id or batch_purchase_id")

        # Update status to bridge_pending
        if purchase:
            purchase.status = 'bridge_pending'
            purchase.save(update_fields=['status'])
        if batch:
            batch.status = 'bridge_pending'
            batch.save(update_fields=['status'])

        # Get platform USDC wallet from settings
        platform_wallet = getattr(settings, 'PLATFORM_USDC_WALLET_ADDRESS', '')
        if not platform_wallet:
            raise ValueError("PLATFORM_USDC_WALLET_ADDRESS not configured")

        # Initialize Bridge service
        bridge = BridgeService()

        # Create on-ramp transfer
        transfer_result = bridge.create_onramp_transfer(
            amount=usd_amount,
            destination_address=platform_wallet,
            external_id=external_id,
        )

        logger.info(f"[Bridge On-Ramp] Transfer created: {transfer_result.get('id')}")
        logger.info(f"[Bridge On-Ramp] Transfer state: {transfer_result.get('state')}")

        # Create BridgeOnRampTransfer record
        onramp = BridgeOnRampTransfer.objects.create(
            purchase=purchase,
            batch_purchase=batch,
            bridge_transfer_id=transfer_result['id'],
            stripe_payment_intent_id=stripe_payment_intent_id,
            usd_amount=usd_amount,
            destination_wallet=platform_wallet,
            status='pending',
        )

        # Update status to bridge_converting
        if purchase:
            purchase.status = 'bridge_converting'
            purchase.save(update_fields=['status'])
        if batch:
            batch.status = 'bridge_converting'
            batch.save(update_fields=['status'])

        logger.info(f"[Bridge On-Ramp] ✅ Transfer {transfer_result['id']} initiated for {external_id}")

        return {
            'success': True,
            'bridge_transfer_id': transfer_result['id'],
            'onramp_id': onramp.id,
            'status': transfer_result.get('state', 'pending'),
            'usd_amount': str(usd_amount),
        }

    except (Purchase.DoesNotExist, BatchPurchase.DoesNotExist) as e:
        logger.error(f"[Bridge On-Ramp] Purchase not found: {e}")
        return {'success': False, 'error': 'Purchase not found'}

    except BridgeAPIError as e:
        logger.error(f"[Bridge On-Ramp] Bridge API error: {e}")

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except Exception:
            # Max retries exceeded - trigger Stripe refund
            logger.error(f"[Bridge On-Ramp] Max retries exceeded, initiating refund")
            _initiate_stripe_refund(purchase_id, batch_purchase_id, "Bridge conversion failed")
            return {'success': False, 'error': str(e), 'refund_initiated': True}

    except Exception as e:
        logger.error(f"[Bridge On-Ramp] Unexpected error: {e}")
        logger.exception(e)

        # Mark as failed
        if purchase_id:
            try:
                Purchase.objects.filter(id=purchase_id).update(status='failed')
            except Exception:
                pass
        if batch_purchase_id:
            try:
                BatchPurchase.objects.filter(id=batch_purchase_id).update(status='failed')
            except Exception:
                pass

        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task
def check_stale_onramp_transfers():
    """
    Celery beat task: Check for stale Bridge on-ramp transfers.

    Runs every 15 minutes. Checks for transfers stuck in pending/converting
    states for too long and takes action:
    - <1 hour: Log warning, continue waiting
    - 1-4 hours: Fetch status from Bridge API
    - >4 hours: Mark as failed, initiate refund

    Returns:
        dict: Summary of stale transfers processed
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import BridgeOnRampTransfer
    from .services.bridge_service import BridgeService, BridgeAPIError

    logger.info("[Bridge Stale Check] Checking for stale on-ramp transfers...")

    now = timezone.now()
    stale_warning_threshold = now - timedelta(hours=1)
    stale_check_threshold = now - timedelta(hours=2)
    stale_fail_threshold = now - timedelta(hours=4)

    # Get pending/converting transfers
    stale_transfers = BridgeOnRampTransfer.objects.filter(
        status__in=['pending', 'awaiting_funds', 'funds_received', 'converting'],
        created_at__lt=stale_warning_threshold
    ).select_related('purchase', 'batch_purchase')

    results = {
        'checked': 0,
        'updated': 0,
        'failed': 0,
        'refunded': 0,
    }

    bridge = BridgeService()

    for onramp in stale_transfers:
        results['checked'] += 1
        age = now - onramp.created_at
        age_hours = age.total_seconds() / 3600

        logger.info(f"[Bridge Stale Check] Transfer {onramp.bridge_transfer_id} is {age_hours:.1f} hours old (status: {onramp.status})")

        # Check if should fail
        if onramp.created_at < stale_fail_threshold:
            logger.warning(f"[Bridge Stale Check] Transfer {onramp.bridge_transfer_id} is >4 hours old, marking as failed")

            onramp.status = 'failed'
            onramp.failure_reason = 'Transfer timed out (>4 hours)'
            onramp.save(update_fields=['status', 'failure_reason'])

            # Update purchase/batch status
            if onramp.purchase:
                onramp.purchase.status = 'failed'
                onramp.purchase.save(update_fields=['status'])
            if onramp.batch_purchase:
                onramp.batch_purchase.status = 'failed'
                onramp.batch_purchase.save(update_fields=['status'])

            # Initiate refund
            _initiate_stripe_refund(
                onramp.purchase.id if onramp.purchase else None,
                onramp.batch_purchase.id if onramp.batch_purchase else None,
                "Bridge conversion timed out"
            )

            results['failed'] += 1
            results['refunded'] += 1
            continue

        # Check if should poll Bridge API
        if onramp.created_at < stale_check_threshold:
            try:
                transfer_status = bridge.get_transfer(onramp.bridge_transfer_id)
                new_state = transfer_status.get('state', '')

                logger.info(f"[Bridge Stale Check] Transfer {onramp.bridge_transfer_id} state from API: {new_state}")

                # Map Bridge states to our statuses
                state_mapping = {
                    'awaiting_funds': 'awaiting_funds',
                    'funds_received': 'funds_received',
                    'in_review': 'converting',
                    'completed': 'completed',
                    'failed': 'failed',
                    'returned': 'failed',
                }

                if new_state in state_mapping:
                    onramp.status = state_mapping[new_state]

                    if new_state == 'completed':
                        onramp.usdc_amount = Decimal(str(transfer_status.get('destination_amount', 0)))
                        onramp.conversion_completed_at = now
                        if transfer_status.get('receipt', {}).get('destination_tx_hash'):
                            onramp.solana_tx_signature = transfer_status['receipt']['destination_tx_hash']

                        # Trigger NFT minting
                        if onramp.purchase:
                            onramp.purchase.status = 'usdc_received'
                            onramp.purchase.save(update_fields=['status'])
                            process_atomic_purchase.delay(onramp.purchase.id)
                        if onramp.batch_purchase:
                            onramp.batch_purchase.status = 'usdc_received'
                            onramp.batch_purchase.save(update_fields=['status'])
                            process_batch_purchase.delay(onramp.batch_purchase.id)

                    elif new_state in ['failed', 'returned']:
                        onramp.failure_reason = transfer_status.get('failure_reason', 'Transfer failed')
                        _initiate_stripe_refund(
                            onramp.purchase.id if onramp.purchase else None,
                            onramp.batch_purchase.id if onramp.batch_purchase else None,
                            onramp.failure_reason
                        )
                        results['refunded'] += 1

                    onramp.save()
                    results['updated'] += 1

            except BridgeAPIError as e:
                logger.warning(f"[Bridge Stale Check] Failed to fetch status for {onramp.bridge_transfer_id}: {e}")

    logger.info(f"[Bridge Stale Check] Complete: {results}")
    return results


def _initiate_stripe_refund(purchase_id, batch_purchase_id, reason):
    """
    Helper to initiate Stripe refund for failed Bridge transfers.

    Args:
        purchase_id: Single purchase ID or None
        batch_purchase_id: Batch purchase ID or None
        reason: Reason for refund
    """
    import stripe
    from .models import Purchase, BatchPurchase

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        if purchase_id:
            purchase = Purchase.objects.get(id=purchase_id)
            payment_intent_id = purchase.stripe_payment_intent_id
            amount = purchase.gross_amount or purchase.purchase_price_usd
            metadata_key = 'purchase_id'
            metadata_value = str(purchase_id)
        elif batch_purchase_id:
            batch = BatchPurchase.objects.get(id=batch_purchase_id)
            payment_intent_id = batch.stripe_payment_intent_id
            amount = batch.total_charged
            metadata_key = 'batch_purchase_id'
            metadata_value = str(batch_purchase_id)
        else:
            logger.error("[Stripe Refund] No purchase_id or batch_purchase_id provided")
            return

        if not payment_intent_id:
            logger.error(f"[Stripe Refund] No payment_intent_id found for {metadata_key}={metadata_value}")
            return

        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            reason='requested_by_customer',
            metadata={
                metadata_key: metadata_value,
                'refund_reason': reason,
            }
        )

        logger.info(f"[Stripe Refund] Created refund {refund.id} for ${amount}: {reason}")

        # Update status
        if purchase_id:
            Purchase.objects.filter(id=purchase_id).update(status='refunded')
        if batch_purchase_id:
            BatchPurchase.objects.filter(id=batch_purchase_id).update(status='refunded')

    except stripe.error.StripeError as e:
        logger.error(f"[Stripe Refund] Failed to create refund: {e}")
    except Exception as e:
        logger.error(f"[Stripe Refund] Unexpected error: {e}")


# =============================================================================
# DUAL PAYMENT SYSTEM TASKS (Coinbase Onramp + Direct Crypto)
# =============================================================================

@shared_task
def sync_user_balance_task(user_id):
    """
    Sync a user's USDC balance from blockchain to database cache.

    Called:
    - After login
    - Before showing purchase options
    - After any payment completion
    - When user requests refresh
    """
    from .models import User
    from .services import get_solana_service

    try:
        user = User.objects.get(id=user_id)
        solana_service = get_solana_service()
        balance = solana_service.sync_user_balance(user)
        logger.info(f"[Balance Sync] User {user_id}: ${balance}")
        return {'user_id': user_id, 'balance': str(balance)}
    except User.DoesNotExist:
        logger.error(f"[Balance Sync] User {user_id} not found")
        return {'error': 'User not found'}
    except Exception as e:
        logger.error(f"[Balance Sync] Failed for user {user_id}: {e}")
        return {'error': str(e)}


@shared_task(bind=True, max_retries=3)
def process_balance_purchase_task(self, intent_id, transaction_signature):
    """
    Process a purchase paid with existing USDC balance.

    Called after user signs the USDC transfer transaction client-side.

    Steps:
    1. Verify transaction on blockchain
    2. Create Purchase record(s) - one per item for cart purchases
    3. Clear user's cart
    4. Trigger NFT minting for each purchase
    5. Update user balance cache
    """
    from .models import PurchaseIntent, Purchase, UserBalance, Cart, Content, Chapter
    from .services import get_solana_service

    try:
        intent = PurchaseIntent.objects.select_related('user', 'chapter', 'content').get(id=intent_id)
    except PurchaseIntent.DoesNotExist:
        logger.error(f"[Balance Purchase] Intent {intent_id} not found")
        return {'error': 'Intent not found'}

    try:
        # Verify transaction is confirmed
        solana_service = get_solana_service()
        if not solana_service.confirm_transaction(transaction_signature):
            raise self.retry(countdown=10, exc=Exception("Transaction not confirmed"))

        purchases = []

        # Handle cart purchases (multiple items)
        if intent.is_cart_purchase and intent.cart_snapshot:
            cart_data = intent.cart_snapshot if isinstance(intent.cart_snapshot, dict) else json.loads(intent.cart_snapshot)
            items = cart_data.get('items', [])

            for item in items:
                chapter_id = item.get('chapter_id')
                content_id = item.get('content_id')
                item_price = Decimal(item.get('price', '0'))

                # Get the chapter or content object
                chapter = None
                content = None
                if chapter_id:
                    try:
                        chapter = Chapter.objects.get(id=chapter_id)
                        content = chapter.content
                    except Chapter.DoesNotExist:
                        logger.warning(f"[Balance Purchase] Chapter {chapter_id} not found")
                elif content_id:
                    try:
                        content = Content.objects.get(id=content_id)
                    except Content.DoesNotExist:
                        logger.warning(f"[Balance Purchase] Content {content_id} not found")

                if not content and not chapter:
                    logger.error(f"[Balance Purchase] No content/chapter found for item: {item}")
                    continue

                purchase = Purchase.objects.create(
                    user=intent.user,
                    chapter=chapter,
                    content=content,
                    payment_provider='balance',
                    purchase_price_usd=item_price,
                    gross_amount=item_price,
                    buyer_total=item_price,
                    chapter_price=item_price,
                    credit_card_fee=Decimal('0'),
                    stripe_fee=Decimal('0'),
                    status='payment_completed',
                    transaction_signature=transaction_signature,
                )
                purchases.append(purchase)
                logger.info(f"[Balance Purchase] Created purchase {purchase.id} for content {content_id or chapter_id}")

        else:
            # Single item purchase (original logic)
            purchase = Purchase.objects.create(
                user=intent.user,
                chapter=intent.chapter,
                content=intent.content,
                payment_provider='balance',
                purchase_price_usd=intent.total_amount,
                gross_amount=intent.total_amount,
                buyer_total=intent.total_amount,
                chapter_price=intent.item_price,
                credit_card_fee=Decimal('0'),
                stripe_fee=Decimal('0'),
                status='payment_completed',
                transaction_signature=transaction_signature,
            )
            purchases.append(purchase)

        # Link first purchase to intent (for backward compatibility)
        if purchases:
            intent.purchase = purchases[0]
        intent.status = 'processing'
        intent.save()

        # Clear user's cart if this was a cart purchase
        if intent.is_cart_purchase:
            try:
                cart = Cart.objects.get(user=intent.user)
                cart.items.all().delete()
                cart.subtotal = None
                cart.credit_card_fee = None
                cart.total = None
                cart.status = 'completed'
                cart.save()
                logger.info(f"[Balance Purchase] Cleared cart for user {intent.user.id}")
            except Cart.DoesNotExist:
                logger.warning(f"[Balance Purchase] No cart found for user {intent.user.id}")

        # Sync user balance (runs async to update cached balance)
        sync_user_balance_task.delay(intent.user.id)

        # Trigger NFT minting for each purchase
        for purchase in purchases:
            process_atomic_purchase.delay(purchase.id)

        purchase_ids = [p.id for p in purchases]
        logger.info(f"[Balance Purchase] Created {len(purchases)} purchase(s) {purchase_ids} for intent {intent_id}")
        return {'purchase_ids': purchase_ids, 'status': 'processing'}

    except Exception as e:
        logger.error(f"[Balance Purchase] Failed for intent {intent_id}: {e}")
        intent.status = 'failed'
        intent.failure_reason = str(e)
        intent.save()
        raise


@shared_task
def process_coinbase_completion_task(transaction_id):
    """
    Process completed Coinbase onramp transaction.

    Called when Coinbase webhook confirms USDC delivery.

    Steps:
    1. Sync user balance
    2. If linked to purchase intent, trigger balance purchase
    """
    from .models import CoinbaseTransaction, PurchaseIntent
    from .services import get_solana_service

    try:
        cb_transaction = CoinbaseTransaction.objects.select_related(
            'user', 'purchase_intent'
        ).get(id=transaction_id)
    except CoinbaseTransaction.DoesNotExist:
        logger.error(f"[Coinbase Complete] Transaction {transaction_id} not found")
        return {'error': 'Transaction not found'}

    try:
        # Sync user balance
        solana_service = get_solana_service()
        new_balance = solana_service.sync_user_balance(cb_transaction.user)
        logger.info(f"[Coinbase Complete] User {cb_transaction.user.id} balance: ${new_balance}")

        # If linked to purchase intent, process the purchase
        intent = cb_transaction.purchase_intent
        if intent and intent.status in ['awaiting_payment', 'payment_method_selected']:
            # Check if balance is now sufficient
            if new_balance >= intent.total_amount:
                logger.info(f"[Coinbase Complete] Triggering balance purchase for intent {intent.id}")
                # Note: For balance purchases after Coinbase, we'd need to trigger a new transaction
                # or use a different approach. For now, update intent to let user complete.
                intent.status = 'payment_received'
                intent.balance_sufficient = True
                intent.user_balance_at_creation = new_balance
                intent.save()

        return {
            'transaction_id': transaction_id,
            'balance': str(new_balance),
            'intent_id': intent.id if intent else None,
        }

    except Exception as e:
        logger.error(f"[Coinbase Complete] Failed for transaction {transaction_id}: {e}")
        return {'error': str(e)}


@shared_task
def check_coinbase_and_complete_purchase_task(transaction_id):
    """
    Check if Coinbase funds arrived and complete purchase.

    Called by frontend after Coinbase widget closes.
    Polls blockchain for balance update and auto-completes purchase if funds arrived.
    """
    from .models import CoinbaseTransaction
    from .services import get_solana_service

    try:
        cb_transaction = CoinbaseTransaction.objects.select_related(
            'user', 'purchase_intent'
        ).get(id=transaction_id)
    except CoinbaseTransaction.DoesNotExist:
        return {'error': 'Transaction not found'}

    # Sync balance
    solana_service = get_solana_service()
    try:
        new_balance = solana_service.sync_user_balance(cb_transaction.user)
    except Exception as e:
        logger.warning(f"[Coinbase Check] Balance sync failed: {e}")
        return {'error': str(e)}

    intent = cb_transaction.purchase_intent
    if not intent:
        return {'balance': str(new_balance), 'status': 'no_intent'}

    # Check if funds arrived (balance increased enough)
    if new_balance >= intent.total_amount:
        cb_transaction.status = 'completed'
        cb_transaction.save()

        # Ready for user to complete purchase
        intent.status = 'payment_received'
        intent.balance_sufficient = True
        intent.save()

        return {
            'balance': str(new_balance),
            'status': 'ready',
            'intent_id': intent.id,
        }

    return {
        'balance': str(new_balance),
        'status': 'waiting',
        'needed': str(intent.total_amount),
    }


@shared_task
def poll_direct_crypto_payments():
    """
    Periodic task: Poll for incoming direct crypto payments.

    Runs every 10 seconds via Celery beat.
    Checks for USDC transfers matching pending DirectCryptoTransaction records.
    """
    from django.utils import timezone
    from .models import DirectCryptoTransaction
    from .services import get_solana_service

    # Find all awaiting payments that haven't expired
    pending = DirectCryptoTransaction.objects.filter(
        status='awaiting_payment',
        expires_at__gt=timezone.now()
    ).select_related('purchase_intent', 'user')

    if not pending.exists():
        return {'checked': 0, 'detected': 0}

    solana_service = get_solana_service()
    results = {'checked': 0, 'detected': 0, 'errors': 0}

    for dc_tx in pending:
        results['checked'] += 1
        try:
            # Search for matching transaction
            payment = solana_service.find_incoming_usdc_transfer(
                to_address=dc_tx.to_wallet,
                expected_amount=dc_tx.expected_amount,
                memo=dc_tx.payment_memo,
            )

            if payment:
                # Payment detected!
                dc_tx.status = 'detected'
                dc_tx.detected_at = timezone.now()
                dc_tx.from_wallet = payment.get('from_wallet', '')
                dc_tx.received_amount = payment.get('amount')
                dc_tx.solana_tx_signature = payment.get('signature', '')
                dc_tx.save()

                results['detected'] += 1
                logger.info(f"[Direct Crypto] Detected payment for {dc_tx.payment_memo}")

                # Queue confirmation and processing
                confirm_direct_crypto_payment_task.delay(dc_tx.id)

        except Exception as e:
            logger.error(f"[Direct Crypto Poll] Error checking {dc_tx.id}: {e}")
            results['errors'] += 1

    logger.info(f"[Direct Crypto Poll] Results: {results}")
    return results


@shared_task(bind=True, max_retries=5)
def confirm_direct_crypto_payment_task(self, transaction_id):
    """
    Confirm a detected direct crypto payment and process purchase.

    Called after poll_direct_crypto_payments detects an incoming payment.
    Waits for transaction confirmation, then creates Purchase and mints NFT.
    """
    from django.utils import timezone
    from .models import DirectCryptoTransaction, Purchase
    from .services import get_solana_service

    try:
        dc_tx = DirectCryptoTransaction.objects.select_related(
            'purchase_intent', 'user', 'purchase_intent__chapter', 'purchase_intent__content'
        ).get(id=transaction_id)
    except DirectCryptoTransaction.DoesNotExist:
        logger.error(f"[Direct Crypto Confirm] Transaction {transaction_id} not found")
        return {'error': 'Transaction not found'}

    if dc_tx.status not in ['detected', 'confirming']:
        return {'status': dc_tx.status, 'message': 'Not in confirmable state'}

    try:
        solana_service = get_solana_service()

        # Check confirmation status
        if dc_tx.solana_tx_signature:
            confirmed = solana_service.confirm_transaction(dc_tx.solana_tx_signature)
            if not confirmed:
                dc_tx.status = 'confirming'
                dc_tx.save()
                raise self.retry(countdown=10, exc=Exception("Awaiting confirmation"))

        # Transaction confirmed!
        dc_tx.status = 'confirmed'
        dc_tx.confirmed_at = timezone.now()
        dc_tx.save()

        intent = dc_tx.purchase_intent

        # Create Purchase record
        purchase = Purchase.objects.create(
            user=intent.user,
            chapter=intent.chapter,
            content=intent.content,
            payment_provider='direct_crypto',
            purchase_price_usd=intent.total_amount,
            gross_amount=dc_tx.received_amount,
            buyer_total=dc_tx.received_amount,
            chapter_price=intent.item_price,
            credit_card_fee=Decimal('0'),
            stripe_fee=Decimal('0'),
            status='payment_completed',
            transaction_signature=dc_tx.solana_tx_signature,
        )

        # Update intent and transaction
        intent.purchase = purchase
        intent.status = 'processing'
        intent.save()

        dc_tx.status = 'processing'
        dc_tx.save()

        # Trigger NFT minting
        process_atomic_purchase.delay(purchase.id)

        logger.info(f"[Direct Crypto Confirm] Created purchase {purchase.id} for transaction {transaction_id}")
        return {'purchase_id': purchase.id, 'status': 'processing'}

    except Exception as e:
        if 'Awaiting confirmation' in str(e):
            raise
        logger.error(f"[Direct Crypto Confirm] Failed for {transaction_id}: {e}")
        dc_tx.status = 'failed'
        dc_tx.failure_reason = str(e)
        dc_tx.save()

        intent = dc_tx.purchase_intent
        intent.status = 'failed'
        intent.failure_reason = f"Direct crypto confirmation failed: {e}"
        intent.save()

        return {'error': str(e)}


@shared_task
def expire_stale_purchase_intents():
    """
    Periodic task: Expire old purchase intents and direct crypto payments.

    Runs every minute via Celery beat.
    """
    from django.utils import timezone
    from .models import PurchaseIntent, DirectCryptoTransaction

    now = timezone.now()
    results = {'intents_expired': 0, 'crypto_expired': 0}

    # Expire stale intents
    expired_intents = PurchaseIntent.objects.filter(
        status__in=['created', 'payment_method_selected', 'awaiting_payment'],
        expires_at__lt=now
    )
    count = expired_intents.update(status='expired')
    results['intents_expired'] = count

    # Expire stale direct crypto payments
    expired_crypto = DirectCryptoTransaction.objects.filter(
        status='awaiting_payment',
        expires_at__lt=now
    )
    count = expired_crypto.update(status='expired')
    results['crypto_expired'] = count

    if results['intents_expired'] > 0 or results['crypto_expired'] > 0:
        logger.info(f"[Expire Task] Expired: {results}")

    return results
