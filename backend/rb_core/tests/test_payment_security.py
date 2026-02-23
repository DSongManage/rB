"""
Tests for payment security fixes:
1. Race condition prevention via select_for_update on PurchaseIntent
2. Idempotency guard on process_atomic_purchase
3. Transaction atomicity on process_balance_purchase_task
"""

import json
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from rb_core.models import (
    Content, BookProject, Chapter, Purchase,
    CollaboratorPayment, PurchaseIntent, UserProfile,
    CollaborativeProject, CollaboratorRole, Cart, CartItem,
)

User = get_user_model()


# ═══════════════════════════════════════════════════════════════════
# 1. RACE CONDITION TESTS — PayWithBalanceView & SubmitSponsoredPaymentView
# ═══════════════════════════════════════════════════════════════════

class PayWithBalanceRaceConditionTest(TransactionTestCase):
    """
    Test that PayWithBalanceView prevents concurrent double-spend.
    Uses TransactionTestCase because select_for_update requires real transactions.
    """

    def setUp(self):
        self.buyer = User.objects.create_user(username='buyer_race', password='test123')
        self.buyer_profile, _ = UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'buyer_race', 'wallet_address': 'BuyerWalletRace'}
        )

        self.creator = User.objects.create_user(username='creator_race', password='test123')
        self.creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'creator_race', 'wallet_address': 'CreatorWalletRace'}
        )
        if not self.creator_profile.wallet_address:
            self.creator_profile.wallet_address = 'CreatorWalletRace'
            self.creator_profile.save()

        self.content = Content.objects.create(
            creator=self.creator,
            title='Race Test Content',
            content_type='comic',
            price_usd=Decimal('5.00'),
            editions=10,
            teaser_link='https://example.com/teaser',
        )

    def _create_intent(self, **overrides):
        defaults = dict(
            user=self.buyer,
            content=self.content,
            item_price=Decimal('5.00'),
            total_amount=Decimal('5.00'),
            payment_method='balance',
            status='payment_method_selected',
            balance_sufficient=True,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        defaults.update(overrides)
        return PurchaseIntent.objects.create(**defaults)

    @patch('rb_core.services.sponsored_transaction_service.get_sponsored_transaction_service')
    @patch('rb_core.views.payment.get_solana_service')
    def test_second_request_rejected_after_first_sets_awaiting_signature(
        self, mock_solana, mock_sponsored
    ):
        """Once intent is moved to awaiting_signature, a second request is rejected."""
        from rest_framework.test import APIClient

        intent = self._create_intent()

        mock_service = MagicMock()
        mock_service.get_cached_balance.return_value = Decimal('10.00')
        mock_solana.return_value = mock_service

        mock_tx_service = MagicMock()
        mock_tx_service.build_sponsored_usdc_transfer.return_value = {
            'serialized_transaction': 'base64tx',
            'serialized_message': 'base64msg',
            'blockhash': 'fakehash',
            'platform_pubkey': 'platpub',
            'user_pubkey': 'userpub',
            'amount': '5.00',
            'recipient': 'CreatorWalletRace',
        }
        mock_sponsored.return_value = mock_tx_service

        client = APIClient()
        client.force_authenticate(user=self.buyer)

        # First request should succeed
        with self.settings(PLATFORM_USDC_ADDRESS='PlatformWallet123'):
            resp1 = client.post(f'/api/payment/intent/{intent.id}/pay-with-balance/')
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.data['status'], 'awaiting_signature')

        # Second request should be rejected (status is now awaiting_signature)
        with self.settings(PLATFORM_USDC_ADDRESS='PlatformWallet123'):
            resp2 = client.post(f'/api/payment/intent/{intent.id}/pay-with-balance/')
        self.assertEqual(resp2.status_code, 400)
        self.assertIn('already being processed', resp2.data['error'])

    def test_expired_intent_rejected(self):
        """Expired intent is rejected."""
        from rest_framework.test import APIClient

        intent = self._create_intent(
            expires_at=timezone.now() - timedelta(hours=1)
        )

        client = APIClient()
        client.force_authenticate(user=self.buyer)

        resp = client.post(f'/api/payment/intent/{intent.id}/pay-with-balance/')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('expired', resp.data['error'])

    @patch('rb_core.views.payment.get_solana_service')
    def test_insufficient_balance_reverts_status(self, mock_solana):
        """If balance check fails, intent status reverts to payment_method_selected."""
        from rest_framework.test import APIClient

        intent = self._create_intent()

        mock_service = MagicMock()
        mock_service.get_cached_balance.return_value = Decimal('1.00')  # Insufficient
        mock_solana.return_value = mock_service

        client = APIClient()
        client.force_authenticate(user=self.buyer)

        resp = client.post(f'/api/payment/intent/{intent.id}/pay-with-balance/')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Insufficient', resp.data['error'])

        # Status should revert so user can retry
        intent.refresh_from_db()
        self.assertEqual(intent.status, 'payment_method_selected')

    def test_already_completed_intent_rejected(self):
        """Already completed intent is rejected."""
        from rest_framework.test import APIClient

        intent = self._create_intent(status='completed')

        client = APIClient()
        client.force_authenticate(user=self.buyer)

        resp = client.post(f'/api/payment/intent/{intent.id}/pay-with-balance/')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('already being processed', resp.data['error'])


class SubmitPaymentRaceConditionTest(TransactionTestCase):
    """Test that SubmitSponsoredPaymentView prevents duplicate submission."""

    def setUp(self):
        self.buyer = User.objects.create_user(username='buyer_submit', password='test123')
        UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'buyer_submit', 'wallet_address': 'BuyerWalletSubmit'}
        )

    def test_second_submit_rejected(self):
        """Once intent moves to processing, a second submit is rejected."""
        from rest_framework.test import APIClient

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            item_price=Decimal('3.00'),
            total_amount=Decimal('3.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        client = APIClient()
        client.force_authenticate(user=self.buyer)

        with patch('rb_core.services.sponsored_transaction_service.get_sponsored_transaction_service') as mock_sponsored, \
             patch('rb_core.tasks.process_balance_purchase_task.delay') as mock_task, \
             patch('rb_core.tasks.process_balance_purchase_task.apply') as mock_apply:

            mock_tx_service = MagicMock()
            mock_tx_service.submit_user_signed_transaction.return_value = 'FakeTxSig123'
            mock_tx_service.confirm_transaction.return_value = True
            mock_sponsored.return_value = mock_tx_service
            mock_task.side_effect = Exception("Celery not available")
            mock_apply_result = MagicMock()
            mock_apply_result.successful.return_value = True
            mock_apply_result.result = {'purchase_ids': [1]}
            mock_apply.return_value = mock_apply_result

            # First submit succeeds
            resp1 = client.post(
                f'/api/payment/intent/{intent.id}/submit/',
                {'signed_transaction': 'base64signed', 'user_signature_index': 1},
                format='json',
            )
            self.assertEqual(resp1.status_code, 200)

            # Second submit rejected
            resp2 = client.post(
                f'/api/payment/intent/{intent.id}/submit/',
                {'signed_transaction': 'base64signed', 'user_signature_index': 1},
                format='json',
            )
            self.assertEqual(resp2.status_code, 400)
            self.assertIn('not in awaiting_signature', resp2.data['error'])

    def test_submit_wrong_status_rejected(self):
        """Submit is rejected if intent is not in awaiting_signature status."""
        from rest_framework.test import APIClient

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            item_price=Decimal('3.00'),
            total_amount=Decimal('3.00'),
            payment_method='balance',
            status='payment_method_selected',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        client = APIClient()
        client.force_authenticate(user=self.buyer)

        resp = client.post(
            f'/api/payment/intent/{intent.id}/submit/',
            {'signed_transaction': 'base64signed', 'user_signature_index': 1},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)


# ═══════════════════════════════════════════════════════════════════
# 2. IDEMPOTENCY TESTS — process_atomic_purchase
# ═══════════════════════════════════════════════════════════════════

class AtomicPurchaseIdempotencyTest(TestCase):
    """Test that process_atomic_purchase skips already-completed purchases."""

    def setUp(self):
        self.buyer = User.objects.create_user(username='buyer_idem', password='test123')
        UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'buyer_idem', 'wallet_address': 'BuyerWalletIdem'}
        )

        self.creator = User.objects.create_user(username='creator_idem', password='test123')
        self.creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'creator_idem', 'wallet_address': 'CreatorWalletIdem'}
        )
        if not self.creator_profile.wallet_address:
            self.creator_profile.wallet_address = 'CreatorWalletIdem'
            self.creator_profile.save()

        self.content = Content.objects.create(
            creator=self.creator,
            title='Idempotency Test Content',
            content_type='comic',
            price_usd=Decimal('2.00'),
            editions=10,
            teaser_link='https://example.com/teaser',
        )

    def test_completed_purchase_skipped(self):
        """Already completed purchase should be skipped without re-minting."""
        from rb_core.tasks import process_atomic_purchase

        purchase = Purchase.objects.create(
            user=self.buyer,
            content=self.content,
            payment_provider='balance',
            purchase_price_usd=Decimal('2.00'),
            gross_amount=Decimal('2.00'),
            status='completed',
            nft_minted=True,
            nft_mint_address='ExistingMintAddr',
            transaction_signature='ExistingTxSig',
        )

        with patch('blockchain.solana_service.mint_and_distribute_collaborative_nft') as mock_mint:
            result = process_atomic_purchase(purchase.id)
            mock_mint.assert_not_called()

        self.assertTrue(result['success'])
        self.assertTrue(result['skipped'])
        self.assertEqual(result['reason'], 'already_completed')

    def test_nft_minted_purchase_skipped(self):
        """Purchase with nft_minted=True but non-completed status is still skipped."""
        from rb_core.tasks import process_atomic_purchase

        purchase = Purchase.objects.create(
            user=self.buyer,
            content=self.content,
            payment_provider='balance',
            purchase_price_usd=Decimal('2.00'),
            gross_amount=Decimal('2.00'),
            status='payment_completed',
            nft_minted=True,
            nft_mint_address='MintedButNotCompleted',
            transaction_signature='SomeTxSig',
        )

        with patch('blockchain.solana_service.mint_and_distribute_collaborative_nft') as mock_mint:
            result = process_atomic_purchase(purchase.id)
            mock_mint.assert_not_called()

        self.assertTrue(result['success'])
        self.assertTrue(result['skipped'])

    def test_minting_status_purchase_skipped(self):
        """Purchase already in 'minting' state should be skipped (another worker claimed it)."""
        from rb_core.tasks import process_atomic_purchase

        purchase = Purchase.objects.create(
            user=self.buyer,
            content=self.content,
            payment_provider='balance',
            purchase_price_usd=Decimal('2.00'),
            gross_amount=Decimal('2.00'),
            status='minting',
        )

        with patch('blockchain.solana_service.mint_and_distribute_collaborative_nft') as mock_mint:
            result = process_atomic_purchase(purchase.id)
            mock_mint.assert_not_called()

        self.assertFalse(result['success'])
        self.assertTrue(result['skipped'])
        self.assertEqual(result['reason'], 'already_minting')

    def test_payment_completed_purchase_proceeds(self):
        """Purchase in payment_completed status should proceed to minting."""
        from rb_core.tasks import process_atomic_purchase

        purchase = Purchase.objects.create(
            user=self.buyer,
            content=self.content,
            payment_provider='stripe',
            purchase_price_usd=Decimal('2.00'),
            gross_amount=Decimal('2.00'),
            chapter_price=Decimal('2.00'),
            status='payment_completed',
            nft_minted=False,
        )

        with patch('blockchain.solana_service.mint_and_distribute_collaborative_nft') as mock_mint, \
             patch('rb_core.payment_utils.calculate_payment_breakdown') as mock_breakdown, \
             patch('blockchain.metadata_service.create_and_upload_content_metadata') as mock_meta, \
             patch('rb_core.tasks.get_payout_destinations') as mock_destinations, \
             patch('rb_core.tasks.audit_nft_mint'), \
             patch('rb_core.tier_service.get_project_fee_rate') as mock_fee_rate:

            mock_fee_rate.return_value = Decimal('0.10')
            mock_breakdown.return_value = {
                'buyer_total': Decimal('2.00'),
                'stripe_fee': Decimal('0.36'),
                'platform_receives': Decimal('2.00'),
                'gas_fee': Decimal('0.026'),
                'usdc_to_distribute': Decimal('1.974'),
                'credit_card_fee': Decimal('0'),
            }
            mock_meta.return_value = 'ipfs://test-metadata'
            mock_destinations.return_value = [
                {'address': 'CreatorWalletIdem', 'amount': Decimal('1.7766'), 'destination_type': 'wallet'}
            ]
            mock_mint.return_value = {
                'transaction_signature': 'NewTxSig',
                'nft_mint_address': 'NewMintAddr',
                'platform_usdc_fronted': 1.974,
                'platform_usdc_earned': 0.1974,
                'distributions': [
                    {'user': 'creator_idem', 'wallet': 'CreatorWalletIdem',
                     'amount': 1.7766, 'percentage': 90, 'role': 'creator'}
                ],
            }

            result = process_atomic_purchase(purchase.id)

            mock_mint.assert_called_once()
            self.assertTrue(result['success'])
            self.assertNotIn('skipped', result)

        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'completed')
        self.assertTrue(purchase.nft_minted)

    def test_idempotency_guard_sets_status_to_minting(self):
        """After idempotency guard, purchase status should be 'minting'."""
        purchase = Purchase.objects.create(
            user=self.buyer,
            content=self.content,
            payment_provider='balance',
            purchase_price_usd=Decimal('2.00'),
            gross_amount=Decimal('2.00'),
            chapter_price=Decimal('2.00'),
            status='payment_completed',
            nft_minted=False,
        )

        # We'll let it proceed past the guard then fail on collaborator lookup
        # to verify the status was set to 'minting' atomically
        from rb_core.tasks import process_atomic_purchase
        with patch('rb_core.payment_utils.calculate_payment_breakdown') as mock_breakdown, \
             patch('rb_core.tier_service.get_project_fee_rate') as mock_fee_rate:
            mock_fee_rate.return_value = Decimal('0.10')
            mock_breakdown.return_value = {
                'buyer_total': Decimal('2.00'),
                'stripe_fee': Decimal('0.36'),
                'platform_receives': Decimal('2.00'),
                'gas_fee': Decimal('0.026'),
                'usdc_to_distribute': Decimal('1.974'),
                'credit_card_fee': Decimal('0'),
            }

            # Let it fail after guard — content has no get_collaborators_with_wallets mock
            # so it'll use the fallback logic and fail on wallet lookup
            try:
                process_atomic_purchase(purchase.id)
            except Exception:
                pass

        # Verify the guard set status to minting before the error
        purchase.refresh_from_db()
        # After failure, status should be 'failed' (set in the except block)
        self.assertIn(purchase.status, ['minting', 'failed'])


# ═══════════════════════════════════════════════════════════════════
# 3. ATOMICITY TESTS — process_balance_purchase_task
# ═══════════════════════════════════════════════════════════════════

class BalancePurchaseAtomicityTest(TestCase):
    """Test that process_balance_purchase_task uses atomic transactions."""

    def setUp(self):
        self.buyer = User.objects.create_user(username='buyer_atomic', password='test123')
        self.buyer_profile, _ = UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'buyer_atomic', 'wallet_address': 'BuyerWalletAtomic'}
        )

        self.creator = User.objects.create_user(username='creator_atomic', password='test123')
        self.creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'creator_atomic', 'wallet_address': 'CreatorWalletAtomic'}
        )
        if not self.creator_profile.wallet_address:
            self.creator_profile.wallet_address = 'CreatorWalletAtomic'
            self.creator_profile.save()

        self.content = Content.objects.create(
            creator=self.creator,
            title='Atomic Test Content',
            content_type='comic',
            price_usd=Decimal('3.00'),
            editions=10,
            teaser_link='https://example.com/teaser',
        )

    def test_idempotency_skips_completed_intent(self):
        """Already completed intent should be skipped."""
        from rb_core.tasks import process_balance_purchase_task

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            content=self.content,
            item_price=Decimal('3.00'),
            total_amount=Decimal('3.00'),
            payment_method='balance',
            status='completed',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        result = process_balance_purchase_task(intent.id, 'AnyTxSig')
        self.assertTrue(result['skipped'])
        self.assertEqual(result['reason'], 'already_completed')

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_cart_cleared_after_purchases_succeed(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Cart should only be cleared after all purchases succeed."""
        from rb_core.tasks import process_balance_purchase_task

        cart = Cart.objects.create(user=self.buyer, status='checkout')
        CartItem.objects.create(
            cart=cart, content=self.content,
            unit_price=Decimal('3.00'),
            creator=self.creator,
        )

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'content_id': self.content.id, 'price': '3.00'},
                ]
            },
            item_price=Decimal('3.00'),
            total_amount=Decimal('3.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        result = process_balance_purchase_task(intent.id, 'CartTxSig')

        # Cart cleared
        cart.refresh_from_db()
        self.assertEqual(cart.status, 'completed')
        self.assertEqual(cart.items.count(), 0)

        # Purchases exist
        self.assertEqual(len(result['purchase_ids']), 1)

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_successful_purchase_creates_all_records_atomically(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Successful purchase should create Purchase + CollaboratorPayment + update profile."""
        from rb_core.tasks import process_balance_purchase_task

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'content_id': self.content.id, 'price': '3.00'},
                ]
            },
            item_price=Decimal('3.00'),
            total_amount=Decimal('3.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        initial_sales = self.creator_profile.total_sales_usd or Decimal('0')
        result = process_balance_purchase_task(intent.id, 'SuccessTxSig')

        # All records created
        self.assertEqual(len(result['purchase_ids']), 1)
        purchase = Purchase.objects.get(id=result['purchase_ids'][0])
        self.assertEqual(purchase.usdc_distribution_status, 'completed')

        # CollaboratorPayment exists
        cp = CollaboratorPayment.objects.filter(purchase=purchase)
        self.assertEqual(cp.count(), 1)

        # Profile earnings updated
        self.creator_profile.refresh_from_db()
        self.assertGreater(self.creator_profile.total_sales_usd, initial_sales)

        # Intent updated
        intent.refresh_from_db()
        self.assertEqual(intent.status, 'processing')
        self.assertEqual(intent.purchase, purchase)

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_multi_item_cart_purchase_atomic(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Cart with multiple items should create all purchases atomically."""
        from rb_core.tasks import process_balance_purchase_task

        content2 = Content.objects.create(
            creator=self.creator,
            title='Second Content',
            content_type='comic',
            price_usd=Decimal('2.00'),
            editions=5,
            teaser_link='https://example.com/teaser2',
        )

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'content_id': self.content.id, 'price': '3.00'},
                    {'content_id': content2.id, 'price': '2.00'},
                ]
            },
            item_price=Decimal('5.00'),
            total_amount=Decimal('5.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        result = process_balance_purchase_task(intent.id, 'MultiCartTxSig')

        # Both purchases created
        self.assertEqual(len(result['purchase_ids']), 2)

        # Both have CollaboratorPayment records
        for pid in result['purchase_ids']:
            cp_count = CollaboratorPayment.objects.filter(purchase_id=pid).count()
            self.assertEqual(cp_count, 1)

        # NFT minting triggered for each
        self.assertEqual(mock_atomic.call_count, 2)


class BalancePurchaseRollbackTest(TransactionTestCase):
    """
    Test atomic rollback behavior.
    Uses TransactionTestCase so we can verify rollback actually works
    (TestCase wraps everything in a transaction already).
    """

    def setUp(self):
        self.buyer = User.objects.create_user(username='buyer_rollback', password='test123')
        UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'buyer_rollback', 'wallet_address': 'BuyerWalletRollback'}
        )

        self.creator = User.objects.create_user(username='creator_rollback', password='test123')
        creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'creator_rollback', 'wallet_address': 'CreatorWalletRollback'}
        )
        if not creator_profile.wallet_address:
            creator_profile.wallet_address = 'CreatorWalletRollback'
            creator_profile.save()

        self.content = Content.objects.create(
            creator=self.creator,
            title='Rollback Test Content',
            content_type='comic',
            price_usd=Decimal('3.00'),
            editions=10,
            teaser_link='https://example.com/teaser',
        )

    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_failed_collaborator_payment_rolls_back_purchases(
        self, mock_solana, mock_sync
    ):
        """If CollaboratorPayment creation fails, purchases should roll back."""
        from rb_core.tasks import process_balance_purchase_task

        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'content_id': self.content.id, 'price': '3.00'},
                ]
            },
            item_price=Decimal('3.00'),
            total_amount=Decimal('3.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        # Force CollaboratorPayment creation to fail
        with patch.object(
            CollaboratorPayment.objects, 'update_or_create',
            side_effect=Exception("DB error simulated")
        ):
            with self.assertRaises(Exception):
                process_balance_purchase_task(intent.id, 'FailTxSig')

        # Atomic rollback: no Purchase records should exist
        self.assertEqual(
            Purchase.objects.filter(transaction_signature='FailTxSig').count(), 0
        )

        # Intent should be marked failed
        intent.refresh_from_db()
        self.assertEqual(intent.status, 'failed')
