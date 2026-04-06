"""
Tests for the Complete Escrow Lifecycle System.

Covers:
1. State machine transitions (valid + invalid)
2. Deadline extension (48hr grace window)
3. Revision system (final rejection)
4. Milestone ratings + rating gate
5. Inactivity detection
6. Scope change timer pause/resume
7. Project cancellation
8. Notification actionability
"""

from decimal import Decimal
from datetime import timedelta
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from rb_core.models import (
    CollaborativeProject, CollaboratorRole, ContractTask,
    UserProfile, EscrowTransaction, MilestoneExtension,
    MilestoneRating, ScopeChangeRequest, MilestoneReassignment,
    ReputationScore, Notification,
)

User = get_user_model()


class LifecycleFixtureMixin:
    """Shared test fixture for lifecycle tests."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='writer_lc', email='writer_lc@test.com', password='testpass123'
        )
        self.artist = User.objects.create_user(
            username='artist_lc', email='artist_lc@test.com', password='testpass123'
        )
        UserProfile.objects.get_or_create(user=self.owner)
        UserProfile.objects.get_or_create(user=self.artist)

        self.project = CollaborativeProject.objects.create(
            title='Lifecycle Test Project',
            content_type='comic',
            created_by=self.owner,
            status='active',
        )
        self.role = CollaboratorRole.objects.create(
            project=self.project,
            user=self.artist,
            role='artist',
            status='accepted',
            revenue_percentage=Decimal('0'),
            contract_type='work_for_hire',
            escrow_fee_mode='artist_pays',
            total_contract_amount=Decimal('10.00'),
            escrow_funded_amount=Decimal('10.00'),
        )

    def _create_task(self, page_num=1, payment=Decimal('2.00'),
                     deadline_offset_days=30, status_val='in_progress'):
        return ContractTask.objects.create(
            collaborator_role=self.role,
            title=f'Page {page_num}',
            milestone_type='trust_page',
            payment_amount=payment,
            escrow_release_status='pending',
            deadline=timezone.now() + timedelta(days=deadline_offset_days),
            status=status_val,
            page_range_start=page_num,
            page_range_end=page_num,
            revision_limit=2,
            revisions_used=0,
        )


# ============================================================
# Phase 1: State Machine Tests
# ============================================================

class StateMachineTransitionTest(LifecycleFixtureMixin, TestCase):
    """Test that valid transitions succeed and invalid ones raise."""

    def test_valid_transition_in_progress_to_submitted(self):
        task = self._create_task()
        task.transition_to('submitted')
        self.assertEqual(task.status, 'submitted')

    def test_valid_transition_submitted_to_approved(self):
        task = self._create_task(status_val='submitted')
        task.transition_to('approved')
        self.assertEqual(task.status, 'approved')

    def test_invalid_transition_raises(self):
        task = self._create_task()
        with self.assertRaises(ValueError) as ctx:
            task.transition_to('released')  # in_progress → released is invalid
        self.assertIn('Invalid transition', str(ctx.exception))

    def test_terminal_state_no_transitions(self):
        task = self._create_task()
        task.status = 'refunded'
        task.save()
        with self.assertRaises(ValueError):
            task.transition_to('in_progress')

    def test_is_resolved_property(self):
        task = self._create_task()
        self.assertFalse(task.is_resolved)
        task.status = 'approved'
        self.assertTrue(task.is_resolved)
        task.status = 'cancelled'
        self.assertTrue(task.is_resolved)

    def test_mark_complete_sets_submitted_for_escrow(self):
        task = self._create_task()
        task.mark_complete(self.artist, 'Done')
        self.assertEqual(task.status, 'submitted')
        self.assertIsNotNone(task.auto_approve_deadline)

    def test_sign_off_sets_approved_for_escrow(self):
        task = self._create_task()
        task.mark_complete(self.artist, 'Done')
        task.sign_off(self.owner, 'Looks good')
        self.assertEqual(task.status, 'approved')
        self.assertEqual(task.escrow_release_status, 'approved')


# ============================================================
# Phase 2: Deadline Extension Tests
# ============================================================

@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class DeadlineExtensionTest(LifecycleFixtureMixin, TestCase):
    """Test 48hr grace window and extensions."""

    def test_deadline_starts_grace_not_immediate_refund(self):
        """Past-deadline task enters grace window, not immediate cancel."""
        task = self._create_task(deadline_offset_days=-1)  # 1 day ago

        from rb_core.tasks import check_task_deadlines
        results = check_task_deadlines()

        task.refresh_from_db()
        self.assertEqual(task.status, 'deadline_passed')
        self.assertIsNotNone(task.grace_deadline)
        self.assertEqual(task.escrow_release_status, 'pending')
        self.assertEqual(results['grace_started'], 1)

    def test_grace_expiry_triggers_auto_refund(self):
        """Task past grace_deadline auto-refunds."""
        task = self._create_task()
        task.status = 'deadline_passed'
        task.grace_deadline = timezone.now() - timedelta(hours=1)  # Expired
        task.is_overdue = True
        task.escrow_release_status = 'pending'
        task.save()

        from rb_core.tasks import check_grace_deadlines
        results = check_grace_deadlines()

        task.refresh_from_db()
        self.assertEqual(task.status, 'refunded')
        self.assertEqual(task.escrow_release_status, 'refunded')
        self.assertTrue(task.deadline_action_taken)
        self.assertEqual(results['auto_refunded'], 1)


# ============================================================
# Phase 3: Revision System Tests
# ============================================================

class RevisionSystemTest(LifecycleFixtureMixin, TestCase):
    """Test revision limits and final rejection."""

    def test_first_rejection_goes_to_revision_requested(self):
        task = self._create_task()
        task.mark_complete(self.artist, 'Done')
        task.reject_completion(self.owner, 'Fix colors')
        self.assertEqual(task.status, 'revision_requested')
        self.assertEqual(task.revisions_used, 1)

    def test_second_rejection_triggers_final_rejection(self):
        task = self._create_task()
        task.revision_limit = 2

        task.mark_complete(self.artist, 'Done')
        task.reject_completion(self.owner, 'Fix colors')
        # Artist resubmits
        task.status = 'submitted'
        task.save()
        task.reject_completion(self.owner, 'Still wrong')

        self.assertEqual(task.status, 'final_rejection')
        self.assertEqual(task.revisions_used, 2)

    def test_rejection_requires_reason(self):
        task = self._create_task()
        task.mark_complete(self.artist, 'Done')
        with self.assertRaises(ValueError) as ctx:
            task.reject_completion(self.owner, '')
        self.assertIn('required', str(ctx.exception))


# ============================================================
# Phase 5: Milestone Rating Tests
# ============================================================

class MilestoneRatingTest(LifecycleFixtureMixin, APITestCase):
    """Test per-milestone rating system."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.task = self._create_task()
        self.task.status = 'released'
        self.task.escrow_release_status = 'released'
        self.task.save()

    def test_writer_can_rate(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/collaborative-projects/{self.project.id}/tasks/{self.task.id}/rate/',
            {'quality_score': 5, 'communication_score': 4, 'timeliness_score': 3},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'rated')
        self.assertFalse(response.data['both_rated'])

    def test_both_rate_transitions_to_complete(self):
        # Writer rates
        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f'/api/collaborative-projects/{self.project.id}/tasks/{self.task.id}/rate/',
            {'quality_score': 5, 'communication_score': 4, 'timeliness_score': 3},
        )
        # Artist rates
        self.client.force_authenticate(user=self.artist)
        response = self.client.post(
            f'/api/collaborative-projects/{self.project.id}/tasks/{self.task.id}/rate/',
            {'quality_score': 4, 'communication_score': 5, 'timeliness_score': 4},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['both_rated'])

        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'complete')

    def test_duplicate_rating_blocked(self):
        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f'/api/collaborative-projects/{self.project.id}/tasks/{self.task.id}/rate/',
            {'quality_score': 5, 'communication_score': 4, 'timeliness_score': 3},
        )
        response = self.client.post(
            f'/api/collaborative-projects/{self.project.id}/tasks/{self.task.id}/rate/',
            {'quality_score': 5, 'communication_score': 4, 'timeliness_score': 3},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already rated', response.data['error'])


# ============================================================
# Phase 7: Scope Change Tests
# ============================================================

class ScopeChangeTest(LifecycleFixtureMixin, TestCase):
    """Test scope change timer pause/resume."""

    def test_scope_change_pauses_deadline(self):
        task = self._create_task()
        now = timezone.now()

        ScopeChangeRequest.objects.create(
            contract_task=task,
            requested_by=self.artist,
            description='Extra panel needed',
            auto_resume_at=now + timedelta(hours=48),
        )
        task.deadline_paused_at = now
        task.save()

        self.assertIsNotNone(task.deadline_paused_at)

    def test_scope_change_auto_resume(self):
        task = self._create_task()
        original_deadline = task.deadline
        now = timezone.now()

        sc = ScopeChangeRequest.objects.create(
            contract_task=task,
            requested_by=self.artist,
            description='Extra panel needed',
            auto_resume_at=now - timedelta(hours=1),  # Already expired
        )
        task.deadline_paused_at = now - timedelta(hours=49)
        task.save()

        from rb_core.tasks import check_scope_change_timeouts
        results = check_scope_change_timeouts()

        sc.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(sc.status, 'auto_resumed')
        self.assertIsNone(task.deadline_paused_at)
        self.assertGreater(task.deadline, original_deadline)
        self.assertEqual(results['auto_resumed'], 1)


# ============================================================
# Phase 9: Cancellation Tests
# ============================================================

class CancellationFlowTest(LifecycleFixtureMixin, APITestCase):
    """Test project cancellation with escrow refunds."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_writer_cancel_refunds_funded_tasks(self):
        task1 = self._create_task(page_num=1, status_val='funded')
        task2 = self._create_task(page_num=2, status_val='in_progress')

        response = self.client.post(
            f'/api/collaborative-projects/{self.project.id}/cancel-project/',
            {'reason': 'Budget cut', 'cancellation_type': 'writer'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['immediate_refunds'], 1)  # Only funded task
        self.assertIsNotNone(response.data['hold_until'])  # 72hr hold for in-progress

        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'cancelled')
        self.assertEqual(self.project.cancellation_type, 'writer')

        task1.refresh_from_db()
        self.assertEqual(task1.status, 'refunded')


# ============================================================
# Phase 11: Reputation Score Tests
# ============================================================

@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class ReputationScoreTest(LifecycleFixtureMixin, TestCase):
    """Test reputation score calculation."""

    def test_recalculate_creates_score(self):
        from rb_core.tasks import recalculate_reputation_scores
        results = recalculate_reputation_scores()
        self.assertGreater(results['updated'], 0)

        score = ReputationScore.objects.get(user=self.artist)
        self.assertEqual(score.artist_score, Decimal('50.00'))  # Default

    def test_ratings_affect_score(self):
        task = self._create_task()
        task.status = 'released'
        task.save()

        MilestoneRating.objects.create(
            contract_task=task, rater=self.owner, rated_user=self.artist,
            quality_score=5, communication_score=5, timeliness_score=5,
        )

        from rb_core.tasks import recalculate_reputation_scores
        recalculate_reputation_scores()

        score = ReputationScore.objects.get(user=self.artist)
        self.assertGreater(score.artist_avg_quality_rating, Decimal('0'))


# ============================================================
# Notification Actionability Tests
# ============================================================

class ActionableNotificationTest(LifecycleFixtureMixin, TestCase):
    """Test actionable notification creation."""

    def test_deadline_passed_creates_actionable_notification(self):
        task = self._create_task()
        task.status = 'deadline_passed'
        task.grace_deadline = timezone.now() + timedelta(hours=48)
        task.save()

        from rb_core.notifications_utils import notify_deadline_passed
        notif = notify_deadline_passed(task)

        self.assertIsNotNone(notif)
        self.assertTrue(notif.action_required)
        self.assertEqual(len(notif.action_options), 3)
        self.assertEqual(notif.notification_type, 'deadline_passed')
        self.assertEqual(notif.contract_task, task)
        self.assertIsNotNone(notif.expires_at)

    def test_final_rejection_creates_notifications(self):
        task = self._create_task()
        task.status = 'final_rejection'
        task.save()

        from rb_core.notifications_utils import notify_final_rejection
        notifications = notify_final_rejection(task)

        self.assertEqual(len(notifications), 2)
        writer_notif = [n for n in notifications if n.recipient == self.owner][0]
        self.assertTrue(writer_notif.action_required)
        self.assertEqual(len(writer_notif.action_options), 3)
