"""
Unit tests for credit card fee pass-through calculations.

Tests ensure that:
1. Fee calculation formula is correct
2. Platform receives exactly chapter price after Stripe fees
3. Creators get exactly 90% of chapter price
4. Rounding is handled correctly
"""

from decimal import Decimal
from django.test import TestCase
from rb_core.payment_utils import calculate_payment_breakdown, format_currency


class FeeCalculationTestCase(TestCase):
    """Test fee calculation with CC fee pass-through."""

    def test_fee_calculation_1_dollar(self):
        """Test $1 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('1.00'))

        self.assertEqual(breakdown['chapter_price'], Decimal('1.00'))
        self.assertAlmostEqual(float(breakdown['buyer_total']), 1.34, places=2)
        self.assertAlmostEqual(float(breakdown['credit_card_fee']), 0.34, places=2)
        self.assertAlmostEqual(float(breakdown['platform_receives']), 1.00, places=2)
        self.assertAlmostEqual(float(breakdown['creator_share_90']), 0.90, places=2)
        self.assertAlmostEqual(float(breakdown['platform_share_10']), 0.10, places=2)

    def test_fee_calculation_3_dollar(self):
        """Test $3 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))

        self.assertEqual(breakdown['chapter_price'], Decimal('3.00'))
        self.assertAlmostEqual(float(breakdown['buyer_total']), 3.40, places=2)
        self.assertAlmostEqual(float(breakdown['credit_card_fee']), 0.40, places=2)
        self.assertAlmostEqual(float(breakdown['platform_receives']), 3.00, places=2)
        self.assertAlmostEqual(float(breakdown['creator_share_90']), 2.70, places=2)
        self.assertAlmostEqual(float(breakdown['platform_share_10']), 0.30, places=2)

    def test_fee_calculation_5_dollar(self):
        """Test $5 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('5.00'))

        self.assertEqual(breakdown['chapter_price'], Decimal('5.00'))
        self.assertAlmostEqual(float(breakdown['buyer_total']), 5.46, places=2)
        self.assertAlmostEqual(float(breakdown['credit_card_fee']), 0.46, places=2)
        self.assertAlmostEqual(float(breakdown['platform_receives']), 5.00, places=2)
        self.assertAlmostEqual(float(breakdown['creator_share_90']), 4.50, places=2)
        self.assertAlmostEqual(float(breakdown['platform_share_10']), 0.50, places=2)

    def test_fee_calculation_10_dollar(self):
        """Test $10 chapter fee breakdown."""
        breakdown = calculate_payment_breakdown(Decimal('10.00'))

        self.assertEqual(breakdown['chapter_price'], Decimal('10.00'))
        self.assertAlmostEqual(float(breakdown['buyer_total']), 10.61, places=2)
        self.assertAlmostEqual(float(breakdown['credit_card_fee']), 0.61, places=2)
        self.assertAlmostEqual(float(breakdown['platform_receives']), 10.00, places=2)
        self.assertAlmostEqual(float(breakdown['creator_share_90']), 9.00, places=2)
        self.assertAlmostEqual(float(breakdown['platform_share_10']), 1.00, places=2)

    def test_platform_receives_equals_chapter_price(self):
        """Verify platform receives exactly chapter price after Stripe fees."""
        test_prices = [1.00, 2.50, 3.00, 5.00, 10.00, 20.00]

        for price in test_prices:
            with self.subTest(price=price):
                breakdown = calculate_payment_breakdown(Decimal(str(price)))

                # Platform should receive chapter price (within 1 cent due to rounding)
                self.assertAlmostEqual(
                    float(breakdown['platform_receives']),
                    float(breakdown['chapter_price']),
                    places=2,
                    msg=f"Failed for ${price}: platform receives ${breakdown['platform_receives']} != chapter price ${breakdown['chapter_price']}"
                )

    def test_creator_gets_exactly_90_percent(self):
        """Verify creator always gets exactly 90% of chapter price."""
        test_prices = [1.00, 2.50, 3.00, 5.00, 10.00, 20.00]

        for price in test_prices:
            with self.subTest(price=price):
                breakdown = calculate_payment_breakdown(Decimal(str(price)))
                expected_creator_share = Decimal(str(price)) * Decimal('0.90')

                self.assertAlmostEqual(
                    float(breakdown['creator_share_90']),
                    float(expected_creator_share),
                    places=2,
                    msg=f"Failed for ${price}: creator gets ${breakdown['creator_share_90']} != expected ${expected_creator_share}"
                )

    def test_stripe_fee_calculation(self):
        """Verify Stripe fee is calculated correctly (2.9% + $0.30)."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))

        # For $3 chapter:
        # buyer_total = (3.00 + 0.30) / (1 - 0.029) = 3.40
        # stripe_fee = 3.40 * 0.029 + 0.30 = 0.0986 + 0.30 = 0.3986 ≈ 0.40
        self.assertAlmostEqual(float(breakdown['stripe_fee']), 0.40, places=2)

    def test_gas_fee_deduction(self):
        """Verify gas fee is properly deducted from USDC distribution."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))

        # Gas fee should be $0.026
        self.assertEqual(breakdown['gas_fee'], Decimal('0.026'))

        # USDC to distribute = chapter_price - gas_fee
        expected_usdc = Decimal('3.00') - Decimal('0.026')
        self.assertEqual(breakdown['usdc_to_distribute'], expected_usdc)

    def test_breakdown_display_formatting(self):
        """Test display formatting helper."""
        breakdown = calculate_payment_breakdown(Decimal('3.00'))

        display = breakdown['breakdown_display']

        self.assertEqual(display['chapter_price'], '$3.00')
        self.assertEqual(display['buyer_total'], '$3.40')
        self.assertEqual(display['creator_receives'], '$2.70')
        self.assertEqual(display['platform_receives'], '$0.30')

    def test_format_currency_helper(self):
        """Test currency formatting helper function."""
        self.assertEqual(format_currency(Decimal('1.00')), '$1.00')
        self.assertEqual(format_currency(Decimal('3.40')), '$3.40')
        self.assertEqual(format_currency(Decimal('10.61')), '$10.61')
        self.assertEqual(format_currency('5.00'), '$5.00')
        self.assertEqual(format_currency(20.00), '$20.00')

    def test_accept_different_input_types(self):
        """Test that calculate_payment_breakdown accepts various input types."""
        # Decimal
        breakdown1 = calculate_payment_breakdown(Decimal('3.00'))
        # Float
        breakdown2 = calculate_payment_breakdown(3.00)
        # String
        breakdown3 = calculate_payment_breakdown('3.00')

        # All should produce same result
        self.assertEqual(breakdown1['chapter_price'], breakdown2['chapter_price'])
        self.assertEqual(breakdown2['chapter_price'], breakdown3['chapter_price'])

    def test_math_assertion(self):
        """Test that the internal math assertion works."""
        # This should not raise an assertion error
        breakdown = calculate_payment_breakdown(Decimal('5.00'))

        # Verify the assertion condition manually
        difference = abs(breakdown['platform_receives'] - breakdown['chapter_price'])
        self.assertLess(difference, Decimal('0.02'), "Platform receives should equal chapter price within 1 cent")

    def test_realistic_scenarios(self):
        """Test realistic chapter pricing scenarios."""
        scenarios = [
            {'price': 0.99, 'buyer_pays_approx': 1.33},
            {'price': 1.99, 'buyer_pays_approx': 2.36},
            {'price': 2.99, 'buyer_pays_approx': 3.39},
            {'price': 4.99, 'buyer_pays_approx': 5.45},
            {'price': 9.99, 'buyer_pays_approx': 10.60},
        ]

        for scenario in scenarios:
            with self.subTest(price=scenario['price']):
                breakdown = calculate_payment_breakdown(Decimal(str(scenario['price'])))

                self.assertAlmostEqual(
                    float(breakdown['buyer_total']),
                    scenario['buyer_pays_approx'],
                    places=2
                )

                # Creator should get 90% of chapter price
                expected_creator = Decimal(str(scenario['price'])) * Decimal('0.90')
                self.assertAlmostEqual(
                    float(breakdown['creator_share_90']),
                    float(expected_creator),
                    places=2
                )
