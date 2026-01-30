"""
Tests for collaborator search tier filtering.

1. Search with tier filter returns only matching tiers
2. Search results include tier and fee_percent
3. Sort by tier orders correctly (founding first)
4. Multiple tier filters work together
"""

from decimal import Decimal
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model

from rb_core.models import UserProfile, TierConfiguration
from rb_core.views import UserSearchView

User = get_user_model()


class TierSearchTestBase(TestCase):
    def setUp(self):
        TierConfiguration.objects.all().delete()
        TierConfiguration.objects.create(
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
        self.factory = RequestFactory()
        self.view = UserSearchView.as_view()

        # Create test users with different tiers
        self._make_user('alice', 'founding')
        self._make_user('bob', 'level_5')
        self._make_user('charlie', 'level_3')
        self._make_user('diana', 'standard')
        self._make_user('eve', 'level_1')

    def _make_user(self, username, tier):
        user = User.objects.create_user(username=username, password='testpass')
        UserProfile.objects.create(
            user=user,
            username=username,
            tier=tier,
            is_private=False,
        )
        return user

    def _search(self, **params):
        request = self.factory.get('/api/users/search/', params)
        request.user = None  # anonymous
        # Make request.user.is_authenticated work
        from django.contrib.auth.models import AnonymousUser
        request.user = AnonymousUser()
        response = self.view(request)
        return response.data


class TestTierFilter(TierSearchTestBase):
    """1. Search with tier filter returns only matching tiers."""

    def test_single_tier_filter(self):
        data = self._search(tier='founding')
        usernames = [r['username'] for r in data['results']]
        self.assertEqual(usernames, ['alice'])

    def test_filter_excludes_non_matching(self):
        data = self._search(tier='level_5')
        usernames = [r['username'] for r in data['results']]
        self.assertEqual(usernames, ['bob'])
        self.assertNotIn('alice', usernames)
        self.assertNotIn('diana', usernames)


class TestTierInResults(TierSearchTestBase):
    """2. Search results include tier and fee_percent."""

    def test_results_have_tier_and_fee(self):
        data = self._search()
        for result in data['results']:
            self.assertIn('tier', result)
            self.assertIn('fee_percent', result)

    def test_founding_fee_percent(self):
        data = self._search(tier='founding')
        self.assertEqual(data['results'][0]['fee_percent'], '1%')

    def test_standard_fee_percent(self):
        data = self._search(tier='standard')
        self.assertEqual(data['results'][0]['fee_percent'], '10%')


class TestTierSort(TierSearchTestBase):
    """3. Sort by tier orders correctly (founding first)."""

    def test_sort_by_tier(self):
        data = self._search(sort='tier')
        tiers = [r['tier'] for r in data['results']]
        expected_order = ['founding', 'level_5', 'level_3', 'level_1', 'standard']
        self.assertEqual(tiers, expected_order)

    def test_default_sort_is_alphabetical(self):
        data = self._search()
        usernames = [r['username'] for r in data['results']]
        self.assertEqual(usernames, sorted(usernames))


class TestMultipleTierFilters(TierSearchTestBase):
    """4. Multiple tier filters work together."""

    def test_two_tier_filters(self):
        data = self._search(tier='founding,level_5')
        usernames = set(r['username'] for r in data['results'])
        self.assertEqual(usernames, {'alice', 'bob'})

    def test_three_tier_filters(self):
        data = self._search(tier='founding,level_5,level_1')
        usernames = set(r['username'] for r in data['results'])
        self.assertEqual(usernames, {'alice', 'bob', 'eve'})

    def test_invalid_tier_ignored(self):
        data = self._search(tier='founding,INVALID_TIER')
        usernames = [r['username'] for r in data['results']]
        self.assertEqual(usernames, ['alice'])
