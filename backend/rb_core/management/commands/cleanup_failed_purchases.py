"""
Management command to clean up failed/pending purchases.

Usage:
    python manage.py cleanup_failed_purchases

This will mark all purchases with status='payment_pending' that are older than 1 hour as 'failed'.
This fixes the bug where failed payments showed NFTs as "owned".
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from rb_core.models import Purchase


class Command(BaseCommand):
    help = 'Mark old pending purchases as failed'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--hours',
            type=int,
            default=1,
            help='Mark purchases pending for more than this many hours as failed (default: 1)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        hours = options['hours']

        cutoff_time = timezone.now() - timedelta(hours=hours)

        # Find all pending purchases older than cutoff
        pending_purchases = Purchase.objects.filter(
            status='payment_pending',
            purchased_at__lt=cutoff_time
        )

        count = pending_purchases.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ No pending purchases older than {hours} hour(s) found'
                )
            )
            return

        self.stdout.write(
            self.style.WARNING(
                f'Found {count} pending purchase(s) older than {hours} hour(s):'
            )
        )

        for purchase in pending_purchases:
            age = timezone.now() - purchase.purchased_at
            self.stdout.write(
                f'  - Purchase {purchase.id}: {purchase.content.title} '
                f'by {purchase.user.username} '
                f'(pending for {age.total_seconds() / 3600:.1f} hours)'
            )

        if dry_run:
            self.stdout.write(
                self.style.WARNING('🔍 DRY RUN - No changes made')
            )
        else:
            # Mark as failed
            updated = pending_purchases.update(status='failed')
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Marked {updated} purchase(s) as failed'
                )
            )
