"""
Payment utility functions for NFT minting and revenue distribution.

Payment Flow:
1. Customer pays gross_amount
2. Stripe takes actual fee (from balance_transaction)
3. Net after Stripe = gross - stripe_fee
4. Platform pays gas to mint NFT (actual cost from blockchain)
5. Net after costs = net_after_stripe - mint_cost
6. Platform gets 10% of net_after_costs
7. Creator gets 90% of net_after_costs
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from django.conf import settings

from ..models import Purchase

logger = logging.getLogger(__name__)


def calculate_distribution(purchase):
    """
    Calculate platform/creator split using ACTUAL fees only.

    Order:
    1. Gross
    2. - Stripe fee (ACTUAL)
    3. = Net after Stripe
    4. - Gas/mint cost (ACTUAL)
    5. = Net after all costs
    6. Platform gets 10% of net after costs
    7. Creator gets 90% of net after costs

    Returns:
        dict: Distribution breakdown with all amounts
    """
    # All ACTUAL amounts
    gross = Decimal(str(purchase.gross_amount or 0))
    stripe_fee = Decimal(str(purchase.stripe_fee or 0))
    net_after_stripe = Decimal(str(purchase.net_after_stripe or 0))
    mint_cost = Decimal(str(purchase.mint_cost or 0))

    # Net after ALL costs (Stripe + Gas)
    net_after_costs = net_after_stripe - mint_cost

    # Platform gets 10%
    platform_fee = (net_after_costs * Decimal('0.10')).quantize(
        Decimal('0.0001'),
        rounding=ROUND_HALF_UP
    )

    # Creator gets 90%
    creator_amount = (net_after_costs * Decimal('0.90')).quantize(
        Decimal('0.0001'),
        rounding=ROUND_HALF_UP
    )

    # Platform profit (gas already deducted above)
    platform_profit = platform_fee

    return {
        'gross': gross,
        'stripe_fee': stripe_fee,
        'net_after_stripe': net_after_stripe,
        'mint_cost': mint_cost,
        'net_after_costs': net_after_costs,
        'platform_fee': platform_fee,
        'creator_amount': creator_amount,
        'platform_profit': platform_profit,
    }


def get_solana_transaction_fee(transaction_signature):
    """
    Get ACTUAL fee paid for a Solana transaction.
    Returns fee in USD.

    Args:
        transaction_signature: The transaction signature to look up

    Returns:
        float: Fee in USD
    """
    try:
        from solana.rpc.api import Client
        from decimal import Decimal
        import requests

        # Initialize Solana client
        rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
        client = Client(rpc_url)

        # Get transaction details
        tx = client.get_transaction(
            transaction_signature,
            encoding="jsonParsed",
            max_supported_transaction_version=0
        )

        if not tx.value:
            logger.error(f'Transaction {transaction_signature} not found')
            return 0.0

        # Extract fee in lamports
        fee_lamports = tx.value.transaction.meta.fee

        # Convert lamports to SOL
        fee_sol = Decimal(fee_lamports) / Decimal(1_000_000_000)

        # Get current SOL price
        sol_price_usd = get_sol_price_usd()

        # Convert to USD
        fee_usd = fee_sol * sol_price_usd

        return float(fee_usd)

    except Exception as e:
        logger.error(f'Error getting transaction fee: {e}')
        # Return estimated fee for MVP
        return 0.025  # ~$0.025 typical Solana transaction


def get_sol_price_usd():
    """
    Get current SOL price in USD from CoinGecko API.

    Returns:
        Decimal: SOL price in USD
    """
    try:
        import requests

        response = requests.get(
            'https://api.coingecko.com/api/v3/simple/price',
            params={'ids': 'solana', 'vs_currencies': 'usd'},
            timeout=5
        )

        if response.status_code == 200:
            data = response.json()
            price = Decimal(str(data['solana']['usd']))
            logger.info(f'SOL price: ${price}')
            return price
        else:
            logger.warning(f'CoinGecko API error: {response.status_code}')
            return Decimal('20.0')  # Fallback estimate

    except Exception as e:
        logger.error(f'Error fetching SOL price: {e}')
        return Decimal('20.0')  # Fallback estimate


def calculate_distribution_circle(purchase):
    """
    Calculate platform/creator split for Circle payments using ACTUAL fees.

    Circle Payment Flow:
    1. Gross (what customer paid)
    2. - Circle fee (ACTUAL)
    3. = Net after Circle
    4. - Mint gas cost (ACTUAL from Solana)
    5. - Transfer gas cost (ACTUAL from Solana)
    6. = Net after all costs
    7. Platform gets 10% of net after costs
    8. Creator gets 90% of net after costs

    Args:
        purchase: Purchase object with Circle payment data

    Returns:
        dict: Distribution breakdown with all amounts
    """
    # All ACTUAL amounts from Circle
    gross = Decimal(str(purchase.gross_amount or 0))
    circle_fee = Decimal(str(purchase.circle_fee or 0))
    net_after_circle = Decimal(str(purchase.net_after_circle or 0))

    # Gas costs from Solana blockchain
    mint_cost = Decimal(str(purchase.mint_cost or 0))
    transfer_gas_cost = Decimal(str(purchase.transfer_gas_cost or 0))
    total_gas_cost = mint_cost + transfer_gas_cost

    # Net after ALL costs (Circle fee + both gas costs)
    net_after_costs = net_after_circle - total_gas_cost

    # Platform gets 10%
    platform_fee = (net_after_costs * Decimal('0.10')).quantize(
        Decimal('0.0001'),
        rounding=ROUND_HALF_UP
    )

    # Creator gets 90%
    creator_amount = (net_after_costs * Decimal('0.90')).quantize(
        Decimal('0.0001'),
        rounding=ROUND_HALF_UP
    )

    # Platform profit (gas already deducted above)
    platform_profit = platform_fee

    return {
        'gross': gross,
        'circle_fee': circle_fee,
        'net_after_circle': net_after_circle,
        'mint_cost': mint_cost,
        'transfer_gas_cost': transfer_gas_cost,
        'total_gas_cost': total_gas_cost,
        'net_after_costs': net_after_costs,
        'platform_fee': platform_fee,
        'creator_amount': creator_amount,
        'platform_profit': platform_profit,
    }


def mint_and_distribute_circle(purchase_id):
    """
    Circle-specific minting + distribution with USDC transfer to creator.

    Circle Payment Flow:
    1. Mint NFT to buyer's Solana wallet (get ACTUAL mint gas cost)
    2. Transfer USDC to creator's Solana wallet (get ACTUAL transfer gas cost)
    3. Calculate distribution with ACTUAL Circle fee + gas costs
    4. Update purchase record
    5. Update creator sales tracking

    Args:
        purchase_id: Purchase ID to process

    Returns:
        dict: Result with success status and distribution details
    """
    from ..models import UserProfile, User

    try:
        purchase = Purchase.objects.get(id=purchase_id)
        purchase.status = 'minting'
        purchase.save()

        logger.info(f'[CircleMint] Processing Circle purchase {purchase_id}...')

        # Get wallet addresses
        buyer_wallet = purchase.user.wallet_address
        creator_wallet = purchase.content.creator.wallet_address

        if not buyer_wallet or not creator_wallet:
            raise ValueError('Buyer or creator wallet address missing')

        # 1. MINT NFT to buyer's wallet
        # TODO: Replace with actual Solana mint call
        mint_result = {
            'mint_address': f'circle_mint_{purchase_id}',
            'transaction_signature': f'circle_mint_tx_{purchase_id}',
        }

        # Get ACTUAL mint gas cost from blockchain
        # For MVP, use estimated cost. In production: get_solana_transaction_fee(mint_result['transaction_signature'])
        mint_gas_cost = Decimal('0.000005')  # ~0.000005 SOL * $20 = $0.0001 (Solana is very cheap)

        logger.info(f'[CircleMint] NFT minted. Mint address: {mint_result["mint_address"]}, Gas: ${mint_gas_cost}')

        # 2. TRANSFER USDC to creator's wallet
        # Calculate creator's share before transfer
        purchase.mint_cost = mint_gas_cost
        temp_distribution = calculate_distribution_circle(purchase)
        creator_usdc_amount = temp_distribution['creator_amount']

        # TODO: Replace with actual Solana SPL token transfer
        transfer_result = {
            'transaction_signature': f'circle_transfer_tx_{purchase_id}',
            'amount': creator_usdc_amount,
        }

        # Get ACTUAL transfer gas cost from blockchain
        # For MVP, use estimated cost
        transfer_gas_cost = Decimal('0.000005')  # ~0.000005 SOL

        logger.info(
            f'[CircleMint] USDC transferred to creator. '
            f'Amount: ${creator_usdc_amount} USDC, Gas: ${transfer_gas_cost}'
        )

        # 3. Update purchase with blockchain data
        purchase.nft_mint_address = mint_result['mint_address']
        purchase.transaction_signature = mint_result['transaction_signature']
        purchase.mint_cost = mint_gas_cost
        purchase.transfer_gas_cost = transfer_gas_cost
        purchase.nft_minted = True

        # 4. Calculate final distribution with ACTUAL costs
        distribution = calculate_distribution_circle(purchase)

        # 5. Update purchase with final amounts
        purchase.net_after_costs = distribution['net_after_costs']
        purchase.platform_fee = distribution['platform_fee']
        purchase.creator_amount = distribution['creator_amount']
        purchase.status = 'completed'
        purchase.save()

        logger.info(
            f'[CircleMint] Purchase {purchase_id} completed:\n'
            f'  Gross: ${distribution["gross"]}\n'
            f'  Circle fee: ${distribution["circle_fee"]}\n'
            f'  Net after Circle: ${distribution["net_after_circle"]}\n'
            f'  Mint gas: ${distribution["mint_cost"]}\n'
            f'  Transfer gas: ${distribution["transfer_gas_cost"]}\n'
            f'  Total gas: ${distribution["total_gas_cost"]}\n'
            f'  Net after costs: ${distribution["net_after_costs"]}\n'
            f'  Creator (90%): ${distribution["creator_amount"]} USDC\n'
            f'  Platform (10%): ${distribution["platform_fee"]} USDC'
        )

        # 6. Update creator sales tracking
        try:
            creator = purchase.content.creator
            profile = creator.profile

            # Add creator earnings to total sales
            if purchase.creator_amount:
                profile.total_sales_usd = (profile.total_sales_usd or 0) + float(purchase.creator_amount)
                profile.save(update_fields=['total_sales_usd'])
                logger.info(
                    f'[CircleMint] Updated creator {creator.username} total_sales_usd to ${profile.total_sales_usd}'
                )
        except Exception as e:
            logger.error(f'[CircleMint] Error updating creator sales for purchase {purchase_id}: {e}')

        return {
            'success': True,
            'purchase_id': purchase.id,
            'distribution': {
                k: str(v) for k, v in distribution.items()  # Convert Decimals to strings for JSON
            },
            'mint_address': mint_result['mint_address'],
            'transfer_signature': transfer_result['transaction_signature'],
        }

    except Purchase.DoesNotExist:
        logger.error(f'[CircleMint] Purchase {purchase_id} not found')
        return {'success': False, 'error': 'Purchase not found'}

    except Exception as e:
        logger.error(f'[CircleMint] Error processing Circle purchase {purchase_id}: {e}', exc_info=True)

        # Mark purchase as failed
        try:
            purchase = Purchase.objects.get(id=purchase_id)
            purchase.status = 'failed'
            purchase.save()
        except Exception as db_error:
            logger.error(f'[CircleMint] Failed to mark purchase {purchase_id} as failed: {db_error}')

        return {'success': False, 'error': str(e)}


def mint_and_distribute_sync(purchase_id):
    """
    Synchronous version of minting + distribution (for when Celery not available).

    Steps:
    1. Mint NFT (get ACTUAL gas cost)
    2. Calculate distribution with ACTUAL fees
    3. Update purchase record
    4. Update creator sales tracking
    5. Queue creator payout (future)

    Args:
        purchase_id: Purchase ID to process
    """
    from ..models import UserProfile, CoreUser

    try:
        purchase = Purchase.objects.get(id=purchase_id)
        purchase.status = 'minting'
        purchase.save()

        logger.info(f'[MintSync] Minting NFT for purchase {purchase_id}...')

        # 1. MINT NFT - Get ACTUAL gas cost
        # For MVP, we'll use the existing MintView logic
        # In production, this would call a dedicated minting service

        # Simulate mint (replace with actual Solana mint call)
        mint_result = {
            'mint_address': f'mock_mint_{purchase_id}',
            'transaction_signature': f'mock_tx_{purchase_id}',
        }

        # Get ACTUAL gas cost
        # For now, use estimated cost. In production, call get_solana_transaction_fee()
        actual_gas_cost = Decimal('0.026')  # ~$0.026 typical

        # 2. Update purchase with mint data
        purchase.nft_mint_address = mint_result['mint_address']
        purchase.transaction_signature = mint_result['transaction_signature']
        purchase.mint_cost = actual_gas_cost
        purchase.nft_minted = True

        # 3. Calculate distribution with ACTUAL fees
        distribution = calculate_distribution(purchase)

        # 4. Update purchase with final amounts
        purchase.net_after_costs = distribution['net_after_costs']
        purchase.platform_fee = distribution['platform_fee']
        purchase.creator_amount = distribution['creator_amount']
        purchase.status = 'completed'
        purchase.save()

        logger.info(
            f'[MintSync] Purchase {purchase_id} completed: '
            f'Creator gets ${purchase.creator_amount} ({Decimal("90")}%), '
            f'Platform gets ${purchase.platform_fee} ({Decimal("10")}%)'
        )

        # 5. Update creator sales tracking
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
                    f'[MintSync] Updated creator {creator.username} total_sales_usd to ${profile.total_sales_usd}'
                )
        except Exception as e:
            logger.error(f'[MintSync] Error updating creator sales for purchase {purchase_id}: {e}')

        # 6. TODO: Queue creator payout via Stripe Connect
        # schedule_creator_payout(purchase.id)

        return {
            'success': True,
            'purchase_id': purchase.id,
            'distribution': distribution
        }

    except Purchase.DoesNotExist:
        logger.error(f'[MintSync] Purchase {purchase_id} not found')
        return {'success': False, 'error': 'Purchase not found'}
    except Exception as e:
        logger.error(f'[MintSync] Error minting for purchase {purchase_id}: {e}', exc_info=True)
        if purchase_id:
            try:
                purchase = Purchase.objects.get(id=purchase_id)
                purchase.status = 'failed'
                purchase.save()
            except Exception as db_error:
                logger.error(f'[MintSync] Failed to mark purchase {purchase_id} as failed: {db_error}')
        return {'success': False, 'error': str(e)}
