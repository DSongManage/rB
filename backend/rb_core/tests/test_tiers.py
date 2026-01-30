"""
Tests for the creator tier system.

Covers:
1. Default tier is standard with 10% fee
2. Lifetime project sales credits full amount to all collaborators
3. Level progression thresholds
4. Tier never downgrades
5. Founding slot allocation when project crosses threshold
6. Founding slots are atomic (no over-allocation)
7. Project fee rate uses best collaborator tier
8. get_tier_progress returns correct dashboard data
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model

from rb_core.models import (
    UserProfile, CollaborativeProject, TierConfiguration,
    FoundingCreatorSlot, CollaboratorRole,
)
from rb_core import tier_service

User = get_user_model()


class TierTestBase(TestCase):
    """Base class with helpers for tier tests."""

    def setUp(self):
        # Create tier config
        TierConfiguration.objects.all().delete()
        self.config = TierConfiguration.objects.create(
            pk=1,
            founding_slots_total=50,
            founding_threshold=Decimal('100.00'),
            level_thresholds={
                'level_1': 500, 'level_2': 1000, 'level_3': 2500,
                'level_4': 5000, 'level_5': 10000,
            },
            fee_rates={
                'founding': '0.01', 'level_5': '0.05', 'level_4': '0.06',
                'level_3': '0.07', 'level_2': '0.08', 'level_1': '0.09',
                'standard': '0.10',
            },
        )

    def _make_user(self, username, tier='standard', lifetime_sales=0):
        user = User.objects.create_user(username=username, password='testpass')
        profile = UserProfile.objects.create(
            user=user,
            username=username,
            tier=tier,
            lifetime_project_sales=Decimal(str(lifetime_sales)),
        )
        return user, profile

    def _make_project(self, creator, title='Test Project', total_sales=0):
        proj = CollaborativeProject.objects.create(
            title=title,
            content_type='book',
            created_by=creator,
            total_sales=Decimal(str(total_sales)),
        )
        CollaboratorRole.objects.create(
            project=proj,
            user=creator,
            role='creator',
            revenue_percentage=100,
            status='accepted',
        )
        return proj


class TestDefaultTier(TierTestBase):
    """1. Default tier is standard with 10% fee."""

    def test_new_user_is_standard(self):
        user, profile = self._make_user('alice')
        self.assertEqual(profile.tier, 'standard')

    def test_standard_fee_rate(self):
        user, _ = self._make_user('alice')
        rate = tier_service.get_creator_fee_rate(user)
        self.assertEqual(rate, Decimal('0.10'))


class TestLifetimeSalesCrediting(TierTestBase):
    """2. Full sale amount credited to ALL collaborators."""

    def test_all_collaborators_credited(self):
        user1, _ = self._make_user('alice')
        user2, _ = self._make_user('bob')

        proj = CollaborativeProject.objects.create(
            title='Collab', content_type='book', created_by=user1,
        )
        CollaboratorRole.objects.create(
            project=proj, user=user1, role='writer',
            revenue_percentage=60, status='accepted',
        )
        CollaboratorRole.objects.create(
            project=proj, user=user2, role='artist',
            revenue_percentage=40, status='accepted',
        )

        # Mock item with get_collaborators_with_wallets
        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user1, 'wallet': 'w1', 'percentage': 60},
            {'user': user2, 'wallet': 'w2', 'percentage': 40},
        ]
        # Mock _get_project_for_item to return our project
        with patch.object(tier_service, '_get_project_for_item', return_value=proj):
            tier_service.process_sale_for_tiers(None, item, Decimal('50.00'))

        # Both get the FULL amount credited
        p1 = UserProfile.objects.get(user=user1)
        p2 = UserProfile.objects.get(user=user2)
        self.assertEqual(p1.lifetime_project_sales, Decimal('50.00'))
        self.assertEqual(p2.lifetime_project_sales, Decimal('50.00'))


class TestLevelProgression(TierTestBase):
    """3. Level progression thresholds."""

    def test_upgrade_to_level_1(self):
        user, profile = self._make_user('alice')
        proj = self._make_project(user)

        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user, 'wallet': 'w1', 'percentage': 100},
        ]
        with patch.object(tier_service, '_get_project_for_item', return_value=proj):
            tier_service.process_sale_for_tiers(None, item, Decimal('500.00'))

        profile.refresh_from_db()
        self.assertEqual(profile.tier, 'level_1')

    def test_upgrade_to_level_5(self):
        user, profile = self._make_user('alice', lifetime_sales=9000)
        proj = self._make_project(user)

        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user, 'wallet': 'w1', 'percentage': 100},
        ]
        with patch.object(tier_service, '_get_project_for_item', return_value=proj):
            tier_service.process_sale_for_tiers(None, item, Decimal('1000.00'))

        profile.refresh_from_db()
        self.assertEqual(profile.tier, 'level_5')


class TestNoDowngrade(TierTestBase):
    """4. Tier never downgrades."""

    def test_no_downgrade(self):
        user, profile = self._make_user('alice', tier='level_3', lifetime_sales=2500)
        # Process a small sale — shouldn't downgrade from level_3
        proj = self._make_project(user)
        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user, 'wallet': 'w1', 'percentage': 100},
        ]
        with patch.object(tier_service, '_get_project_for_item', return_value=proj):
            tier_service.process_sale_for_tiers(None, item, Decimal('1.00'))

        profile.refresh_from_db()
        self.assertEqual(profile.tier, 'level_3')


class TestFoundingSlotAllocation(TierTestBase):
    """5. Founding slot allocation when project crosses threshold."""

    def test_founding_slot_claimed(self):
        user, profile = self._make_user('alice')
        proj = self._make_project(user, total_sales=90)

        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user, 'wallet': 'w1', 'percentage': 100},
        ]
        with patch.object(tier_service, '_get_project_for_item', return_value=proj):
            tier_service.process_sale_for_tiers(None, item, Decimal('15.00'))

        profile.refresh_from_db()
        self.assertEqual(profile.tier, 'founding')
        self.assertTrue(FoundingCreatorSlot.objects.filter(user=user).exists())

        self.config.refresh_from_db()
        self.assertEqual(self.config.founding_slots_claimed, 1)


class TestFoundingAtomic(TierTestBase):
    """6. Founding slots don't over-allocate."""

    def test_no_over_allocation(self):
        # Set only 1 slot remaining
        self.config.founding_slots_total = 1
        self.config.save()

        user1, _ = self._make_user('alice')
        user2, _ = self._make_user('bob')

        proj = CollaborativeProject.objects.create(
            title='Collab2', content_type='book', created_by=user1,
            total_sales=Decimal('90'),
        )
        CollaboratorRole.objects.create(
            project=proj, user=user1, role='writer',
            revenue_percentage=50, status='accepted',
        )
        CollaboratorRole.objects.create(
            project=proj, user=user2, role='artist',
            revenue_percentage=50, status='accepted',
        )

        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user1, 'wallet': 'w1', 'percentage': 50},
            {'user': user2, 'wallet': 'w2', 'percentage': 50},
        ]
        with patch.object(tier_service, '_get_project_for_item', return_value=proj):
            tier_service.process_sale_for_tiers(None, item, Decimal('15.00'))

        # Only 1 slot was available, so only 1 user gets founding
        founding_count = FoundingCreatorSlot.objects.count()
        self.assertEqual(founding_count, 1)

        self.config.refresh_from_db()
        self.assertEqual(self.config.founding_slots_claimed, 1)


class TestProjectFeeRate(TierTestBase):
    """7. Project fee rate uses best (lowest) collaborator tier."""

    def test_best_tier_wins(self):
        user1, _ = self._make_user('alice', tier='level_3')  # 7%
        user2, _ = self._make_user('bob', tier='standard')   # 10%

        item = MagicMock()
        item.get_collaborators_with_wallets.return_value = [
            {'user': user1, 'wallet': 'w1', 'percentage': 50},
            {'user': user2, 'wallet': 'w2', 'percentage': 50},
        ]

        rate = tier_service.get_project_fee_rate(item)
        self.assertEqual(rate, Decimal('0.07'))  # level_3 rate


class TestTierProgress(TierTestBase):
    """8. get_tier_progress returns correct dashboard data."""

    def test_standard_progress(self):
        user, _ = self._make_user('alice', lifetime_sales=200)
        data = tier_service.get_tier_progress(user)

        self.assertEqual(data['tier'], 'standard')
        self.assertEqual(data['fee_rate'], '0.10')
        self.assertEqual(data['lifetime_project_sales'], '200')
        self.assertEqual(data['next_level'], 'level_1')
        self.assertEqual(data['next_threshold'], '500')
        self.assertFalse(data['is_founding'])

    def test_founding_progress(self):
        user, profile = self._make_user('alice', tier='founding', lifetime_sales=150)
        proj = self._make_project(user)
        FoundingCreatorSlot.objects.create(
            user=user, project=proj, qualifying_sale_amount=Decimal('100'),
        )

        data = tier_service.get_tier_progress(user)
        self.assertEqual(data['tier'], 'founding')
        self.assertEqual(data['fee_rate'], '0.01')
        self.assertTrue(data['is_founding'])
        self.assertIsNotNone(data['founding_slot'])
