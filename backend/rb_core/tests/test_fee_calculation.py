"""
Unit tests for USDC payment fee calculations.

Tests ensure that:
1. Buyer pays exactly chapter price (no processing fee)
2. Gas fee is correctly deducted before split
3. Platform/creator split matches tier fee rates
4. Rounding is handled correctly
5. Display formatting is correct
"""

from decimal import Decimal
from django.test import TestCase
from rb_core.payment_utils import calculate_payment_breakdown, format_currency


class FeeCalculationTestCase(TestCase):
    """Test fee calculation with USDC Web3 model."""

    def test_buyer_pays_chapter_price(self):
        """Buyer pays exactly the chapter price — no processing fee added."""
        for price in ['1.00', '3.00', '5.00', '10.00']:
            with self.subTest(price=price):
                breakdown = calculate_payment_breakdown(Decimal(price))
                self.assertEqual(breakdown['buyer_total'], Decimal(price))

    def test_gas_fee_deduction(self):
        """Gas fee ($0.026) is deducted from USDC distribution."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))
        self.assertEqual(breakdown['gas_fee'], Decimal('0.026'))
        expected_usdc = Decimal('3.00') - Decimal('0.026')
        self.assertEqual(breakdown['usdc_to_distribute'], expected_usdc)

    def test_platform_receives_chapter_price(self):
        """Platform receives exactly chapter price (before split)."""
        test_prices = ['1.00', '2.50', '3.00', '5.00', '10.00', '20.00']
        for price in test_prices:
            with self.subTest(price=price):
                breakdown = calculate_payment_breakdown(Decimal(price))
                self.assertEqual(breakdown['platform_receives'], Decimal(price))

    def test_standard_tier_split(self):
        """Standard tier: 90% creator / 10% platform (after gas)."""
        breakdown = calculate_payment_breakdown(Decimal('10.00'))
        usdc_to_distribute = Decimal('10.00') - Decimal('0.026')
        expected_creator = (usdc_to_distribute * Decimal('0.90')).quantize(Decimal('0.01'))
        expected_platform = (usdc_to_distribute * Decimal('0.10')).quantize(Decimal('0.01'))
        self.assertEqual(breakdown['creator_usdc'], expected_creator)
        self.assertEqual(breakdown['platform_usdc'], expected_platform)

    def test_fee_calculation_1_dollar(self):
        """Test $1 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('1.00'))
        self.assertEqual(breakdown['chapter_price'], Decimal('1.00'))
        self.assertEqual(breakdown['buyer_total'], Decimal('1.00'))
        self.assertEqual(breakdown['gas_fee'], Decimal('0.026'))
        # Creator gets 90% of ($1.00 - $0.026) = 90% of $0.974 = $0.88
        self.assertEqual(breakdown['creator_usdc'], Decimal('0.88'))
        # Platform gets 10% of $0.974 = $0.10
        self.assertEqual(breakdown['platform_usdc'], Decimal('0.10'))

    def test_fee_calculation_3_dollar(self):
        """Test $3 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))
        self.assertEqual(breakdown['chapter_price'], Decimal('3.00'))
        self.assertEqual(breakdown['buyer_total'], Decimal('3.00'))
        # Creator gets 90% of ($3.00 - $0.026) = 90% of $2.974 = $2.68
        self.assertEqual(breakdown['creator_usdc'], Decimal('2.68'))
        # Platform gets 10% of $2.974 = $0.30
        self.assertEqual(breakdown['platform_usdc'], Decimal('0.30'))

    def test_fee_calculation_5_dollar(self):
        """Test $5 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('5.00'))
        self.assertEqual(breakdown['chapter_price'], Decimal('5.00'))
        self.assertEqual(breakdown['buyer_total'], Decimal('5.00'))
        # Creator gets 90% of ($5.00 - $0.026) = 90% of $4.974 = $4.48
        self.assertEqual(breakdown['creator_usdc'], Decimal('4.48'))
        # Platform gets 10% of $4.974 = $0.50
        self.assertEqual(breakdown['platform_usdc'], Decimal('0.50'))

    def test_fee_calculation_10_dollar(self):
        """Test $10 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('10.00'))
        self.assertEqual(breakdown['chapter_price'], Decimal('10.00'))
        self.assertEqual(breakdown['buyer_total'], Decimal('10.00'))
        # Creator gets 90% of ($10.00 - $0.026) = 90% of $9.974 = $8.98
        self.assertEqual(breakdown['creator_usdc'], Decimal('8.98'))
        # Platform gets 10% of $9.974 = $1.00
        self.assertEqual(breakdown['platform_usdc'], Decimal('1.00'))

    def test_pre_gas_shares(self):
        """Pre-gas shares reflect tier split on full chapter price."""
        breakdown = calculate_payment_breakdown(Decimal('10.00'))
        self.assertEqual(breakdown['creator_share'], Decimal('9.00'))
        self.assertEqual(breakdown['platform_share'], Decimal('1.00'))

    def test_breakdown_display_formatting(self):
        """Test display formatting matches USDC model."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))
        display = breakdown['breakdown_display']
        self.assertEqual(display['chapter_price'], '$3.00')
        self.assertEqual(display['buyer_total'], '$3.00')
        self.assertEqual(display['creator_receives'], '$2.68')
        self.assertEqual(display['platform_receives'], '$0.30')
        self.assertEqual(display['platform_fee_percent'], '10%')
        self.assertEqual(display['gas_fee'], '$0.03')

    def test_format_currency_helper(self):
        """Test currency formatting helper function."""
        self.assertEqual(format_currency(Decimal('1.00')), '$1.00')
        self.assertEqual(format_currency(Decimal('3.40')), '$3.40')
        self.assertEqual(format_currency(Decimal('10.61')), '$10.61')
        self.assertEqual(format_currency('5.00'), '$5.00')
        self.assertEqual(format_currency(20.00), '$20.00')

    def test_accept_different_input_types(self):
        """calculate_payment_breakdown accepts Decimal, float, and string."""
        breakdown1 = calculate_payment_breakdown(Decimal('3.00'))
        breakdown2 = calculate_payment_breakdown(3.00)
        breakdown3 = calculate_payment_breakdown('3.00')
        self.assertEqual(breakdown1['chapter_price'], breakdown2['chapter_price'])
        self.assertEqual(breakdown2['chapter_price'], breakdown3['chapter_price'])

    def test_math_consistency(self):
        """Creator + platform + gas should equal chapter price."""
        for price in ['1.00', '3.00', '5.00', '10.00', '20.00']:
            with self.subTest(price=price):
                breakdown = calculate_payment_breakdown(Decimal(price))
                total = breakdown['creator_usdc'] + breakdown['platform_usdc'] + breakdown['gas_fee']
                diff = abs(total - breakdown['chapter_price'])
                self.assertLess(diff, Decimal('0.02'),
                                f"Split doesn't add up: {breakdown['creator_usdc']} + "
                                f"{breakdown['platform_usdc']} + {breakdown['gas_fee']} = {total}")

    def test_platform_fee_rate_default(self):
        """Default platform fee rate is 10% (standard tier)."""
        breakdown = calculate_payment_breakdown(Decimal('5.00'))
        self.assertEqual(breakdown['platform_fee_rate'], Decimal('0.10'))
        self.assertEqual(breakdown['creator_tier'], 'standard')

    def test_realistic_scenarios(self):
        """Test realistic chapter pricing — buyer always pays exact price."""
        for price in ['0.99', '1.99', '2.99', '4.99', '9.99']:
            with self.subTest(price=price):
                breakdown = calculate_payment_breakdown(Decimal(price))
                self.assertEqual(breakdown['buyer_total'], Decimal(price))
                # Creator should get ~90% of (price - gas)
                expected_approx = float(Decimal(price) - Decimal('0.026')) * 0.90
                self.assertAlmostEqual(float(breakdown['creator_usdc']), expected_approx, places=1)
