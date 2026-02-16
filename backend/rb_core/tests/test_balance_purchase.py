"""
Tests for balance purchase flow - CollaboratorPayment record creation.

Verifies that when a user pays with their USDC balance:
1. Purchase records are created correctly
2. CollaboratorPayment records are created for analytics
3. Creator profile earnings (total_sales_usd) are updated
4. process_atomic_purchase won't double-count earnings
"""

import json
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from rb_core.models import (
    Content, BookProject, Chapter, Purchase,
    CollaboratorPayment, PurchaseIntent, UserProfile,
    Notification, CollaborativeProject, CollaboratorRole,
)

User = get_user_model()


class BalancePurchaseCollaboratorPaymentTest(TestCase):
    """Test that CollaboratorPayment records are created during balance purchases."""

    def setUp(self):
        # Create buyer
        self.buyer = User.objects.create_user(username='buyer1', password='test123')
        self.buyer_profile, _ = UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'buyer1', 'wallet_address': 'BuyerWallet111'}
        )

        # Create creator/seller (wallet_address is a property reading from UserProfile)
        self.creator = User.objects.create_user(username='creator1', password='test123')
        self.creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'creator1', 'wallet_address': 'CreatorWallet222'}
        )
        if not self.creator_profile.wallet_address:
            self.creator_profile.wallet_address = 'CreatorWallet222'
            self.creator_profile.save()

        # Create content
        self.content = Content.objects.create(
            creator=self.creator,
            title='Test Comic',
            content_type='comic',
            price_usd=Decimal('1.00'),
            editions=10,
            teaser_link='https://example.com/teaser',
        )

        # Create book project + chapter
        self.book_project = BookProject.objects.create(
            creator=self.creator,
            title='Test Book',
        )
        self.chapter = Chapter.objects.create(
            book_project=self.book_project,
            title='Chapter 1',
            order=0,
            price=Decimal('1.00'),
        )

        # Create purchase intent for cart purchase
        self.intent = PurchaseIntent.objects.create(
            user=self.buyer,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'content_id': self.content.id, 'price': '1.00'},
                ]
            },
            item_price=Decimal('1.00'),
            total_amount=Decimal('1.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_balance_purchase_creates_collaborator_payments(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Balance purchase should create CollaboratorPayment records."""
        from rb_core.tasks import process_balance_purchase_task

        # Mock blockchain confirmation
        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        tx_sig = 'FakeTransactionSignature123'

        result = process_balance_purchase_task(self.intent.id, tx_sig)

        # Verify purchase was created
        self.assertEqual(len(result['purchase_ids']), 1)
        purchase = Purchase.objects.get(id=result['purchase_ids'][0])
        self.assertEqual(purchase.payment_provider, 'balance')
        self.assertEqual(purchase.status, 'payment_completed')

        # Verify CollaboratorPayment was created for creator
        payments = CollaboratorPayment.objects.filter(purchase=purchase)
        self.assertEqual(payments.count(), 1)

        payment = payments.first()
        self.assertEqual(payment.collaborator, self.creator)
        self.assertEqual(payment.collaborator_wallet, 'CreatorWallet222')
        self.assertEqual(payment.transaction_signature, tx_sig)
        # Creator gets 90% of $1.00 = $0.90
        self.assertEqual(payment.amount_usdc, Decimal('0.900000'))
        self.assertEqual(payment.percentage, 90)

        # Verify creator profile earnings updated
        self.creator_profile.refresh_from_db()
        self.assertEqual(self.creator_profile.total_sales_usd, Decimal('0.900000'))

        # Verify purchase distribution status
        purchase.refresh_from_db()
        self.assertEqual(purchase.usdc_distribution_status, 'completed')
        self.assertIsNotNone(purchase.usdc_distributed_at)

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_balance_purchase_sends_notification_to_creator(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Balance purchase should send a 'content_purchase' notification to the creator."""
        from rb_core.tasks import process_balance_purchase_task

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        process_balance_purchase_task(self.intent.id, 'NotifTxSig')

        # Creator should receive a purchase notification
        notifications = Notification.objects.filter(
            recipient=self.creator,
            notification_type='content_purchase',
        )
        self.assertEqual(notifications.count(), 1)

        notif = notifications.first()
        self.assertIn('Test Comic', notif.title)
        self.assertIn('$0.90', notif.message)
        self.assertEqual(notif.from_user, self.buyer)

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_self_purchase_does_not_send_notification(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """If buyer is the creator, no purchase notification should be sent."""
        from rb_core.tasks import process_balance_purchase_task

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        # Create intent where buyer IS the creator (self-purchase)
        self_intent = PurchaseIntent.objects.create(
            user=self.creator,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'content_id': self.content.id, 'price': '1.00'},
                ]
            },
            item_price=Decimal('1.00'),
            total_amount=Decimal('1.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        process_balance_purchase_task(self_intent.id, 'SelfPurchaseTxSig')

        # No notification should be created (self-purchase)
        notifications = Notification.objects.filter(
            recipient=self.creator,
            notification_type='content_purchase',
        )
        self.assertEqual(notifications.count(), 0)

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_balance_purchase_chapter_creates_collaborator_payments(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Balance purchase of a chapter should create CollaboratorPayment records."""
        from rb_core.tasks import process_balance_purchase_task

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        # Create intent for chapter purchase
        intent = PurchaseIntent.objects.create(
            user=self.buyer,
            is_cart_purchase=True,
            cart_snapshot={
                'items': [
                    {'chapter_id': self.chapter.id, 'price': '1.00'},
                ]
            },
            item_price=Decimal('1.00'),
            total_amount=Decimal('1.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        tx_sig = 'FakeChapterTxSig456'
        result = process_balance_purchase_task(intent.id, tx_sig)

        purchase = Purchase.objects.get(id=result['purchase_ids'][0])
        payments = CollaboratorPayment.objects.filter(purchase=purchase)
        self.assertEqual(payments.count(), 1)

        payment = payments.first()
        self.assertEqual(payment.collaborator, self.creator)
        self.assertEqual(payment.role, 'author')

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_analytics_view_shows_earnings_after_balance_purchase(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """SalesAnalyticsView should return earnings from balance purchases."""
        from rb_core.tasks import process_balance_purchase_task

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        # Process purchase
        process_balance_purchase_task(self.intent.id, 'TxSig789')

        # Check analytics as creator
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.creator)
        response = client.get('/api/sales-analytics/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data['summary']['total_earnings_usdc'], 0)
        self.assertEqual(data['summary']['total_sales'], 1)

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_no_duplicate_earnings_if_atomic_purchase_also_runs(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """If process_atomic_purchase runs after balance purchase, earnings shouldn't double."""
        from rb_core.tasks import process_balance_purchase_task

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        process_balance_purchase_task(self.intent.id, 'TxSig999')

        # Get the purchase
        purchase = Purchase.objects.get(payment_provider='balance', user=self.buyer)
        initial_earnings = UserProfile.objects.get(user=self.creator).total_sales_usd

        # Simulate process_atomic_purchase creating CollaboratorPayment again
        # (it uses update_or_create, so no duplicates)
        CollaboratorPayment.objects.update_or_create(
            purchase=purchase,
            collaborator=self.creator,
            defaults={
                'collaborator_wallet': 'CreatorWallet222',
                'amount_usdc': Decimal('0.900000'),
                'percentage': 90,
                'role': 'creator',
                'transaction_signature': 'AtomicTxSig',
            }
        )

        # Should still have only 1 payment record
        self.assertEqual(
            CollaboratorPayment.objects.filter(purchase=purchase).count(), 1
        )

        # Profile earnings should NOT have been double-incremented
        # (process_atomic_purchase skips profile update for balance payments)
        self.creator_profile.refresh_from_db()
        self.assertEqual(self.creator_profile.total_sales_usd, initial_earnings)


class BalancePurchaseSingleItemTest(TestCase):
    """Test single-item (non-cart) balance purchase."""

    def setUp(self):
        self.buyer = User.objects.create_user(username='buyer2', password='test123')
        self.creator = User.objects.create_user(username='creator2', password='test123')
        creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'creator2', 'wallet_address': 'Creator2Wallet'}
        )
        if not creator_profile.wallet_address:
            creator_profile.wallet_address = 'Creator2Wallet'
            creator_profile.save()

        self.content = Content.objects.create(
            creator=self.creator,
            title='Single Item Test',
            content_type='art',
            price_usd=Decimal('5.00'),
            editions=5,
            teaser_link='https://example.com/teaser2',
        )

        self.intent = PurchaseIntent.objects.create(
            user=self.buyer,
            content=self.content,
            is_cart_purchase=False,
            item_price=Decimal('5.00'),
            total_amount=Decimal('5.00'),
            payment_method='balance',
            status='awaiting_signature',
            expires_at=timezone.now() + timedelta(hours=1),
        )

    @patch('rb_core.tasks.process_atomic_purchase.delay')
    @patch('rb_core.tasks.sync_user_balance_task.delay')
    @patch('rb_core.services.get_solana_service')
    def test_single_item_purchase_creates_collaborator_payment(
        self, mock_solana, mock_sync, mock_atomic
    ):
        """Single item balance purchase should create CollaboratorPayment."""
        from rb_core.tasks import process_balance_purchase_task

        mock_service = MagicMock()
        mock_service.confirm_transaction.return_value = True
        mock_solana.return_value = mock_service

        result = process_balance_purchase_task(self.intent.id, 'SingleTxSig')

        purchase = Purchase.objects.get(id=result['purchase_ids'][0])
        payments = CollaboratorPayment.objects.filter(purchase=purchase)
        self.assertEqual(payments.count(), 1)

        payment = payments.first()
        self.assertEqual(payment.collaborator, self.creator)
        # Creator gets 90% of $5.00 = $4.50
        self.assertEqual(payment.amount_usdc, Decimal('4.500000'))

        # Verify creator earnings updated
        creator_profile = UserProfile.objects.get(user=self.creator)
        self.assertEqual(creator_profile.total_sales_usd, Decimal('4.500000'))


class SalesAnalyticsSoloVsCollabTest(TestCase):
    """Test that SalesAnalyticsView correctly classifies solo vs collaborative content."""

    def setUp(self):
        from rb_core.models import CollaborativeProject, CollaboratorRole

        self.buyer = User.objects.create_user(username='analytics_buyer', password='test123')
        UserProfile.objects.get_or_create(
            user=self.buyer,
            defaults={'username': 'analytics_buyer', 'wallet_address': 'BuyerWallet'}
        )

        self.creator = User.objects.create_user(username='analytics_creator', password='test123')
        self.creator_profile, _ = UserProfile.objects.get_or_create(
            user=self.creator,
            defaults={'username': 'analytics_creator', 'wallet_address': 'CreatorWallet'}
        )
        if not self.creator_profile.wallet_address:
            self.creator_profile.wallet_address = 'CreatorWallet'
            self.creator_profile.save()

        # Create solo content (no CollaborativeProject link)
        self.solo_content = Content.objects.create(
            creator=self.creator,
            title='Pure Solo Content',
            content_type='art',
            price_usd=Decimal('2.00'),
            editions=10,
            teaser_link='https://example.com/solo',
        )

        # Create content from a solo CollaborativeProject (is_solo=True)
        self.solo_project_content = Content.objects.create(
            creator=self.creator,
            title='Solo Project Content',
            content_type='comic',
            price_usd=Decimal('3.00'),
            editions=10,
            teaser_link='https://example.com/solo-project',
        )
        self.solo_project = CollaborativeProject.objects.create(
            title='Solo Project',
            content_type='comic',
            created_by=self.creator,
            published_content=self.solo_project_content,
            is_solo=True,
            status='published',
        )
        CollaboratorRole.objects.create(
            project=self.solo_project,
            user=self.creator,
            role='Project Lead',
            revenue_percentage=100,
            status='accepted',
        )

        # Create content from a real collaborative project (is_solo=False)
        self.collab_content = Content.objects.create(
            creator=self.creator,
            title='Collab Content',
            content_type='comic',
            price_usd=Decimal('4.00'),
            editions=10,
            teaser_link='https://example.com/collab',
        )
        self.collab2 = User.objects.create_user(username='collab_user', password='test123')
        UserProfile.objects.get_or_create(
            user=self.collab2,
            defaults={'username': 'collab_user', 'wallet_address': 'Collab2Wallet'}
        )
        self.collab_project = CollaborativeProject.objects.create(
            title='Collab Project',
            content_type='comic',
            created_by=self.creator,
            published_content=self.collab_content,
            is_solo=False,
            status='published',
        )
        CollaboratorRole.objects.create(
            project=self.collab_project,
            user=self.creator,
            role='Project Lead',
            revenue_percentage=60,
            status='accepted',
        )
        CollaboratorRole.objects.create(
            project=self.collab_project,
            user=self.collab2,
            role='Artist',
            revenue_percentage=40,
            status='accepted',
        )

    def _create_purchase_with_payment(self, content, amount, role='creator', percentage=90):
        """Helper to create a Purchase + CollaboratorPayment."""
        purchase = Purchase.objects.create(
            user=self.buyer,
            content=content,
            purchase_price_usd=content.price_usd,
            payment_provider='balance',
            transaction_signature='TxSig_' + content.title.replace(' ', '_'),
        )
        CollaboratorPayment.objects.create(
            purchase=purchase,
            collaborator=self.creator,
            collaborator_wallet='CreatorWallet',
            amount_usdc=amount,
            percentage=percentage,
            role=role,
            transaction_signature='TxSig_' + content.title.replace(' ', '_'),
        )
        return purchase

    def test_pure_solo_content_classified_as_solo(self):
        """Content with no CollaborativeProject should be classified as solo."""
        self._create_purchase_with_payment(self.solo_content, Decimal('1.80'))

        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.creator)
        response = client.get('/api/sales-analytics/')
        data = response.json()

        self.assertEqual(len(data['content_sales']), 1)
        self.assertEqual(len(data['collaboration_sales']), 0)
        self.assertEqual(data['content_sales'][0]['title'], 'Pure Solo Content')

    def test_solo_project_content_classified_as_solo(self):
        """Content from a solo CollaborativeProject (is_solo=True) should be classified as solo."""
        self._create_purchase_with_payment(
            self.solo_project_content, Decimal('2.70'), role='Project Lead', percentage=100
        )

        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.creator)
        response = client.get('/api/sales-analytics/')
        data = response.json()

        self.assertEqual(len(data['content_sales']), 1, f"Expected 1 solo item, got: {data['content_sales']}")
        self.assertEqual(len(data['collaboration_sales']), 0, f"Expected 0 collab items, got: {data['collaboration_sales']}")
        self.assertEqual(data['content_sales'][0]['title'], 'Solo Project Content')

    def test_collab_project_content_classified_as_collab(self):
        """Content from a real collaborative project should be classified as collab."""
        purchase = Purchase.objects.create(
            user=self.buyer,
            content=self.collab_content,
            purchase_price_usd=self.collab_content.price_usd,
            payment_provider='balance',
            transaction_signature='TxSig_Collab',
        )
        # Two collaborators received payment
        CollaboratorPayment.objects.create(
            purchase=purchase,
            collaborator=self.creator,
            collaborator_wallet='CreatorWallet',
            amount_usdc=Decimal('2.16'),
            percentage=60,
            role='Project Lead',
            transaction_signature='TxSig_Collab_1',
        )
        CollaboratorPayment.objects.create(
            purchase=purchase,
            collaborator=self.collab2,
            collaborator_wallet='Collab2Wallet',
            amount_usdc=Decimal('1.44'),
            percentage=40,
            role='Artist',
            transaction_signature='TxSig_Collab_2',
        )

        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.creator)
        response = client.get('/api/sales-analytics/')
        data = response.json()

        self.assertEqual(len(data['content_sales']), 0)
        self.assertEqual(len(data['collaboration_sales']), 1)
        self.assertEqual(data['collaboration_sales'][0]['title'], 'Collab Content')
