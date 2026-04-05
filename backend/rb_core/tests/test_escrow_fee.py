"""
Tests for the 3% escrow service fee with negotiable fee modes.

Verifies that:
1. Fee calculation returns correct splits for all 3 modes
2. Platform ALWAYS gets exactly 3% regardless of fee mode
3. Funding amounts are correct per mode
4. Refund amounts match what the writer funded
5. Edge cases (small amounts, zero, large amounts) are handled
6. Fee is separate from content sales platform fee (no double taxation)
"""

from decimal import Decimal
from django.test import TestCase
from rb_core.payment_utils import (
    calculate_escrow_release_breakdown,
    calculate_escrow_funding_total,
    ESCROW_FEE_BPS,
    calculate_payment_breakdown,
)


class EscrowFeeCalculationTest(TestCase):
    """Test escrow fee calculation with artist_pays (legacy default)."""

    def test_fee_on_100_dollars(self):
        """$100 milestone (artist_pays): artist gets $97, platform gets $3."""
        breakdown = calculate_escrow_release_breakdown(100, 'artist_pays')
        self.assertEqual(breakdown['artist_net'], Decimal('97.00'))
        self.assertEqual(breakdown['platform_fee'], Decimal('3.00'))
        self.assertEqual(breakdown['writer_funded'], Decimal('100.00'))
        self.assertEqual(breakdown['fee_bps'], 300)

    def test_fee_on_50_dollars(self):
        breakdown = calculate_escrow_release_breakdown(50, 'artist_pays')
        self.assertEqual(breakdown['artist_net'], Decimal('48.50'))
        self.assertEqual(breakdown['platform_fee'], Decimal('1.50'))
        self.assertEqual(breakdown['writer_funded'], Decimal('50.00'))

    def test_fee_on_1_dollar(self):
        breakdown = calculate_escrow_release_breakdown(1, 'artist_pays')
        self.assertEqual(breakdown['artist_net'], Decimal('0.97'))
        self.assertEqual(breakdown['platform_fee'], Decimal('0.03'))

    def test_fee_on_large_amount(self):
        breakdown = calculate_escrow_release_breakdown(10000, 'artist_pays')
        self.assertEqual(breakdown['artist_net'], Decimal('9700.00'))
        self.assertEqual(breakdown['platform_fee'], Decimal('300.00'))

    def test_fee_on_odd_amount(self):
        breakdown = calculate_escrow_release_breakdown('33.33', 'artist_pays')
        self.assertEqual(breakdown['platform_fee'], Decimal('1.00'))
        self.assertEqual(breakdown['artist_net'], Decimal('32.33'))
        self.assertEqual(
            breakdown['artist_net'] + breakdown['platform_fee'],
            Decimal('33.33')
        )

    def test_fee_on_small_amount(self):
        breakdown = calculate_escrow_release_breakdown('0.10', 'artist_pays')
        self.assertEqual(breakdown['platform_fee'], Decimal('0.00'))
        self.assertEqual(breakdown['artist_net'], Decimal('0.10'))

    def test_fee_accepts_string_input(self):
        breakdown = calculate_escrow_release_breakdown('250.00', 'artist_pays')
        self.assertEqual(breakdown['platform_fee'], Decimal('7.50'))
        self.assertEqual(breakdown['artist_net'], Decimal('242.50'))

    def test_fee_accepts_decimal_input(self):
        breakdown = calculate_escrow_release_breakdown(Decimal('250.00'), 'artist_pays')
        self.assertEqual(breakdown['platform_fee'], Decimal('7.50'))
        self.assertEqual(breakdown['artist_net'], Decimal('242.50'))

    def test_fee_rate_is_3_percent(self):
        self.assertEqual(ESCROW_FEE_BPS, 300)
        breakdown = calculate_escrow_release_breakdown(100, 'artist_pays')
        self.assertEqual(breakdown['fee_rate'], Decimal('0.03'))

    def test_escrow_fee_separate_from_content_fee(self):
        content_breakdown = calculate_payment_breakdown(Decimal('10.00'))
        content_platform_rate = content_breakdown['platform_fee_rate']
        escrow_breakdown = calculate_escrow_release_breakdown(10, 'artist_pays')
        escrow_rate = escrow_breakdown['fee_rate']
        self.assertNotEqual(content_platform_rate, escrow_rate)
        self.assertEqual(escrow_rate, Decimal('0.03'))
        self.assertEqual(content_platform_rate, Decimal('0.10'))


class WriterPaysFeeTest(TestCase):
    """Writer absorbs the full 3% fee — artist gets the full milestone amount."""

    def test_100_dollar_milestone(self):
        """$100 milestone: writer funds $103, artist gets $100, platform $3."""
        b = calculate_escrow_release_breakdown(100, 'writer_pays')
        self.assertEqual(b['artist_net'], Decimal('100.00'))
        self.assertEqual(b['platform_fee'], Decimal('3.00'))
        self.assertEqual(b['writer_funded'], Decimal('103.00'))

    def test_500_dollar_milestone(self):
        b = calculate_escrow_release_breakdown(500, 'writer_pays')
        self.assertEqual(b['artist_net'], Decimal('500.00'))
        self.assertEqual(b['platform_fee'], Decimal('15.00'))
        self.assertEqual(b['writer_funded'], Decimal('515.00'))

    def test_platform_always_gets_3_percent(self):
        """Platform fee = milestone * 0.03 regardless."""
        for amount in [1, 50, 100, 333.33, 10000]:
            b = calculate_escrow_release_breakdown(amount, 'writer_pays')
            expected_fee = (Decimal(str(amount)) * Decimal('0.03')).quantize(Decimal('0.01'))
            self.assertEqual(b['platform_fee'], expected_fee, f"Failed for ${amount}")

    def test_artist_always_gets_full_milestone(self):
        for amount in [1, 50, 100, 333.33, 10000]:
            b = calculate_escrow_release_breakdown(amount, 'writer_pays')
            self.assertEqual(b['artist_net'], Decimal(str(amount)), f"Failed for ${amount}")

    def test_accounting_identity(self):
        """writer_funded = artist_net + platform_fee."""
        for amount in [1, 50, 100, 333.33, 10000]:
            b = calculate_escrow_release_breakdown(amount, 'writer_pays')
            self.assertEqual(
                b['writer_funded'],
                b['artist_net'] + b['platform_fee'],
                f"Accounting mismatch for ${amount}"
            )


class ArtistPaysFeeTest(TestCase):
    """Artist absorbs the full 3% fee — writer funds exact milestone amount."""

    def test_100_dollar_milestone(self):
        b = calculate_escrow_release_breakdown(100, 'artist_pays')
        self.assertEqual(b['artist_net'], Decimal('97.00'))
        self.assertEqual(b['platform_fee'], Decimal('3.00'))
        self.assertEqual(b['writer_funded'], Decimal('100.00'))

    def test_accounting_identity(self):
        """writer_funded = artist_net + platform_fee."""
        for amount in [1, 50, 100, 333.33, 10000]:
            b = calculate_escrow_release_breakdown(amount, 'artist_pays')
            self.assertEqual(
                b['writer_funded'],
                b['artist_net'] + b['platform_fee'],
                f"Accounting mismatch for ${amount}"
            )


class SplitFeeTest(TestCase):
    """Both sides split the 3% fee — 1.5% each."""

    def test_100_dollar_milestone(self):
        """$100 milestone: writer funds $101.50, artist gets $98.50, platform $3."""
        b = calculate_escrow_release_breakdown(100, 'split')
        self.assertEqual(b['platform_fee'], Decimal('3.00'))
        self.assertEqual(b['artist_net'], Decimal('98.50'))
        self.assertEqual(b['writer_funded'], Decimal('101.50'))

    def test_500_dollar_milestone(self):
        b = calculate_escrow_release_breakdown(500, 'split')
        self.assertEqual(b['platform_fee'], Decimal('15.00'))
        self.assertEqual(b['artist_net'], Decimal('492.50'))
        self.assertEqual(b['writer_funded'], Decimal('507.50'))

    def test_platform_always_gets_3_percent(self):
        """Platform fee = milestone * 0.03 regardless of split."""
        for amount in [1, 50, 100, 333.33, 10000]:
            b = calculate_escrow_release_breakdown(amount, 'split')
            expected_fee = (Decimal(str(amount)) * Decimal('0.03')).quantize(Decimal('0.01'))
            self.assertEqual(b['platform_fee'], expected_fee, f"Failed for ${amount}")

    def test_accounting_identity(self):
        """writer_funded = artist_net + platform_fee."""
        for amount in [1, 50, 100, 333.33, 10000]:
            b = calculate_escrow_release_breakdown(amount, 'split')
            self.assertEqual(
                b['writer_funded'],
                b['artist_net'] + b['platform_fee'],
                f"Accounting mismatch for ${amount}"
            )

    def test_odd_fee_rounding(self):
        """$33.33: fee=$1.00, half_fee=$0.50. Both sides pay $0.50."""
        b = calculate_escrow_release_breakdown('33.33', 'split')
        self.assertEqual(b['platform_fee'], Decimal('1.00'))
        # Writer pays $0.50 extra, artist loses $0.50
        self.assertEqual(b['writer_funded'], Decimal('33.83'))
        self.assertEqual(b['artist_net'], Decimal('32.83'))
        # Accounting: writer_funded = artist_net + platform_fee
        self.assertEqual(b['writer_funded'], b['artist_net'] + b['platform_fee'])


class EscrowFundingTotalTest(TestCase):
    """Test calculate_escrow_funding_total — what the writer deposits."""

    def test_writer_pays_funding(self):
        """Writer funds 103% of contract amount."""
        total = calculate_escrow_funding_total(Decimal('500.00'), 'writer_pays')
        self.assertEqual(total, Decimal('515.00'))

    def test_artist_pays_funding(self):
        """Writer funds exactly the contract amount."""
        total = calculate_escrow_funding_total(Decimal('500.00'), 'artist_pays')
        self.assertEqual(total, Decimal('500.00'))

    def test_split_funding(self):
        """Writer funds 101.5% of contract amount."""
        total = calculate_escrow_funding_total(Decimal('500.00'), 'split')
        self.assertEqual(total, Decimal('507.50'))

    def test_funding_matches_sum_of_task_releases(self):
        """Total funding = sum of per-task writer_funded amounts."""
        # Simulate 5 tasks at $100 each = $500 total
        task_amounts = [Decimal('100.00')] * 5
        for mode in ['writer_pays', 'artist_pays', 'split']:
            funding_total = calculate_escrow_funding_total(Decimal('500.00'), mode)
            release_sum = sum(
                calculate_escrow_release_breakdown(amt, mode)['writer_funded']
                for amt in task_amounts
            )
            self.assertEqual(
                funding_total, release_sum,
                f"Funding total doesn't match sum of releases for {mode}"
            )

    def test_platform_collects_3_percent_across_all_releases(self):
        """Regardless of mode, platform gets 3% of total_contract_amount."""
        task_amounts = [Decimal('100.00')] * 5  # $500 total
        for mode in ['writer_pays', 'artist_pays', 'split']:
            total_platform = sum(
                calculate_escrow_release_breakdown(amt, mode)['platform_fee']
                for amt in task_amounts
            )
            self.assertEqual(
                total_platform, Decimal('15.00'),  # 500 * 0.03
                f"Platform didn't get 3% for {mode}"
            )

    def test_refund_returns_writer_funded_amount(self):
        """On refund, writer gets back exactly what they funded per task."""
        for mode in ['writer_pays', 'artist_pays', 'split']:
            b = calculate_escrow_release_breakdown(100, mode)
            # Refund = writer_funded (what was held in escrow for this task)
            refund = b['writer_funded']
            if mode == 'writer_pays':
                self.assertEqual(refund, Decimal('103.00'))
            elif mode == 'artist_pays':
                self.assertEqual(refund, Decimal('100.00'))
            elif mode == 'split':
                self.assertEqual(refund, Decimal('101.50'))


class CrossModeConsistencyTest(TestCase):
    """Verify invariants hold across all modes."""

    def test_platform_fee_identical_across_modes(self):
        """Platform always gets the same fee regardless of who pays."""
        for amount in [Decimal('100'), Decimal('33.33'), Decimal('10000')]:
            fees = set()
            for mode in ['writer_pays', 'artist_pays', 'split']:
                b = calculate_escrow_release_breakdown(amount, mode)
                fees.add(b['platform_fee'])
            self.assertEqual(len(fees), 1, f"Platform fee differs across modes for ${amount}: {fees}")

    def test_no_money_lost_or_created(self):
        """writer_funded == artist_net + platform_fee for every mode and amount."""
        for amount in [Decimal('1'), Decimal('50'), Decimal('100'), Decimal('333.33'), Decimal('10000')]:
            for mode in ['writer_pays', 'artist_pays', 'split']:
                b = calculate_escrow_release_breakdown(amount, mode)
                self.assertEqual(
                    b['writer_funded'],
                    b['artist_net'] + b['platform_fee'],
                    f"Money leak: {mode} @ ${amount}"
                )

    def test_default_mode_is_artist_pays(self):
        """Calling without fee_mode defaults to artist_pays."""
        b = calculate_escrow_release_breakdown(100)
        self.assertEqual(b['fee_mode'], 'artist_pays')
        self.assertEqual(b['artist_net'], Decimal('97.00'))
        self.assertEqual(b['writer_funded'], Decimal('100.00'))
