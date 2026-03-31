"""
Tests for the Campaign (fundraising) system.

Verifies:
1. Campaign model lifecycle (draft → active → funded → transferred)
2. Campaign API endpoints (CRUD, launch, contribute, transfer)
3. Contribution flow (intent → confirm → update totals)
4. Goal detection and auto-funded transition
5. Failure/reclaim scenarios
6. Solo vs collaborative campaign differences
7. Celery task behavior (deadline checking, escrow creation window)
"""

from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from rb_core.models import (
    Campaign, CampaignContribution, CampaignUpdate,
    UserProfile, CollaborativeProject,
)

User = get_user_model()


class CampaignModelTest(TestCase):
    """Test Campaign model methods and properties."""

    def setUp(self):
        self.creator = User.objects.create_user(username='creator1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.creator, defaults={'username': 'creator1'}
        )
        self.campaign = Campaign.objects.create(
            creator=self.creator,
            title='Test Campaign',
            description='A test campaign',
            content_type='book',
            campaign_type='solo',
            funding_goal=Decimal('1000.00'),
            deadline=timezone.now() + timedelta(days=30),
            chapter_count=5,
        )

    def test_campaign_created_as_draft(self):
        self.assertEqual(self.campaign.status, 'draft')

    def test_funding_percentage_zero(self):
        self.assertEqual(self.campaign.funding_percentage, 0)

    def test_funding_percentage_partial(self):
        self.campaign.current_amount = Decimal('500.00')
        self.assertEqual(self.campaign.funding_percentage, 50)

    def test_funding_percentage_full(self):
        self.campaign.current_amount = Decimal('1000.00')
        self.assertEqual(self.campaign.funding_percentage, 100)

    def test_funding_percentage_over(self):
        self.campaign.current_amount = Decimal('1500.00')
        self.assertEqual(self.campaign.funding_percentage, 100)

    def test_is_goal_met_false(self):
        self.assertFalse(self.campaign.is_goal_met)

    def test_is_goal_met_true(self):
        self.campaign.current_amount = Decimal('1000.00')
        self.assertTrue(self.campaign.is_goal_met)

    def test_amount_per_chapter(self):
        self.assertEqual(self.campaign.amount_per_chapter, Decimal('200.00'))

    def test_amount_per_chapter_zero_chapters(self):
        self.campaign.chapter_count = 0
        self.assertEqual(self.campaign.amount_per_chapter, Decimal('0.00'))

    def test_mark_funded(self):
        self.campaign.mark_funded()
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'funded')
        self.assertIsNotNone(self.campaign.funded_at)
        self.assertIsNotNone(self.campaign.escrow_creation_deadline)
        # 60-day window
        delta = self.campaign.escrow_creation_deadline - self.campaign.funded_at
        self.assertAlmostEqual(delta.days, 60, delta=1)

    def test_mark_failed(self):
        self.campaign.status = 'active'
        self.campaign.save()
        self.campaign.mark_failed()
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'failed')

    def test_mark_reclaimable(self):
        self.campaign.status = 'funded'
        self.campaign.save()
        self.campaign.mark_reclaimable()
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'reclaimable')

    def test_str_representation(self):
        self.assertIn('Test Campaign', str(self.campaign))

    def test_collaborative_campaign_with_project(self):
        project = CollaborativeProject.objects.create(
            title='Test Project',
            content_type='book',
            created_by=self.creator,
        )
        campaign = Campaign.objects.create(
            creator=self.creator,
            project=project,
            title='Collab Campaign',
            description='For a team',
            campaign_type='collaborative',
            funding_goal=Decimal('5000.00'),
            deadline=timezone.now() + timedelta(days=30),
        )
        self.assertEqual(campaign.project, project)
        self.assertEqual(campaign.campaign_type, 'collaborative')


class CampaignContributionModelTest(TestCase):
    """Test CampaignContribution model."""

    def setUp(self):
        self.creator = User.objects.create_user(username='creator1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.creator, defaults={'username': 'creator1'}
        )
        self.backer = User.objects.create_user(username='backer1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.backer, defaults={'username': 'backer1'}
        )
        self.campaign = Campaign.objects.create(
            creator=self.creator,
            title='Test Campaign',
            description='Test',
            funding_goal=Decimal('1000.00'),
            deadline=timezone.now() + timedelta(days=30),
        )

    def test_create_contribution(self):
        contribution = CampaignContribution.objects.create(
            campaign=self.campaign,
            backer=self.backer,
            amount=Decimal('50.00'),
            status='confirmed',
        )
        self.assertEqual(contribution.amount, Decimal('50.00'))
        self.assertEqual(contribution.status, 'confirmed')
        self.assertIn('backer1', str(contribution))

    def test_pending_contribution(self):
        contribution = CampaignContribution.objects.create(
            campaign=self.campaign,
            backer=self.backer,
            amount=Decimal('25.00'),
            status='pending',
        )
        self.assertEqual(contribution.status, 'pending')


class CampaignAPITest(TestCase):
    """Test Campaign API endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.creator = User.objects.create_user(username='creator1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.creator, defaults={'username': 'creator1'}
        )
        self.backer = User.objects.create_user(username='backer1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.backer, defaults={'username': 'backer1'}
        )

    def _auth_as(self, user):
        self.client.force_authenticate(user=user)

    def test_create_campaign(self):
        self._auth_as(self.creator)
        response = self.client.post('/api/campaigns/', {
            'title': 'My Book Campaign',
            'description': 'Fund my novel',
            'content_type': 'book',
            'campaign_type': 'solo',
            'funding_goal': '500.00',
            'deadline': (timezone.now() + timedelta(days=30)).isoformat(),
            'chapter_count': 10,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'My Book Campaign')
        # Verify it was created as draft in DB
        campaign = Campaign.objects.get(title='My Book Campaign')
        self.assertEqual(campaign.status, 'draft')

    def test_create_campaign_requires_auth(self):
        response = self.client.post('/api/campaigns/', {
            'title': 'Unauthorized',
            'description': 'Should fail',
            'funding_goal': '100.00',
            'deadline': (timezone.now() + timedelta(days=30)).isoformat(),
        }, format='json')
        self.assertIn(response.status_code, [401, 403])

    def test_launch_campaign(self):
        self._auth_as(self.creator)
        # Create directly in DB
        campaign = Campaign.objects.create(
            creator=self.creator,
            title='Launchable',
            description='A campaign to launch',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='draft',
        )

        # Launch
        resp = self.client.post(f'/api/campaigns/{campaign.id}/launch/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'active')

    def test_cannot_launch_non_draft(self):
        self._auth_as(self.creator)
        campaign = Campaign.objects.create(
            creator=self.creator,
            title='Already Active',
            description='Test',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='active',
        )
        resp = self.client.post(f'/api/campaigns/{campaign.id}/launch/')
        self.assertEqual(resp.status_code, 400)

    def test_cancel_campaign(self):
        self._auth_as(self.creator)
        campaign = Campaign.objects.create(
            creator=self.creator,
            title='Cancel Me',
            description='Test',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='active',
        )
        resp = self.client.post(f'/api/campaigns/{campaign.id}/cancel/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'cancelled')

    def test_cancel_with_contributions_becomes_reclaimable(self):
        self._auth_as(self.creator)
        campaign = Campaign.objects.create(
            creator=self.creator,
            title='Has Backers',
            description='Test',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='active',
            current_amount=Decimal('50.00'),
        )
        resp = self.client.post(f'/api/campaigns/{campaign.id}/cancel/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'reclaimable')

    def test_discover_shows_active_campaigns(self):
        # Create an active campaign
        Campaign.objects.create(
            creator=self.creator,
            title='Discoverable',
            description='Find me',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='active',
        )
        # Draft campaign should NOT appear
        Campaign.objects.create(
            creator=self.creator,
            title='Hidden Draft',
            description='Invisible',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='draft',
        )
        resp = self.client.get('/api/campaigns/discover/')
        self.assertEqual(resp.status_code, 200)
        titles = [c['title'] for c in resp.data]
        self.assertIn('Discoverable', titles)
        self.assertNotIn('Hidden Draft', titles)

    def test_discover_filter_by_type(self):
        Campaign.objects.create(
            creator=self.creator, title='Solo One', description='Test',
            campaign_type='solo', funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30), status='active',
        )
        Campaign.objects.create(
            creator=self.creator, title='Collab One', description='Test',
            campaign_type='collaborative', funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30), status='active',
        )
        resp = self.client.get('/api/campaigns/discover/?type=solo')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['title'], 'Solo One')

    def test_post_campaign_update(self):
        self._auth_as(self.creator)
        campaign = Campaign.objects.create(
            creator=self.creator, title='Updateable', description='Test',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30), status='active',
        )
        resp = self.client.post(
            f'/api/campaigns/{campaign.id}/updates/',
            {'title': 'Week 1 Update', 'body': 'Making progress!'},
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['title'], 'Week 1 Update')

    def test_non_creator_cannot_post_update(self):
        self._auth_as(self.backer)
        campaign = Campaign.objects.create(
            creator=self.creator, title='Not Mine', description='Test',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30), status='active',
        )
        # Make backer a confirmed contributor so they can see the campaign
        CampaignContribution.objects.create(
            campaign=campaign, backer=self.backer,
            amount=Decimal('10.00'), status='confirmed',
        )
        resp = self.client.post(
            f'/api/campaigns/{campaign.id}/updates/',
            {'title': 'Hack', 'body': 'Should fail'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_transfer_to_escrow(self):
        self._auth_as(self.creator)
        # Use solo campaign (doesn't require a linked project)
        campaign = Campaign.objects.create(
            creator=self.creator, title='Funded Solo', description='Test',
            campaign_type='solo', chapter_count=3,
            funding_goal=Decimal('1000.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='funded', current_amount=Decimal('1000.00'),
            funded_at=timezone.now(),
        )
        # Create wallet for creator so service can derive escrow PDA
        self.creator_profile = UserProfile.objects.get(user=self.creator)
        self.creator_profile.wallet_address = '6FpaqK2Nn6SoLMj2WZuoqZ2n3coywxaGkZd293P9Xd4u'
        self.creator_profile.save()

        # Add a confirmed contribution
        CampaignContribution.objects.create(
            campaign=campaign, backer=self.backer,
            amount=Decimal('1000.00'), status='confirmed',
        )
        resp = self.client.post(f'/api/campaigns/{campaign.id}/transfer-to-escrow/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'transferred')
        # Contributions should be transferred too
        contrib = CampaignContribution.objects.get(campaign=campaign)
        self.assertEqual(contrib.status, 'transferred')
        # Escrow PDA should be set
        campaign.refresh_from_db()
        self.assertTrue(campaign.escrow_pda, 'Escrow PDA should be set after transfer')
        self.assertIsNotNone(campaign.escrow_dormancy_deadline, 'Dormancy deadline should be set')


class CampaignContributionAPITest(TestCase):
    """Test campaign contribution intent and confirm flow."""

    def setUp(self):
        self.client = APIClient()
        self.creator = User.objects.create_user(username='creator1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.creator, defaults={'username': 'creator1'}
        )
        self.backer = User.objects.create_user(username='backer1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.backer, defaults={'username': 'backer1'}
        )
        self.campaign = Campaign.objects.create(
            creator=self.creator,
            title='Active Campaign',
            description='Back me',
            funding_goal=Decimal('100.00'),
            deadline=timezone.now() + timedelta(days=30),
            status='active',
        )

    def test_create_contribution_intent(self):
        self.client.force_authenticate(user=self.backer)
        resp = self.client.post('/api/payment/campaign-intent/', {
            'campaign_id': self.campaign.id,
            'amount': '25.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['amount'], '25.00')
        self.assertEqual(resp.data['fee'], '0.00')
        self.assertIn('0%', resp.data['fee_note'])

    def test_contribution_intent_requires_minimum(self):
        self.client.force_authenticate(user=self.backer)
        resp = self.client.post('/api/payment/campaign-intent/', {
            'campaign_id': self.campaign.id,
            'amount': '0.50',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_contribution_intent_inactive_campaign(self):
        self.client.force_authenticate(user=self.backer)
        self.campaign.status = 'failed'
        self.campaign.save()
        resp = self.client.post('/api/payment/campaign-intent/', {
            'campaign_id': self.campaign.id,
            'amount': '10.00',
        }, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_confirm_contribution(self):
        self.client.force_authenticate(user=self.backer)
        # Create intent
        resp = self.client.post('/api/payment/campaign-intent/', {
            'campaign_id': self.campaign.id,
            'amount': '25.00',
        }, format='json')
        contribution_id = resp.data['contribution_id']

        # Confirm
        resp = self.client.post('/api/payment/campaign-confirm/', {
            'contribution_id': contribution_id,
            'transaction_signature': 'test_tx_sig_123',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['amount'], '25.00')
        self.assertEqual(resp.data['funding_percentage'], 25)

        # Verify campaign totals updated
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.current_amount, Decimal('25.00'))
        self.assertEqual(self.campaign.backer_count, 1)

    def test_contribution_triggers_funded_status(self):
        self.client.force_authenticate(user=self.backer)
        # Create and confirm a contribution that meets the goal
        resp = self.client.post('/api/payment/campaign-intent/', {
            'campaign_id': self.campaign.id,
            'amount': '100.00',
        }, format='json')
        contribution_id = resp.data['contribution_id']

        resp = self.client.post('/api/payment/campaign-confirm/', {
            'contribution_id': contribution_id,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['is_goal_met'])
        self.assertEqual(resp.data['campaign_status'], 'funded')

        # Verify campaign transitioned
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'funded')
        self.assertIsNotNone(self.campaign.funded_at)
        self.assertIsNotNone(self.campaign.escrow_creation_deadline)

    def test_multiple_backers(self):
        backer2 = User.objects.create_user(username='backer2', password='test123')
        UserProfile.objects.get_or_create(user=backer2, defaults={'username': 'backer2'})

        for user, amount in [(self.backer, '40.00'), (backer2, '30.00')]:
            self.client.force_authenticate(user=user)
            resp = self.client.post('/api/payment/campaign-intent/', {
                'campaign_id': self.campaign.id,
                'amount': amount,
            }, format='json')
            self.client.post('/api/payment/campaign-confirm/', {
                'contribution_id': resp.data['contribution_id'],
            }, format='json')

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.current_amount, Decimal('70.00'))
        self.assertEqual(self.campaign.backer_count, 2)


class CampaignCeleryTaskTest(TestCase):
    """Test campaign periodic Celery tasks."""

    def setUp(self):
        self.creator = User.objects.create_user(username='creator1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.creator, defaults={'username': 'creator1'}
        )

    def test_check_campaign_deadlines_marks_failed(self):
        from rb_core.tasks import check_campaign_deadlines

        # Campaign past deadline, goal not met
        campaign = Campaign.objects.create(
            creator=self.creator,
            title='Expired Campaign',
            description='Expired',
            funding_goal=Decimal('1000.00'),
            current_amount=Decimal('500.00'),
            deadline=timezone.now() - timedelta(hours=1),
            status='active',
        )

        results = check_campaign_deadlines()
        self.assertEqual(results['failed'], 1)

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'failed')

    def test_check_campaign_deadlines_ignores_met_goals(self):
        from rb_core.tasks import check_campaign_deadlines

        # Campaign past deadline but goal met (should not be failed by this task
        # since it was already funded)
        Campaign.objects.create(
            creator=self.creator,
            title='Funded Before Deadline',
            description='OK',
            funding_goal=Decimal('100.00'),
            current_amount=Decimal('100.00'),
            deadline=timezone.now() - timedelta(hours=1),
            status='funded',
        )

        results = check_campaign_deadlines()
        self.assertEqual(results['failed'], 0)

    def test_check_campaign_deadlines_ignores_future(self):
        from rb_core.tasks import check_campaign_deadlines

        Campaign.objects.create(
            creator=self.creator,
            title='Still Active',
            description='Has time',
            funding_goal=Decimal('1000.00'),
            current_amount=Decimal('200.00'),
            deadline=timezone.now() + timedelta(days=10),
            status='active',
        )

        results = check_campaign_deadlines()
        self.assertEqual(results['failed'], 0)

    def test_check_escrow_creation_marks_reclaimable(self):
        from rb_core.tasks import check_campaign_escrow_creation

        # Funded campaign past 60-day window
        campaign = Campaign.objects.create(
            creator=self.creator,
            title='Stale Funded',
            description='No escrow created',
            funding_goal=Decimal('1000.00'),
            current_amount=Decimal('1000.00'),
            deadline=timezone.now() - timedelta(days=70),
            status='funded',
            funded_at=timezone.now() - timedelta(days=65),
            escrow_creation_deadline=timezone.now() - timedelta(days=5),
        )

        results = check_campaign_escrow_creation()
        self.assertEqual(results['reclaimable'], 1)

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'reclaimable')

    def test_check_escrow_creation_ignores_within_window(self):
        from rb_core.tasks import check_campaign_escrow_creation

        Campaign.objects.create(
            creator=self.creator,
            title='Recently Funded',
            description='Still has time',
            funding_goal=Decimal('1000.00'),
            current_amount=Decimal('1000.00'),
            deadline=timezone.now() - timedelta(days=5),
            status='funded',
            funded_at=timezone.now() - timedelta(days=5),
            escrow_creation_deadline=timezone.now() + timedelta(days=55),
        )

        results = check_campaign_escrow_creation()
        self.assertEqual(results['reclaimable'], 0)


class CampaignValidationTest(TestCase):
    """Test campaign creation validation."""

    def setUp(self):
        self.client = APIClient()
        self.creator = User.objects.create_user(username='creator1', password='test123')
        UserProfile.objects.get_or_create(
            user=self.creator, defaults={'username': 'creator1'}
        )
        self.client.force_authenticate(user=self.creator)

    def test_funding_goal_too_low(self):
        resp = self.client.post('/api/campaigns/', {
            'title': 'Tiny Goal',
            'description': 'Too small',
            'funding_goal': '5.00',
            'deadline': (timezone.now() + timedelta(days=30)).isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_deadline_too_soon(self):
        resp = self.client.post('/api/campaigns/', {
            'title': 'Too Soon',
            'description': 'Deadline is too close',
            'funding_goal': '100.00',
            'deadline': (timezone.now() + timedelta(hours=12)).isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_deadline_too_far(self):
        resp = self.client.post('/api/campaigns/', {
            'title': 'Too Far',
            'description': 'Deadline is too far',
            'funding_goal': '100.00',
            'deadline': (timezone.now() + timedelta(days=100)).isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_solo_requires_chapter_count(self):
        resp = self.client.post('/api/campaigns/', {
            'title': 'Solo No Chapters',
            'description': 'Missing chapter count',
            'campaign_type': 'solo',
            'funding_goal': '100.00',
            'deadline': (timezone.now() + timedelta(days=30)).isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, 400)
