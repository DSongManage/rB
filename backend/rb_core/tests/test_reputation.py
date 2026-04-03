"""
Tests for Collaboration Reputation System.

Tests cover:
1. UserProfile reputation fields exist and default correctly
2. update_collaboration_stats() calculates correctly
3. ContractTask.sign_off() auto-updates collaborator profile stats
4. On-time delivery rate calculation
5. Stats appear in PublicProfile API and UserSearch API
"""

from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from rb_core.models import (
    CollaborativeProject, CollaboratorRole, ContractTask,
    UserProfile, EscrowTransaction,
)

User = get_user_model()


class ReputationFieldsTests(TestCase):
    """Test that reputation fields exist and default correctly."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='artist1', email='artist@test.com', password='testpass123'
        )
        UserProfile.objects.get_or_create(user=self.user)

    def test_default_values(self):
        """New profiles have zero reputation stats."""
        profile = self.user.profile
        self.assertEqual(profile.projects_completed, 0)
        self.assertEqual(profile.milestones_completed, 0)
        self.assertIsNone(profile.on_time_delivery_rate)
        self.assertIsNone(profile.avg_response_time_hours)


class ReputationCalculationTests(TestCase):
    """Test update_collaboration_stats() calculation logic."""

    def setUp(self):
        self.writer = User.objects.create_user(
            username='writer1', email='writer@test.com', password='testpass123'
        )
        self.artist = User.objects.create_user(
            username='artist1', email='artist@test.com', password='testpass123'
        )
        UserProfile.objects.get_or_create(user=self.writer)
        UserProfile.objects.get_or_create(user=self.artist)
        self.project = CollaborativeProject.objects.create(
            title='Test Comic',
            content_type='comic',
            created_by=self.writer,
            status='active',
        )
        self.role = CollaboratorRole.objects.create(
            project=self.project,
            user=self.artist,
            role='artist',
            status='accepted',
            revenue_percentage=Decimal('50'),
            contract_type='work_for_hire',
            total_contract_amount=Decimal('5.00'),
            escrow_funded_amount=Decimal('5.00'),
        )

    def _create_task(self, milestone_type='production_page', payment=Decimal('1.00'),
                     deadline_offset_days=30):
        """Helper to create a contract task."""
        return ContractTask.objects.create(
            collaborator_role=self.role,
            title=f'Task {self.role.contract_tasks.count() + 1}',
            milestone_type=milestone_type,
            payment_amount=payment,
            escrow_release_status='pending',
            deadline=timezone.now() + timedelta(days=deadline_offset_days),
        )

    def test_sign_off_updates_milestones_completed(self):
        """Signing off a task increments milestones_completed."""
        task = self._create_task()
        task.status = 'complete'
        task.marked_complete_at = timezone.now()
        task.save()

        task.sign_off(self.writer)

        self.artist.profile.refresh_from_db()
        self.assertEqual(self.artist.profile.milestones_completed, 1)

    def test_multiple_signoffs_accumulate(self):
        """Multiple task sign-offs accumulate correctly."""
        for i in range(3):
            task = self._create_task()
            task.status = 'complete'
            task.marked_complete_at = timezone.now()
            task.save()
            task.sign_off(self.writer)

        self.artist.profile.refresh_from_db()
        self.assertEqual(self.artist.profile.milestones_completed, 3)

    def test_on_time_delivery_rate(self):
        """On-time rate is calculated from tasks with deadlines."""
        # Task 1: on time (deadline in future)
        t1 = self._create_task(deadline_offset_days=30)
        t1.status = 'complete'
        t1.marked_complete_at = timezone.now()
        t1.save()
        t1.sign_off(self.writer)

        # Task 2: late (deadline in the past)
        t2 = self._create_task(deadline_offset_days=-1)
        t2.status = 'complete'
        t2.marked_complete_at = timezone.now()
        t2.save()
        t2.sign_off(self.writer)

        self.artist.profile.refresh_from_db()
        self.assertEqual(self.artist.profile.milestones_completed, 2)
        # 1 out of 2 on time = 50%
        self.assertAlmostEqual(float(self.artist.profile.on_time_delivery_rate), 50.0, places=0)

    def test_project_completed_count(self):
        """projects_completed increments when all tasks in a role are signed off."""
        self.role.tasks_total = 2
        self.role.save()

        for i in range(2):
            task = self._create_task()
            task.status = 'complete'
            task.marked_complete_at = timezone.now()
            task.save()
            task.sign_off(self.writer)

        # Mark the role as complete
        self.role.tasks_signed_off = 2
        self.role.contract_complete_at = timezone.now()
        self.role.save()

        # Trigger recalculation
        self.artist.profile.update_collaboration_stats()
        self.artist.profile.refresh_from_db()
        self.assertEqual(self.artist.profile.projects_completed, 1)

    def test_avg_response_time(self):
        """Average response time is calculated from created_at to marked_complete_at."""
        task = self._create_task()
        task.status = 'complete'
        # Simulate 24 hours to complete
        task.marked_complete_at = task.created_at + timedelta(hours=24)
        task.save()
        task.sign_off(self.writer)

        self.artist.profile.refresh_from_db()
        self.assertIsNotNone(self.artist.profile.avg_response_time_hours)
        # Should be approximately 24 hours
        self.assertAlmostEqual(float(self.artist.profile.avg_response_time_hours), 24.0, delta=1.0)

    def test_stats_zero_when_no_tasks(self):
        """Stats are zero/None when no tasks exist."""
        self.artist.profile.update_collaboration_stats()
        self.artist.profile.refresh_from_db()
        self.assertEqual(self.artist.profile.projects_completed, 0)
        self.assertEqual(self.artist.profile.milestones_completed, 0)
        self.assertIsNone(self.artist.profile.on_time_delivery_rate)


class ReputationAPITests(APITestCase):
    """Test that reputation stats appear in API responses."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testartist', email='artist@test.com', password='testpass123'
        )
        UserProfile.objects.get_or_create(user=self.user)
        # Set some stats directly
        profile = self.user.profile
        profile.projects_completed = 5
        profile.milestones_completed = 23
        profile.on_time_delivery_rate = Decimal('92.50')
        profile.avg_response_time_hours = Decimal('18.5')
        profile.save()

        self.client = APIClient()

    def test_public_profile_includes_reputation(self):
        """Public profile API includes reputation stats."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/users/{self.user.username}/public/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats = response.json().get('stats', {})
        self.assertEqual(stats['projects_completed'], 5)
        self.assertEqual(stats['milestones_completed'], 23)
        self.assertAlmostEqual(stats['on_time_delivery_rate'], 92.5)
        self.assertAlmostEqual(stats['avg_response_time_hours'], 18.5)

    def test_user_search_includes_reputation(self):
        """User search API includes reputation stats."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/users/search/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get('results', [])
        # Find our user in results
        artist = next((r for r in results if r['username'] == 'testartist'), None)
        if artist:
            self.assertEqual(artist['projects_completed'], 5)
            self.assertEqual(artist['milestones_completed'], 23)
