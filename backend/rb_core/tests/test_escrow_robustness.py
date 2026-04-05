"""
Tests for Escrow Robustness: Deadline Refunds + Revision Limits.

Tests cover:
1. check_task_deadlines marks overdue tasks and triggers refund
2. process_escrow_refund creates correct EscrowTransaction
3. Revision limit enforcement on page-level art revisions
4. Project completion with mixed signed_off + cancelled tasks
5. Refunds have no platform fee (100% returned)
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
    UserProfile, EscrowTransaction, ComicPage, ComicIssue,
    PageArtDelivery,
)

User = get_user_model()


class EscrowFixtureMixin:
    """Shared test fixture for escrow tests."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='writer_test', email='writer@test.com', password='testpass123'
        )
        self.artist = User.objects.create_user(
            username='artist_test', email='artist@test.com', password='testpass123'
        )
        UserProfile.objects.get_or_create(user=self.owner)
        UserProfile.objects.get_or_create(user=self.artist)

        self.project = CollaborativeProject.objects.create(
            title='Test Escrow Project',
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
            total_contract_amount=Decimal('5.00'),
            escrow_funded_amount=Decimal('5.00'),
        )

    def _create_task(self, page_num=1, payment=Decimal('1.00'),
                     deadline_offset_seconds=None, deadline_offset_days=30,
                     status_val='in_progress'):
        """Create a contract task with page range mapping."""
        if deadline_offset_seconds is not None:
            deadline = timezone.now() + timedelta(seconds=deadline_offset_seconds)
        else:
            deadline = timezone.now() + timedelta(days=deadline_offset_days)

        return ContractTask.objects.create(
            collaborator_role=self.role,
            title=f'Page {page_num}',
            milestone_type='trust_page',
            payment_amount=payment,
            escrow_release_status='pending',
            deadline=deadline,
            status=status_val,
            page_range_start=page_num,
            page_range_end=page_num,
            revision_limit=3,
            revisions_used=0,
        )


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class CheckTaskDeadlinesTest(EscrowFixtureMixin, TestCase):
    """Tests for check_task_deadlines periodic task."""

    def test_marks_overdue_and_refunds(self):
        """Past-deadline task gets cancelled and refunded."""
        task = self._create_task(deadline_offset_seconds=-60)  # 1 min ago

        from rb_core.tasks import check_task_deadlines
        results = check_task_deadlines()

        task.refresh_from_db()
        self.assertTrue(task.is_overdue)
        self.assertEqual(task.status, 'cancelled')
        self.assertEqual(task.escrow_release_status, 'refunded')
        self.assertEqual(results['overdue_detected'], 1)
        self.assertEqual(results['refunds_triggered'], 1)

    def test_ignores_future_deadline(self):
        """Task with future deadline is not affected."""
        task = self._create_task(deadline_offset_days=30)

        from rb_core.tasks import check_task_deadlines
        results = check_task_deadlines()

        task.refresh_from_db()
        self.assertFalse(task.is_overdue)
        self.assertEqual(task.status, 'in_progress')
        self.assertEqual(results['overdue_detected'], 0)

    def test_ignores_signed_off_task(self):
        """Already signed-off task is not cancelled."""
        task = self._create_task(deadline_offset_seconds=-60)
        task.status = 'signed_off'
        task.escrow_release_status = 'released'
        task.save()

        from rb_core.tasks import check_task_deadlines
        results = check_task_deadlines()

        task.refresh_from_db()
        self.assertEqual(task.status, 'signed_off')
        self.assertEqual(results['overdue_detected'], 0)

    def test_ignores_already_overdue_task(self):
        """Task already marked overdue is not reprocessed."""
        task = self._create_task(deadline_offset_seconds=-60)
        task.is_overdue = True
        task.save()

        from rb_core.tasks import check_task_deadlines
        results = check_task_deadlines()

        self.assertEqual(results['overdue_detected'], 0)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class ProcessEscrowRefundTest(EscrowFixtureMixin, TestCase):
    """Tests for process_escrow_refund task."""

    def test_creates_refund_transaction(self):
        """Refund creates EscrowTransaction with correct values."""
        task = self._create_task()
        task.status = 'cancelled'
        task.escrow_release_status = 'refunded'
        task.save()

        from rb_core.tasks import process_escrow_refund
        result = process_escrow_refund(task.id)

        self.assertEqual(result['status'], 'refunded')
        self.assertEqual(result['amount'], '1.00')

        tx = EscrowTransaction.objects.get(contract_task=task)
        self.assertEqual(tx.transaction_type, 'refund')
        self.assertEqual(tx.amount, Decimal('1.00'))

    def test_refund_has_no_platform_fee(self):
        """Refunds return 100% to owner — no 3% deduction."""
        task = self._create_task(payment=Decimal('10.00'))
        task.status = 'cancelled'
        task.escrow_release_status = 'refunded'
        task.save()

        from rb_core.tasks import process_escrow_refund
        process_escrow_refund(task.id)

        tx = EscrowTransaction.objects.get(contract_task=task)
        self.assertEqual(tx.platform_fee_amount, Decimal('0.00'))
        self.assertEqual(tx.artist_net_amount, Decimal('0.00'))
        self.assertEqual(tx.amount, Decimal('10.00'))

    def test_skips_non_refunded_task(self):
        """Task not in 'refunded' status is skipped."""
        task = self._create_task()
        task.status = 'cancelled'
        # escrow_release_status is still 'pending'
        task.save()

        from rb_core.tasks import process_escrow_refund
        result = process_escrow_refund(task.id)

        self.assertIsNone(result)
        self.assertFalse(EscrowTransaction.objects.filter(contract_task=task).exists())


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class ProjectCompletionTest(EscrowFixtureMixin, TestCase):
    """Tests for project completion with mixed task states."""

    def test_project_complete_when_all_signed_off(self):
        """Project transitions to 'complete' when all tasks auto-completed."""
        task1 = self._create_task(page_num=1)
        task2 = self._create_task(page_num=2)

        # Use auto_complete_and_sign_off (the production path via art approval)
        task1.auto_complete_and_sign_off(self.owner, 'Done')
        task2.auto_complete_and_sign_off(self.owner, 'Done')

        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'complete')

    def test_project_complete_with_mixed_signed_off_and_cancelled(self):
        """Project transitions to 'complete' when tasks are mix of signed_off + cancelled."""
        task1 = self._create_task(page_num=1)
        task2 = self._create_task(page_num=2, deadline_offset_seconds=-60)

        # Sign off task 1
        task1.status = 'complete'
        task1.save()
        task1.sign_off(self.owner, 'Done')

        # Cancel task 2 (deadline breach)
        from rb_core.tasks import check_task_deadlines
        check_task_deadlines()

        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'complete')

    def test_project_not_complete_with_pending_task(self):
        """Project stays active if any task is still pending/in_progress."""
        task1 = self._create_task(page_num=1)
        task2 = self._create_task(page_num=2)

        task1.status = 'complete'
        task1.save()
        task1.sign_off(self.owner, 'Done')

        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'active')


class RevisionLimitEnforcementTest(EscrowFixtureMixin, APITestCase):
    """Tests for page-level revision limit enforcement."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

        # Create issue and page
        self.issue = ComicIssue.objects.create(
            project=self.project,
            title='Issue 1',
            issue_number=1,
        )
        self.page = ComicPage.objects.create(
            issue=self.issue,
            page_number=1,
            page_status='art_delivered',
        )
        # Create art delivery
        self.delivery = PageArtDelivery.objects.create(
            page=self.page,
            uploaded_by=self.artist,
            version=1,
            status='delivered',
            file='test.png',
            filename='test.png',
            file_type='image/png',
            file_size=1024,
        )

    def test_revision_under_limit_succeeds(self):
        """Revision request within limit succeeds and increments counter."""
        task = self._create_task(page_num=1)
        task.revisions_used = 1
        task.save()

        response = self.client.post(
            f'/api/page-art-deliveries/{self.delivery.id}/request_revision/',
            {'revision_notes': 'Please fix the colors'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.revisions_used, 2)

    def test_revision_at_limit_blocked(self):
        """Revision request at limit returns 400."""
        task = self._create_task(page_num=1)
        task.revisions_used = 3
        task.revision_limit = 3
        task.save()

        response = self.client.post(
            f'/api/page-art-deliveries/{self.delivery.id}/request_revision/',
            {'revision_notes': 'One more fix please'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Revision limit reached', response.data['error'])

    def test_revision_no_linked_task_unlimited(self):
        """Page with no linked contract task allows unlimited revisions."""
        # No task with page_range covering page 1

        response = self.client.post(
            f'/api/page-art-deliveries/{self.delivery.id}/request_revision/',
            {'revision_notes': 'Fix something'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
