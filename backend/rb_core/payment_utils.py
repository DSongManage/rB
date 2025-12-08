"""
Payment fee calculation utilities for credit card fee pass-through.

This module implements transparent fee pass-through to ensure creators
receive exactly 90% of the chapter price they set.
"""

from decimal import Decimal, ROUND_HALF_UP

# Stripe fee structure
STRIPE_PERCENTAGE_FEE = Decimal('0.029')  # 2.9%
STRIPE_FIXED_FEE = Decimal('0.30')        # $0.30


def calculate_payment_breakdown(chapter_price):
    """
    Calculate complete payment breakdown with CC fee pass-through.

    The formula ensures that after Stripe takes its fee, the platform
    receives exactly the chapter price. This allows creators to get
    exactly 90% of the price they set.

    Formula: buyer_total = (chapter_price + 0.30) / (1 - 0.029)

    Args:
        chapter_price (Decimal|float|str): The chapter's list price

    Returns:
        dict: Complete breakdown of the payment
        {
            'chapter_price': Decimal,
            'credit_card_fee': Decimal,
            'buyer_total': Decimal,
            'stripe_fee': Decimal,
            'platform_receives': Decimal,
            'creator_share_90': Decimal,
            'platform_share_10': Decimal,
            'gas_fee': Decimal,
            'usdc_to_distribute': Decimal,
            'breakdown_display': dict
        }
    """
    chapter_price = Decimal(str(chapter_price))

    # Calculate buyer total (what buyer pays to cover Stripe fees)
    buyer_total = (chapter_price + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENTAGE_FEE)
    buyer_total = buyer_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Calculate credit card fee (what we show to buyer)
    credit_card_fee = buyer_total - chapter_price

    # Calculate what Stripe actually takes
    stripe_fee = (buyer_total * STRIPE_PERCENTAGE_FEE) + STRIPE_FIXED_FEE
    stripe_fee = stripe_fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Platform receives (should equal chapter_price after Stripe fee)
    platform_receives = buyer_total - stripe_fee

    # Verify our math is correct (within 1 cent tolerance due to rounding)
    assert abs(platform_receives - chapter_price) < Decimal('0.02'), \
        f"Math error: platform_receives ({platform_receives}) != chapter_price ({chapter_price})"

    # Use chapter_price as the base for splits (not platform_receives)
    # This ensures creators always get exactly 90% of list price
    creator_share_90 = (chapter_price * Decimal('0.90')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    platform_share_10 = (chapter_price * Decimal('0.10')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Gas fee for Solana transaction
    gas_fee = Decimal('0.026')

    # USDC to distribute (platform fronts this amount)
    usdc_to_distribute = chapter_price - gas_fee

    return {
        'chapter_price': chapter_price,
        'credit_card_fee': credit_card_fee,
        'buyer_total': buyer_total,
        'stripe_fee': stripe_fee,
        'platform_receives': platform_receives,
        'creator_share_90': creator_share_90,
        'platform_share_10': platform_share_10,
        'gas_fee': gas_fee,
        'usdc_to_distribute': usdc_to_distribute,

        # For display
        'breakdown_display': {
            'chapter_price': format_currency(chapter_price),
            'credit_card_fee': format_currency(credit_card_fee),
            'buyer_total': format_currency(buyer_total),
            'creator_receives': format_currency(creator_share_90),
            'platform_receives': format_currency(platform_share_10),
        }
    }


def format_currency(amount):
    """Format Decimal as currency string."""
    return f'${Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP):.2f}'


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
        print(f"  Platform receives: ${breakdown['platform_receives']:.2f}")
        print(f"  Creator gets (90%): {breakdown['breakdown_display']['creator_receives']}")
        print(f"  Platform gets (10%): {breakdown['breakdown_display']['platform_receives']}")
        print(f"  USDC to distribute: ${breakdown['usdc_to_distribute']:.2f}")
