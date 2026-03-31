"""
Tests for the 3% escrow service fee.

Verifies that:
1. Fee calculation returns correct 97/3 split
2. Edge cases (small amounts, zero, large amounts) are handled
3. Fee is separate from content sales platform fee (no double taxation)
"""

from decimal import Decimal
from django.test import TestCase
from rb_core.payment_utils import (
    calculate_escrow_release_breakdown,
    ESCROW_FEE_BPS,
    calculate_payment_breakdown,
)


class EscrowFeeCalculationTest(TestCase):
    """Test escrow fee calculation utility."""

    def test_fee_on_100_dollars(self):
        """$100 milestone: artist gets $97, platform gets $3."""
        breakdown = calculate_escrow_release_breakdown(100)
        self.assertEqual(breakdown['artist_net'], Decimal('97.00'))
        self.assertEqual(breakdown['platform_fee'], Decimal('3.00'))
        self.assertEqual(breakdown['fee_bps'], 300)

    def test_fee_on_50_dollars(self):
        """$50 milestone: artist gets $48.50, platform gets $1.50."""
        breakdown = calculate_escrow_release_breakdown(50)
        self.assertEqual(breakdown['artist_net'], Decimal('48.50'))
        self.assertEqual(breakdown['platform_fee'], Decimal('1.50'))

    def test_fee_on_1_dollar(self):
        """$1 milestone: artist gets $0.97, platform gets $0.03."""
        breakdown = calculate_escrow_release_breakdown(1)
        self.assertEqual(breakdown['artist_net'], Decimal('0.97'))
        self.assertEqual(breakdown['platform_fee'], Decimal('0.03'))

    def test_fee_on_large_amount(self):
        """$10000 milestone: artist gets $9700, platform gets $300."""
        breakdown = calculate_escrow_release_breakdown(10000)
        self.assertEqual(breakdown['artist_net'], Decimal('9700.00'))
        self.assertEqual(breakdown['platform_fee'], Decimal('300.00'))

    def test_fee_on_odd_amount(self):
        """$33.33 milestone: test rounding."""
        breakdown = calculate_escrow_release_breakdown('33.33')
        # 33.33 * 0.03 = 1.0 (rounded)
        self.assertEqual(breakdown['platform_fee'], Decimal('1.00'))
        self.assertEqual(breakdown['artist_net'], Decimal('32.33'))
        # Verify they sum to the original
        self.assertEqual(
            breakdown['artist_net'] + breakdown['platform_fee'],
            Decimal('33.33')
        )

    def test_fee_on_small_amount(self):
        """$0.10 milestone: very small fee."""
        breakdown = calculate_escrow_release_breakdown('0.10')
        # 0.10 * 0.03 = 0.003, rounds to 0.00
        self.assertEqual(breakdown['platform_fee'], Decimal('0.00'))
        self.assertEqual(breakdown['artist_net'], Decimal('0.10'))

    def test_fee_accepts_string_input(self):
        """Fee calculation accepts string amounts."""
        breakdown = calculate_escrow_release_breakdown('250.00')
        self.assertEqual(breakdown['platform_fee'], Decimal('7.50'))
        self.assertEqual(breakdown['artist_net'], Decimal('242.50'))

    def test_fee_accepts_decimal_input(self):
        """Fee calculation accepts Decimal amounts."""
        breakdown = calculate_escrow_release_breakdown(Decimal('250.00'))
        self.assertEqual(breakdown['platform_fee'], Decimal('7.50'))
        self.assertEqual(breakdown['artist_net'], Decimal('242.50'))

    def test_fee_rate_is_3_percent(self):
        """Verify the fee rate constant is 300 bps (3%)."""
        self.assertEqual(ESCROW_FEE_BPS, 300)
        breakdown = calculate_escrow_release_breakdown(100)
        self.assertEqual(breakdown['fee_rate'], Decimal('0.03'))

    def test_escrow_fee_separate_from_content_fee(self):
        """Escrow fee (3%) is independent of content sales fee (1-10%)."""
        # Content sale: 10% platform fee (standard tier)
        content_breakdown = calculate_payment_breakdown(Decimal('10.00'))
        content_platform_rate = content_breakdown['platform_fee_rate']

        # Escrow release: 3% fee
        escrow_breakdown = calculate_escrow_release_breakdown(10)
        escrow_rate = escrow_breakdown['fee_rate']

        # They should be different — no double taxation
        self.assertNotEqual(content_platform_rate, escrow_rate)
        self.assertEqual(escrow_rate, Decimal('0.03'))
        self.assertEqual(content_platform_rate, Decimal('0.10'))
