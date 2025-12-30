"""
Payment fee calculation utilities for processing fee pass-through.

This module implements transparent fee pass-through where:
- Buyer pays: chapter_price + Processing Fee (CC + Bridge)
- Platform receives: chapter_price (after Stripe & Bridge take their cut)
- Gas fee is deducted before 90/10 split
- Creator receives: 90% of (chapter_price - gas_fee)
- Platform keeps: 10% of (chapter_price - gas_fee)

The gas fee (~$0.026) covers Solana transaction costs and is shared
proportionally between creator (90%) and platform (10%).

Processing Fee includes:
- Stripe: 2.9% + $0.30 (credit card processing)
- Bridge: ~0.1% (USD → USDC on-ramp conversion)

The combined "Processing Fee" is shown as a single line item to users.
"""

from decimal import Decimal, ROUND_HALF_UP

# Stripe fee structure
STRIPE_PERCENTAGE_FEE = Decimal('0.029')  # 2.9%
STRIPE_FIXED_FEE = Decimal('0.30')        # $0.30

# Bridge fee structure (USD → USDC on-ramp)
BRIDGE_PERCENTAGE_FEE = Decimal('0.001')  # 0.1%


def calculate_payment_breakdown(chapter_price):
    """
    Calculate complete payment breakdown with processing fee pass-through.

    The formula ensures that after Stripe and Bridge take their fees,
    the platform receives exactly the chapter price. This allows creators
    to get exactly 90% of the price they set.

    Processing Fee = Stripe (2.9% + $0.30) + Bridge (~0.1%)

    Formula: buyer_total = (chapter_price + 0.30) / (1 - 0.029 - 0.001)

    Args:
        chapter_price (Decimal|float|str): The chapter's list price

    Returns:
        dict: Complete breakdown of the payment
        {
            'chapter_price': Decimal,
            'processing_fee': Decimal,  # Combined Stripe + Bridge
            'credit_card_fee': Decimal,  # Alias for backwards compatibility
            'buyer_total': Decimal,
            'stripe_fee': Decimal,
            'bridge_fee': Decimal,
            'platform_receives': Decimal,
            'creator_share_90': Decimal,
            'platform_share_10': Decimal,
            'gas_fee': Decimal,
            'usdc_to_distribute': Decimal,
            'breakdown_display': dict
        }
    """
    chapter_price = Decimal(str(chapter_price))

    # Combined percentage fee (Stripe + Bridge)
    combined_percentage = STRIPE_PERCENTAGE_FEE + BRIDGE_PERCENTAGE_FEE  # 3.0%

    # Calculate buyer total (what buyer pays to cover all processing fees)
    buyer_total = (chapter_price + STRIPE_FIXED_FEE) / (1 - combined_percentage)
    buyer_total = buyer_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Calculate processing fee (what we show to buyer - single combined line)
    processing_fee = buyer_total - chapter_price

    # Calculate what Stripe actually takes
    stripe_fee = (buyer_total * STRIPE_PERCENTAGE_FEE) + STRIPE_FIXED_FEE
    stripe_fee = stripe_fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Calculate what Bridge takes (USD → USDC conversion)
    bridge_fee = (buyer_total * BRIDGE_PERCENTAGE_FEE).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Platform receives (should equal chapter_price after Stripe + Bridge fees)
    platform_receives = buyer_total - stripe_fee - bridge_fee

    # Verify our math is correct (within 2 cents tolerance due to rounding)
    assert abs(platform_receives - chapter_price) < Decimal('0.03'), \
        f"Math error: platform_receives ({platform_receives}) != chapter_price ({chapter_price})"

    # Gas fee for Solana transaction (shared proportionally between creator and platform)
    gas_fee = Decimal('0.026')

    # USDC to distribute after gas (this is what gets split 90/10)
    usdc_to_distribute = chapter_price - gas_fee

    # Actual amounts after proportional gas deduction
    # Creator gets 90% of post-gas amount, platform gets 10%
    creator_usdc_actual = (usdc_to_distribute * Decimal('0.90')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    platform_usdc_actual = (usdc_to_distribute * Decimal('0.10')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # For reference: what the split would be without gas (90/10 of chapter_price)
    creator_share_pre_gas = (chapter_price * Decimal('0.90')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    platform_share_pre_gas = (chapter_price * Decimal('0.10')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Gas paid by each party (proportional to their share)
    creator_gas_share = (gas_fee * Decimal('0.90')).quantize(
        Decimal('0.001'), rounding=ROUND_HALF_UP
    )
    platform_gas_share = (gas_fee * Decimal('0.10')).quantize(
        Decimal('0.001'), rounding=ROUND_HALF_UP
    )

    return {
        'chapter_price': chapter_price,
        'processing_fee': processing_fee,  # Combined Stripe + Bridge (for display)
        'credit_card_fee': processing_fee,  # Alias for backwards compatibility
        'buyer_total': buyer_total,
        'stripe_fee': stripe_fee,
        'bridge_fee': bridge_fee,
        'platform_receives': platform_receives,
        'gas_fee': gas_fee,
        'usdc_to_distribute': usdc_to_distribute,

        # Actual USDC amounts (what gets transferred)
        'creator_usdc': creator_usdc_actual,
        'platform_usdc': platform_usdc_actual,

        # Pre-gas amounts (for transparency)
        'creator_share_90': creator_share_pre_gas,
        'platform_share_10': platform_share_pre_gas,

        # Gas breakdown
        'creator_gas_share': creator_gas_share,
        'platform_gas_share': platform_gas_share,

        # For display - shows ACTUAL amounts creators receive
        'breakdown_display': {
            'chapter_price': format_currency(chapter_price),
            'processing_fee': format_currency(processing_fee),  # Single combined line
            'credit_card_fee': format_currency(processing_fee),  # Alias
            'buyer_total': format_currency(buyer_total),
            'creator_receives': format_currency(creator_usdc_actual),
            'platform_receives': format_currency(platform_usdc_actual),
            'gas_fee': format_currency(gas_fee),
        }
    }


def format_currency(amount):
    """Format Decimal as currency string."""
    return f'${Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP):.2f}'


def calculate_cart_breakdown(item_prices):
    """
    Calculate payment breakdown for cart with SINGLE processing fee across all items.

    KEY SAVINGS: One $0.30 fixed fee across all items vs per-item.

    Processing Fee = Stripe (2.9% + $0.30) + Bridge (~0.1%)

    Example: 5 items at $3 each
    - Per-item: 5 x ($3.42) = $17.10 total
    - Cart:     ($15 + $0.30) / 0.970 = $15.77 total
    - SAVINGS:  $1.33 (7.8%)

    Args:
        item_prices: List of Decimal/float/str prices for items in cart

    Returns:
        dict with subtotal, processing_fee, buyer_total, per_item_breakdown
    """
    GAS_FEE_PER_ITEM = Decimal('0.026')  # Estimated per-mint gas

    # Combined percentage fee (Stripe + Bridge)
    combined_percentage = STRIPE_PERCENTAGE_FEE + BRIDGE_PERCENTAGE_FEE  # 3.0%

    # Convert all prices to Decimal
    item_prices = [Decimal(str(p)) for p in item_prices]
    num_items = len(item_prices)

    if num_items == 0:
        return {
            'subtotal': Decimal('0'),
            'processing_fee': Decimal('0'),
            'credit_card_fee': Decimal('0'),  # Alias
            'buyer_total': Decimal('0'),
            'stripe_fee': Decimal('0'),
            'bridge_fee': Decimal('0'),
            'platform_receives': Decimal('0'),
            'total_gas_estimate': Decimal('0'),
            'num_items': 0,
            'per_item_breakdown': [],
            'savings_vs_individual': Decimal('0'),
            'breakdown_display': {
                'subtotal': '$0.00',
                'processing_fee': '$0.00',
                'credit_card_fee': '$0.00',  # Alias
                'buyer_total': '$0.00',
                'savings': '$0.00',
                'item_count': 0,
            }
        }

    subtotal = sum(item_prices)

    # Single processing fee calculation (the key savings!)
    buyer_total = (subtotal + STRIPE_FIXED_FEE) / (1 - combined_percentage)
    buyer_total = buyer_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    processing_fee = buyer_total - subtotal

    # Stripe's actual fee
    stripe_fee = (buyer_total * STRIPE_PERCENTAGE_FEE) + STRIPE_FIXED_FEE
    stripe_fee = stripe_fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Bridge's fee
    bridge_fee = (buyer_total * BRIDGE_PERCENTAGE_FEE).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Platform receives (should equal subtotal)
    platform_receives = buyer_total - stripe_fee - bridge_fee

    # Total gas for batch (each item still needs individual minting)
    total_gas = GAS_FEE_PER_ITEM * num_items

    # Per-item breakdown for distribution
    per_item_breakdown = []
    for price in item_prices:
        # Each item's share of gas (proportional to price)
        if subtotal > 0:
            item_gas_share = (price / subtotal) * total_gas
        else:
            item_gas_share = GAS_FEE_PER_ITEM

        usdc_to_distribute = price - item_gas_share
        creator_share = (usdc_to_distribute * Decimal('0.90')).quantize(Decimal('0.01'))
        platform_share = (usdc_to_distribute * Decimal('0.10')).quantize(Decimal('0.01'))

        per_item_breakdown.append({
            'item_price': price,
            'gas_share': item_gas_share.quantize(Decimal('0.001')),
            'creator_receives': creator_share,
            'platform_receives': platform_share,
        })

    # Calculate savings vs individual purchases
    if num_items > 1:
        individual_total = Decimal('0')
        for price in item_prices:
            individual = (price + STRIPE_FIXED_FEE) / (1 - combined_percentage)
            individual_total += individual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        savings = individual_total - buyer_total
    else:
        savings = Decimal('0')

    return {
        'subtotal': subtotal,
        'processing_fee': processing_fee,  # Combined Stripe + Bridge (for display)
        'credit_card_fee': processing_fee,  # Alias for backwards compatibility
        'buyer_total': buyer_total,
        'stripe_fee': stripe_fee,
        'bridge_fee': bridge_fee,
        'platform_receives': platform_receives,
        'total_gas_estimate': total_gas,
        'num_items': num_items,
        'per_item_breakdown': per_item_breakdown,
        'savings_vs_individual': savings.quantize(Decimal('0.01')),
        'breakdown_display': {
            'subtotal': format_currency(subtotal),
            'processing_fee': format_currency(processing_fee),  # Single combined line
            'credit_card_fee': format_currency(processing_fee),  # Alias
            'buyer_total': format_currency(buyer_total),
            'savings': format_currency(savings),
            'item_count': num_items,
        }
    }


# Example usage and tests
if __name__ == '__main__':
    test_prices = [1.00, 3.00, 5.00, 10.00, 20.00]

    print("=" * 80)
    print("PAYMENT BREAKDOWN WITH CC FEE PASS-THROUGH")
    print("=" * 80)

    for price in test_prices:
        breakdown = calculate_payment_breakdown(price)
        print(f"\nChapter Price: ${price:.2f}")
        print(f"  Buyer pays: {breakdown['breakdown_display']['buyer_total']}")
        print(f"  Credit card fee: {breakdown['breakdown_display']['credit_card_fee']}")
        print(f"  Stripe takes: ${breakdown['stripe_fee']:.2f}")
        print(f"  Platform receives (fiat): ${breakdown['platform_receives']:.2f}")
        print(f"  Gas fee: ${breakdown['gas_fee']:.3f}")
        print(f"  USDC to distribute: ${breakdown['usdc_to_distribute']:.2f}")
        print(f"  ---")
        print(f"  Creator receives (USDC): {breakdown['breakdown_display']['creator_receives']}")
        print(f"    (90% of ${breakdown['usdc_to_distribute']:.2f}, gas share: ${breakdown['creator_gas_share']:.3f})")
        print(f"  Platform keeps (USDC): {breakdown['breakdown_display']['platform_receives']}")
        print(f"    (10% of ${breakdown['usdc_to_distribute']:.2f}, gas share: ${breakdown['platform_gas_share']:.3f})")
