"""
Payment fee calculation utilities.

This module calculates revenue splits for purchases:
- Buyer pays: chapter_price (in USDC, already in their wallet)
- Gas fee is deducted before the platform/creator split
- Platform fee varies by creator tier (1% founding, 5% early, 10% standard)
- Creator receives the remainder

No processing fee is charged at purchase time — the buyer already has USDC
in their Web3Auth wallet (funded via Coinbase On-Ramp, which is a separate step).
"""

from decimal import Decimal, ROUND_HALF_UP

# Default platform fee (standard tier)
DEFAULT_PLATFORM_FEE_RATE = Decimal('0.10')  # 10%

# Creator tier fee rates
TIER_FEE_RATES = {
    'founding': Decimal('0.01'),   # 1% — first 50 creators
    'early': Decimal('0.05'),      # 5% — next 100 creators
    'standard': Decimal('0.10'),   # 10% — everyone else
}

# Estimated Solana gas fee per mint transaction
GAS_FEE_PER_ITEM = Decimal('0.026')


def get_platform_fee_rate(creator_tier=None, user=None, item=None):
    """
    Get the platform fee rate for a creator's tier.

    Args:
        creator_tier: tier string (legacy, still supported)
        user: optional User instance — looks up tier dynamically
        item: optional item (Chapter/Content/ComicIssue) — uses best collaborator tier

    Returns:
        Decimal fee rate (e.g. 0.01 for 1%)
    """
    # New: dynamic lookup via tier_service
    if item is not None:
        from .tier_service import get_project_fee_rate
        return get_project_fee_rate(item)
    if user is not None:
        from .tier_service import get_creator_fee_rate
        return get_creator_fee_rate(user)
    # Legacy fallback
    if creator_tier and creator_tier in TIER_FEE_RATES:
        return TIER_FEE_RATES[creator_tier]
    return DEFAULT_PLATFORM_FEE_RATE


def calculate_payment_breakdown(chapter_price, creator_tier=None):
    """
    Calculate complete payment breakdown.

    Buyer pays exactly the chapter price (no processing fee).
    The platform/creator split happens on the USDC received.

    Args:
        chapter_price (Decimal|float|str): The chapter's list price
        creator_tier: Optional creator tier for fee rate lookup

    Returns:
        dict: Complete breakdown of the payment
    """
    chapter_price = Decimal(str(chapter_price))
    platform_fee_rate = get_platform_fee_rate(creator_tier)
    creator_rate = Decimal('1') - platform_fee_rate

    # Buyer pays exactly the chapter price
    buyer_total = chapter_price

    # Gas fee for Solana transaction
    gas_fee = GAS_FEE_PER_ITEM

    # USDC to distribute after gas
    usdc_to_distribute = chapter_price - gas_fee

    # Split by tier
    creator_usdc = (usdc_to_distribute * creator_rate).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    platform_usdc = (usdc_to_distribute * platform_fee_rate).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Pre-gas amounts (for transparency)
    creator_share_pre_gas = (chapter_price * creator_rate).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    platform_share_pre_gas = (chapter_price * platform_fee_rate).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Gas paid by each party (proportional to their share)
    creator_gas_share = (gas_fee * creator_rate).quantize(
        Decimal('0.001'), rounding=ROUND_HALF_UP
    )
    platform_gas_share = (gas_fee * platform_fee_rate).quantize(
        Decimal('0.001'), rounding=ROUND_HALF_UP
    )

    return {
        'chapter_price': chapter_price,
        'buyer_total': buyer_total,
        'platform_fee_rate': platform_fee_rate,
        'creator_tier': creator_tier or 'standard',
        'platform_receives': chapter_price,
        'gas_fee': gas_fee,
        'usdc_to_distribute': usdc_to_distribute,

        # Actual USDC amounts (what gets transferred)
        'creator_usdc': creator_usdc,
        'platform_usdc': platform_usdc,

        # Pre-gas amounts (for transparency)
        'creator_share': creator_share_pre_gas,
        'platform_share': platform_share_pre_gas,

        # Gas breakdown
        'creator_gas_share': creator_gas_share,
        'platform_gas_share': platform_gas_share,

        # For display
        'breakdown_display': {
            'chapter_price': format_currency(chapter_price),
            'buyer_total': format_currency(buyer_total),
            'creator_receives': format_currency(creator_usdc),
            'platform_receives': format_currency(platform_usdc),
            'platform_fee_percent': f'{platform_fee_rate * 100:.0f}%',
            'gas_fee': format_currency(gas_fee),
        }
    }


def format_currency(amount):
    """Format Decimal as currency string."""
    return f'${Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP):.2f}'


def calculate_cart_breakdown(item_prices, creator_tier=None):
    """
    Calculate payment breakdown for cart checkout.

    Args:
        item_prices: List of Decimal/float/str prices for items in cart
        creator_tier: Optional creator tier for fee rate lookup

    Returns:
        dict with subtotal, buyer_total, per_item_breakdown
    """
    item_prices = [Decimal(str(p)) for p in item_prices]
    num_items = len(item_prices)
    platform_fee_rate = get_platform_fee_rate(creator_tier)
    creator_rate = Decimal('1') - platform_fee_rate

    if num_items == 0:
        return {
            'subtotal': Decimal('0'),
            'buyer_total': Decimal('0'),
            'platform_receives': Decimal('0'),
            'total_gas_estimate': Decimal('0'),
            'num_items': 0,
            'per_item_breakdown': [],
            'breakdown_display': {
                'subtotal': '$0.00',
                'buyer_total': '$0.00',
                'item_count': 0,
            }
        }

    subtotal = sum(item_prices)
    buyer_total = subtotal  # No processing fee
    total_gas = GAS_FEE_PER_ITEM * num_items

    # Per-item breakdown for distribution
    per_item_breakdown = []
    for price in item_prices:
        if subtotal > 0:
            item_gas_share = (price / subtotal) * total_gas
        else:
            item_gas_share = GAS_FEE_PER_ITEM

        usdc_to_distribute = price - item_gas_share
        creator_share = (usdc_to_distribute * creator_rate).quantize(Decimal('0.01'))
        platform_share = (usdc_to_distribute * platform_fee_rate).quantize(Decimal('0.01'))

        per_item_breakdown.append({
            'item_price': price,
            'gas_share': item_gas_share.quantize(Decimal('0.001')),
            'creator_receives': creator_share,
            'platform_receives': platform_share,
        })

    return {
        'subtotal': subtotal,
        'buyer_total': buyer_total,
        'platform_receives': subtotal,
        'total_gas_estimate': total_gas,
        'num_items': num_items,
        'per_item_breakdown': per_item_breakdown,
        'breakdown_display': {
            'subtotal': format_currency(subtotal),
            'buyer_total': format_currency(buyer_total),
            'item_count': num_items,
        }
    }
