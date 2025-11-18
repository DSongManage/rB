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
