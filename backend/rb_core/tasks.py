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
    Create Circle W3S wallet for a new user (async, non-blocking).

    This runs as a background task during signup so wallet creation doesn't block the signup response.

    Args:
        user_id: User ID to create wallet for
        email: User's email address

    Returns:
        dict: Wallet creation result
    """
    from .models import User, UserProfile
    from blockchain.circle_w3s_service import get_circle_w3s_service, CircleW3SError

    try:
        user = User.objects.get(id=user_id)
        profile = user.profile

        logger.info(f'[Circle W3S Task] Creating wallet for user {user_id} ({user.username})')

        # Create Circle W3S wallet
        circle_service = get_circle_w3s_service()
        wallet_data = circle_service.create_user_wallet(user_id, email)

        # Update profile with wallet info
        profile.circle_wallet_id = wallet_data.get('wallet_id')
        profile.circle_wallet_address = wallet_data.get('address')
        profile.wallet_provider = 'circle_w3s'

        # Also update the main wallet_address field for backward compatibility
        if wallet_data.get('address'):
            profile.wallet_address = wallet_data.get('address')

        profile.save(update_fields=[
            'circle_wallet_id',
            'circle_wallet_address',
            'wallet_provider',
            'wallet_address'
        ])

        logger.info(
            f'[Circle W3S Task] ✅ Wallet created for user {user_id}: '
            f'wallet_id={wallet_data.get("wallet_id")}, '
            f'address={wallet_data.get("address")}'
        )

        return {
            'success': True,
            'user_id': user_id,
            'wallet_id': wallet_data.get('wallet_id'),
            'address': wallet_data.get('address')
        }

    except User.DoesNotExist:
        logger.error(f'[Circle W3S Task] User {user_id} not found')
        return {'success': False, 'error': 'User not found'}

    except CircleW3SError as e:
        logger.error(f'[Circle W3S Task] Circle API error for user {user_id}: {e}')
        return {'success': False, 'error': str(e)}

    except Exception as e:
        logger.error(f'[Circle W3S Task] Unexpected error creating wallet for user {user_id}: {e}', exc_info=True)
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
