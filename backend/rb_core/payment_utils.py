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

# Escrow service fee (separate from content sales fees — no double taxation)
ESCROW_FEE_BPS = 300  # 3% = 300 basis points


def calculate_escrow_release_breakdown(milestone_amount, fee_mode='artist_pays'):
    """
    Calculate escrow release split based on fee mode.

    Platform ALWAYS receives 3% of the milestone amount. The fee_mode
    determines who absorbs that cost:

    - writer_pays: Writer funded milestone + 3%. Artist receives full milestone.
      Escrow held milestone * 1.03, platform gets 0.03, artist gets 1.00.
    - artist_pays: Writer funded exact milestone. Artist receives milestone - 3%.
      Escrow held milestone * 1.00, platform gets 0.03, artist gets 0.97.
    - split: Writer funded milestone + 1.5%. Artist receives milestone - 1.5%.
      Escrow held milestone * 1.015, platform gets 0.03, artist gets 0.985.

    Args:
        milestone_amount: The task's payment_amount (what the artist was promised)
        fee_mode: 'writer_pays', 'artist_pays', or 'split'

    Returns:
        dict with: artist_net, platform_fee, writer_funded (amount held in escrow
        for this task), fee_mode, fee_rate, fee_bps
    """
    milestone_amount = Decimal(str(milestone_amount))
    fee_rate = Decimal(str(ESCROW_FEE_BPS)) / Decimal('10000')  # 0.03
    platform_fee = (milestone_amount * fee_rate).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    if fee_mode == 'writer_pays':
        # Writer funded extra 3% on top. Artist gets full milestone.
        artist_net = milestone_amount
        writer_funded = milestone_amount + platform_fee
    elif fee_mode == 'split':
        # Writer funded extra 1.5%, artist absorbs 1.5%
        half_fee = (platform_fee / 2).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        writer_extra = half_fee
        artist_deduction = platform_fee - half_fee  # ensures exact 3% total
        artist_net = milestone_amount - artist_deduction
        writer_funded = milestone_amount + writer_extra
    else:  # artist_pays (default / legacy)
        # Writer funded exact milestone. Artist absorbs full 3%.
        artist_net = milestone_amount - platform_fee
        writer_funded = milestone_amount

    return {
        'artist_net': artist_net,
        'platform_fee': platform_fee,
        'writer_funded': writer_funded,
        'fee_mode': fee_mode,
        'fee_rate': fee_rate,
        'fee_bps': ESCROW_FEE_BPS,
    }


def calculate_escrow_funding_total(total_contract_amount, fee_mode='artist_pays'):
    """
    Calculate what the writer must fund for a given contract amount + fee mode.

    Args:
        total_contract_amount: Sum of all task payment_amounts
        fee_mode: 'writer_pays', 'artist_pays', or 'split'

    Returns:
        Decimal: Total amount the writer must deposit into escrow
    """
    total_contract_amount = Decimal(str(total_contract_amount))
    fee_rate = Decimal(str(ESCROW_FEE_BPS)) / Decimal('10000')

    if fee_mode == 'writer_pays':
        fee = (total_contract_amount * fee_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return total_contract_amount + fee
    elif fee_mode == 'split':
        half_rate = fee_rate / 2
        writer_extra = (total_contract_amount * half_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return total_contract_amount + writer_extra
    else:  # artist_pays
        return total_contract_amount


def calculate_pda_milestone_amount(payment_amount, fee_mode='artist_pays'):
    """
    Calculate the milestone amount to store in the PDA vault for a given fee mode.

    The Anchor program always calculates:
        platform_fee = amount * fee_bps / 10000
        artist_payment = amount - platform_fee

    So we need to set the PDA amount such that after the on-chain fee deduction,
    the artist receives the correct net amount per the fee mode.

    Args:
        payment_amount: The task's payment_amount (what the artist was promised)
        fee_mode: 'writer_pays', 'artist_pays', or 'split'

    Returns:
        int: Amount in USDC lamports (6 decimals) to store in the PDA
    """
    payment_amount = Decimal(str(payment_amount))
    fee_rate = Decimal(str(ESCROW_FEE_BPS)) / Decimal('10000')  # 0.03

    if fee_rate >= Decimal('1'):
        raise ValueError(f"Fee rate cannot be >= 100%, got {ESCROW_FEE_BPS} BPS")

    if fee_mode == 'writer_pays':
        # Artist must receive exactly payment_amount after 3% deduction
        # PDA amount * (1 - 0.03) = payment_amount
        # PDA amount = payment_amount / 0.97
        pda_amount = payment_amount / (Decimal('1') - fee_rate)
    elif fee_mode == 'split':
        # Artist receives payment_amount - 1.5%
        # On-chain: artist gets pda_amount * 0.97
        # We want: pda_amount * 0.97 = payment_amount - (payment_amount * 0.015)
        # pda_amount = payment_amount * 0.985 / 0.97
        half_rate = fee_rate / 2
        target_artist_net = payment_amount * (Decimal('1') - half_rate)
        pda_amount = target_artist_net / (Decimal('1') - fee_rate)
    else:  # artist_pays
        # Artist receives payment_amount * 0.97 (on-chain handles it naturally)
        pda_amount = payment_amount

    # Convert to USDC lamports (6 decimals), round up to ensure enough funds
    return int((pda_amount * Decimal('1000000')).to_integral_value(rounding=ROUND_HALF_UP))


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
