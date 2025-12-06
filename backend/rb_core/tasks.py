"""
Celery tasks for async NFT minting and payment processing.
"""

import logging
from decimal import Decimal

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
        except:
            pass

        return {'success': False, 'error': str(e)}


@shared_task
def mint_and_distribute_circle(purchase_id):
    """
    Celery task: Mint NFT and distribute USDC for Circle payments.

    Circle-specific flow:
    1. Mint NFT to buyer's Solana wallet (get ACTUAL mint gas cost)
    2. Transfer USDC to creator's Solana wallet (get ACTUAL transfer gas cost)
    3. Calculate distribution with ACTUAL Circle fee + gas costs
    4. Update purchase record with final amounts
    5. Update creator sales tracking

    Args:
        purchase_id: Purchase ID to process

    Returns:
        dict: Result with success status and distribution details
    """
    from .views.payment_utils import mint_and_distribute_circle as mint_circle
    return mint_circle(purchase_id)


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


# ========== Circle W3S Tasks ==========

@shared_task
def create_circle_wallet_for_user_task(user_id, email):
    """
    Create Circle user account for a new user (async, non-blocking).

    This creates the Circle user account. The actual wallet will be created
    by the user via frontend SDK when they set their PIN.

    Args:
        user_id: User ID to create Circle account for
        email: User's email address

    Returns:
        dict: Circle user creation result
    """
    from .models import User, UserProfile
    from blockchain.circle_user_controlled_service import (
        get_circle_user_controlled_service,
        CircleUserControlledError
    )

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile

        logger.info(f'[Circle User-Controlled Task] Creating Circle user account for user {user_id} ({user.username})')

        # Create Circle user account (backend step)
        circle_service = get_circle_user_controlled_service()
        user_data = circle_service.create_user_account(user_id, email)

        # Store Circle user ID in profile
        profile.circle_user_id = user_data.get('circle_user_id')
        profile.wallet_provider = 'circle_user_controlled'

        profile.save(update_fields=[
            'circle_user_id',
            'wallet_provider'
        ])

        logger.info(
            f'[Circle User-Controlled Task] ✅ Circle user account created for user {user_id}: '
            f'circle_user_id={user_data.get("circle_user_id")}'
        )

        return {
            'success': True,
            'user_id': user_id,
            'circle_user_id': user_data.get('circle_user_id'),
            'status': user_data.get('status')
        }

    except User.DoesNotExist:
        logger.error(f'[Circle User-Controlled Task] User {user_id} not found')
        return {'success': False, 'error': 'User not found'}

    except CircleUserControlledError as e:
        logger.error(f'[Circle User-Controlled Task] Circle API error for user {user_id}: {e}')
        return {'success': False, 'error': str(e)}

    except Exception as e:
        logger.error(f'[Circle User-Controlled Task] Unexpected error creating Circle user for {user_id}: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@shared_task
def process_purchase_with_circle_w3s_task(purchase_id):
    """
    Process purchase with NFT minting via Circle W3S (Stripe + Circle W3S hybrid).

    Flow:
    1. Verify Stripe payment completed
    2. Mint NFT to buyer's Circle W3S wallet
    3. Mark purchase for USDC distribution (pending weekly conversion)

    Args:
        purchase_id: Purchase ID to process

    Returns:
        dict: Processing result with NFT mint details
    """
    from .models import Purchase, UserProfile
    from blockchain.circle_w3s_service import get_circle_w3s_service, CircleW3SError
    from decimal import Decimal

    try:
        purchase = Purchase.objects.select_for_update().get(id=purchase_id)

        # Verify payment completed
        if purchase.status != 'payment_completed':
            logger.warning(f'[Circle W3S Task] Purchase {purchase_id} not in payment_completed status: {purchase.status}')
            return {'success': False, 'error': 'Payment not completed'}

        purchase.status = 'minting'
        purchase.save()

        logger.info(f'[Circle W3S Task] Processing purchase {purchase_id} for user {purchase.user.username}')

        # Get buyer's Circle W3S wallet
        buyer_profile = purchase.user.profile
        buyer_wallet_address = buyer_profile.circle_wallet_address

        if not buyer_wallet_address:
            logger.error(f'[Circle W3S Task] Buyer {purchase.user.username} has no Circle W3S wallet')
            purchase.status = 'failed'
            purchase.save()
            return {'success': False, 'error': 'Buyer has no Circle W3S wallet'}

        # Prepare NFT metadata
        content = purchase.content
        metadata_uri = ''
        if content.ipfs_hash:
            # Use IPFS hash for metadata if available
            metadata_uri = f'ipfs://{content.ipfs_hash}'
        else:
            # Use Cloudinary teaser link as fallback
            metadata_uri = content.teaser_link or ''

        # Mint NFT via Circle W3S
        circle_service = get_circle_w3s_service()

        reference_id = f'purchase-{purchase.id}'
        nft_result = circle_service.mint_nft_to_wallet(
            wallet_address=buyer_wallet_address,
            metadata_uri=metadata_uri,
            reference_id=reference_id
        )

        # Update purchase with NFT mint details
        purchase.circle_nft_id = nft_result.get('nft_id', '')
        purchase.circle_mint_transaction_id = nft_result.get('id', '')
        purchase.nft_mint_address = nft_result.get('mint_address', '')
        purchase.transaction_signature = nft_result.get('transaction_hash', '')
        purchase.nft_minted = True

        # Estimate gas cost (Circle W3S sponsors gas, so this might be 0)
        purchase.mint_cost = Decimal('0.000')  # Circle W3S Gas Station covers this

        # Calculate USDC amount to distribute (90% of net after Stripe fee)
        net_after_stripe = purchase.net_after_stripe or Decimal('0')
        creator_percentage = Decimal('0.90')
        usdc_amount = net_after_stripe * creator_percentage

        purchase.usdc_amount = usdc_amount
        purchase.usdc_payment_status = 'pending_conversion'  # Awaiting weekly USD → USDC conversion
        purchase.status = 'completed'  # Purchase completed, USDC distribution pending

        purchase.save()

        logger.info(
            f'[Circle W3S Task] ✅ Purchase {purchase_id} processed: '
            f'NFT minted to {buyer_wallet_address}, '
            f'USDC pending: ${usdc_amount} (awaiting conversion)'
        )

        return {
            'success': True,
            'purchase_id': purchase.id,
            'nft_id': purchase.circle_nft_id,
            'mint_address': purchase.nft_mint_address,
            'usdc_amount': str(usdc_amount)
        }

    except Purchase.DoesNotExist:
        logger.error(f'[Circle W3S Task] Purchase {purchase_id} not found')
        return {'success': False, 'error': 'Purchase not found'}

    except CircleW3SError as e:
        logger.error(f'[Circle W3S Task] Circle API error for purchase {purchase_id}: {e}')
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.status = 'failed'
            purchase.save()
        except:
            pass
        return {'success': False, 'error': str(e)}

    except Exception as e:
        logger.error(f'[Circle W3S Task] Unexpected error processing purchase {purchase_id}: {e}', exc_info=True)
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.status = 'failed'
            purchase.save()
        except:
            pass
        return {'success': False, 'error': str(e)}


@shared_task
def distribute_usdc_to_creator_task(purchase_id):
    """
    Distribute USDC to creator's Circle W3S wallet.

    This runs after the weekly USD → USDC conversion is complete.

    Args:
        purchase_id: Purchase ID to distribute USDC for

    Returns:
        dict: Distribution result
    """
    from .models import Purchase, UserProfile, User as CoreUser
    from blockchain.circle_w3s_service import get_circle_w3s_service, CircleW3SError
    from django.utils import timezone

    try:
        purchase = Purchase.objects.select_for_update().get(id=purchase_id)

        # Verify ready for distribution
        if purchase.usdc_payment_status != 'pending_distribution':
            logger.warning(
                f'[USDC Distribution] Purchase {purchase_id} not ready for distribution: '
                f'{purchase.usdc_payment_status}'
            )
            return {'success': False, 'error': 'Not ready for distribution'}

        logger.info(f'[USDC Distribution] Distributing USDC for purchase {purchase_id}')

        # Get creator's Circle W3S wallet
        creator = purchase.content.creator
        core_user, _ = CoreUser.objects.get_or_create(username=creator.username)
        creator_profile, _ = UserProfile.objects.get_or_create(
            user=core_user,
            defaults={'username': creator.username}
        )

        creator_wallet_address = creator_profile.circle_wallet_address

        if not creator_wallet_address:
            logger.error(f'[USDC Distribution] Creator {creator.username} has no Circle W3S wallet')
            purchase.usdc_payment_status = 'failed'
            purchase.save()
            return {'success': False, 'error': 'Creator has no Circle W3S wallet'}

        # Transfer USDC from platform wallet to creator wallet
        circle_service = get_circle_w3s_service()

        transfer_result = circle_service.transfer_usdc(
            from_wallet_id=circle_service.platform_wallet_id,
            to_address=creator_wallet_address,
            amount_usdc=purchase.usdc_amount,
            reference_id=f'purchase-{purchase.id}-distribution'
        )

        # Update purchase with transfer details
        purchase.usdc_transfer_signature = transfer_result.get('transaction_hash', '')
        purchase.usdc_payment_status = 'distributed'
        purchase.usdc_distributed_at = timezone.now()
        purchase.save()

        # Update creator's total sales
        if purchase.usdc_amount:
            creator_profile.total_sales_usd = (creator_profile.total_sales_usd or 0) + float(purchase.usdc_amount)
            creator_profile.save(update_fields=['total_sales_usd'])

        logger.info(
            f'[USDC Distribution] ✅ Distributed ${purchase.usdc_amount} USDC to {creator.username} '
            f'for purchase {purchase_id}'
        )

        return {
            'success': True,
            'purchase_id': purchase.id,
            'creator': creator.username,
            'amount_usdc': str(purchase.usdc_amount),
            'transaction_hash': purchase.usdc_transfer_signature
        }

    except Purchase.DoesNotExist:
        logger.error(f'[USDC Distribution] Purchase {purchase_id} not found')
        return {'success': False, 'error': 'Purchase not found'}

    except CircleW3SError as e:
        logger.error(f'[USDC Distribution] Circle API error for purchase {purchase_id}: {e}')
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.usdc_payment_status = 'failed'
            purchase.save()
        except:
            pass
        return {'success': False, 'error': str(e)}

    except Exception as e:
        logger.error(f'[USDC Distribution] Unexpected error for purchase {purchase_id}: {e}', exc_info=True)
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.usdc_payment_status = 'failed'
            purchase.save()
        except:
            pass
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

        # Calculate fees
        gross_amount = purchase.gross_amount or purchase.purchase_price_usd
        stripe_fee = purchase.stripe_fee or (Decimal('0.029') * gross_amount + Decimal('0.30'))
        net_amount = gross_amount - stripe_fee
        mint_gas_fee = Decimal('0.026')  # Approximate Solana gas fee
        amount_to_distribute = net_amount - mint_gas_fee

        # Update purchase with fee details
        purchase.stripe_fee = stripe_fee
        purchase.net_after_stripe = net_amount
        purchase.mint_cost = mint_gas_fee
        purchase.status = 'payment_processing'
        purchase.usdc_distribution_status = 'processing'
        purchase.save()

        logger.info(
            f'[Atomic Purchase] Amount breakdown: '
            f'Gross=${gross_amount}, Stripe fee=${stripe_fee}, '
            f'Net=${net_amount}, To distribute=${amount_to_distribute}'
        )

        # Get collaborators (chapter has get_collaborators_with_wallets method)
        try:
            collaborators = item.get_collaborators_with_wallets()
        except AttributeError:
            # Fallback for content - use creator wallet
            if not hasattr(item, 'creator') or not item.creator.wallet_address:
                raise ValueError(f'Content/chapter creator has no wallet address')
            collaborators = [{
                'user': item.creator,
                'wallet': item.creator.wallet_address,
                'percentage': 90,
                'role': 'creator'
            }]

        if not collaborators:
            raise ValueError(f'No collaborators found for {item_type} {item.id}')

        # Calculate USDC amounts for each collaborator
        collaborator_payments = []
        total_creator_percentage = 0

        for collab in collaborators:
            usdc_amount = amount_to_distribute * (Decimal(collab['percentage']) / 100)
            collaborator_payments.append({
                'user': collab['user'],
                'wallet_address': collab['wallet'],
                'amount_usdc': float(usdc_amount),
                'percentage': collab['percentage'],
                'role': collab.get('role', 'collaborator')
            })
            total_creator_percentage += collab['percentage']

        # Platform fee (remaining percentage)
        platform_percentage = 100 - total_creator_percentage
        platform_usdc = amount_to_distribute * (Decimal(platform_percentage) / 100)

        logger.info(f'[Atomic Purchase] Collaborators: {len(collaborator_payments)}')
        logger.info(f'[Atomic Purchase] Platform fee: {platform_usdc} USDC ({platform_percentage}%)')
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

        # Get metadata URI (TODO: implement proper metadata storage)
        metadata_uri = f'https://arweave.net/mock_{item_type}_{item.id}'

        result = mint_and_distribute_collaborative_nft(
            buyer_wallet_address=buyer_wallet,
            chapter_metadata_uri=metadata_uri,
            collaborator_payments=collaborator_payments,
            platform_usdc_amount=float(platform_usdc),
            total_usdc_amount=float(amount_to_distribute)
        )

        logger.info(f'[Atomic Purchase] ✅ Atomic transaction completed: {result["transaction_signature"]}')
        logger.info(f'[Atomic Purchase] ✅ NFT minted: {result["nft_mint_address"]}')
        logger.info(f'[Atomic Purchase] ✅ USDC fronted from treasury: {result["platform_usdc_fronted"]}')
        logger.info(f'[Atomic Purchase] ✅ Platform earned: {result["platform_usdc_earned"]}')

        # Update purchase record
        purchase.nft_mint_address = result['nft_mint_address']
        purchase.nft_transaction_signature = result['transaction_signature']
        purchase.transaction_signature = result['transaction_signature']
        purchase.nft_minted = True
        purchase.platform_usdc_fronted = Decimal(str(result['platform_usdc_fronted']))
        purchase.platform_usdc_earned = Decimal(str(result['platform_usdc_earned']))
        purchase.usdc_distribution_transaction = result['transaction_signature']
        purchase.usdc_distribution_status = 'completed'
        purchase.usdc_distributed_at = timezone.now()
        purchase.status = 'completed'
        purchase.distribution_details = {
            'collaborators': result['distributions']
        }
        purchase.save()

        # Create CollaboratorPayment records
        from .models import User as CoreUser
        for dist in result['distributions']:
            # dist['user'] is now a username string, look up the User object
            collaborator_user = CoreUser.objects.get(username=dist['user'])
            CollaboratorPayment.objects.create(
                purchase=purchase,
                collaborator=collaborator_user,
                collaborator_wallet=dist['wallet'],
                amount_usdc=Decimal(str(dist['amount'])),
                percentage=dist['percentage'],
                role=dist.get('role'),
                transaction_signature=result['transaction_signature']
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
        # ═══════════════════════════════════════════════════════════════════
        for dist in result['distributions']:
            try:
                creator_username = dist['user']  # This is now a string, not User object
                usdc_earned = Decimal(str(dist['amount']))

                # Get or create CoreUser and UserProfile
                from .models import User as CoreUser, UserProfile
                core_user, _ = CoreUser.objects.get_or_create(username=creator_username)
                profile, _ = UserProfile.objects.get_or_create(
                    user=core_user,
                    defaults={'username': creator_username}
                )

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
            'usdc_earned': float(result['platform_usdc_earned'])
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
        except:
            pass

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except:
            # Max retries exceeded
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
