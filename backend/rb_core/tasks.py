"""
Celery tasks for async NFT minting and payment processing.
"""

import logging
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

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
        purchase.status = 'payment_processing'
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

                collaborator_payments.append({
                    'user': collab['user'],
                    'wallet_address': collab['wallet'],
                    'amount_usdc': float(usdc_amount),
                    'percentage': float(collab_percentage),
                    'role': collab.get('role', 'collaborator')
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

                collaborator_payments.append({
                    'user': collab['user'],
                    'wallet_address': collab['wallet'],
                    'amount_usdc': float(usdc_amount),
                    'percentage': float(collab_percentage),
                    'role': collab.get('role', 'collaborator')
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

        # TODO: Send notifications
        # notify_buyer_purchase_complete(purchase)
        # notify_creators_payment_received(purchase)

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
            purchase.status = 'payment_failed'
            purchase.usdc_distribution_status = 'failed'
            purchase.save()
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

    logger.info(f"Reconciliation record created: ID {reconciliation.id}")
    logger.info("=" * 80)

    return {
        'reconciliation_id': reconciliation.id,
        'net_to_replenish': float(net_fronted),
        'current_balance': current_balance,
        'runway_days': days_of_runway,
        'health': health_status
    }
