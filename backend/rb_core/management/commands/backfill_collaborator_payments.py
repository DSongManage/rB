"""
Backfill CollaboratorPayment records for balance purchases that are missing them.

Usage:
    python manage.py backfill_collaborator_payments
    python manage.py backfill_collaborator_payments --dry-run

This fixes purchases where process_balance_purchase_task completed but
CollaboratorPayment records were never created (e.g. because the old code
relied on process_atomic_purchase which Celery never received).
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from rb_core.models import (
    Purchase, CollaboratorPayment, UserProfile,
)


class Command(BaseCommand):
    help = 'Backfill missing CollaboratorPayment records for balance purchases'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Find balance purchases with no CollaboratorPayment records
        balance_purchases = Purchase.objects.filter(
            payment_provider='balance',
            status='payment_completed',
        ).exclude(
            id__in=CollaboratorPayment.objects.values_list('purchase_id', flat=True)
        ).select_related('content', 'chapter', 'user')

        count = balance_purchases.count()
        self.stdout.write(f'Found {count} balance purchase(s) missing CollaboratorPayment records')

        if count == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to backfill.'))
            return

        from rb_core.tier_service import get_project_fee_rate

        created = 0
        for purchase in balance_purchases:
            item = purchase.chapter or purchase.content
            if not item:
                self.stdout.write(self.style.WARNING(
                    f'  Purchase {purchase.id}: No content/chapter linked, skipping'
                ))
                continue

            if not hasattr(item, 'get_collaborators_with_wallets'):
                self.stdout.write(self.style.WARNING(
                    f'  Purchase {purchase.id}: Item has no get_collaborators_with_wallets, skipping'
                ))
                continue

            collaborators = item.get_collaborators_with_wallets()
            if not collaborators:
                self.stdout.write(self.style.WARNING(
                    f'  Purchase {purchase.id}: No collaborators found, skipping'
                ))
                continue

            item_price = purchase.chapter_price or purchase.purchase_price_usd
            dynamic_fee_rate = get_project_fee_rate(item)
            platform_fee = (item_price * dynamic_fee_rate).quantize(Decimal('0.000001'))
            creator_pool = item_price - platform_fee

            total_collab_pct = sum(Decimal(str(c['percentage'])) for c in collaborators)
            is_collaborative = total_collab_pct > Decimal('95')

            self.stdout.write(self.style.HTTP_INFO(
                f'\n  Purchase {purchase.id}: {item.title} (${item_price}) '
                f'by {purchase.user.username}'
            ))

            for collab in collaborators:
                collab_pct = Decimal(str(collab['percentage']))
                if is_collaborative:
                    usdc_amount = (creator_pool * collab_pct / 100).quantize(Decimal('0.000001'))
                else:
                    usdc_amount = (item_price * collab_pct / 100).quantize(Decimal('0.000001'))

                self.stdout.write(
                    f'    -> {collab["user"].username}: ${usdc_amount} '
                    f'({collab_pct}% as {collab.get("role", "creator")})'
                )

                if not dry_run:
                    CollaboratorPayment.objects.update_or_create(
                        purchase=purchase,
                        collaborator=collab['user'],
                        defaults={
                            'collaborator_wallet': collab['wallet'],
                            'amount_usdc': usdc_amount,
                            'percentage': int(collab_pct),
                            'role': collab.get('role', 'creator'),
                            'transaction_signature': purchase.transaction_signature or '',
                        }
                    )

                    # Update creator profile earnings
                    profile, _ = UserProfile.objects.get_or_create(
                        user=collab['user'],
                        defaults={'username': collab['user'].username}
                    )
                    profile.total_sales_usd = (profile.total_sales_usd or Decimal('0')) + usdc_amount
                    profile.save(update_fields=['total_sales_usd'])

                    created += 1

            if not dry_run:
                # Update purchase distribution status
                purchase.usdc_distribution_status = 'completed'
                purchase.usdc_distributed_at = timezone.now()
                purchase.usdc_distribution_transaction = purchase.transaction_signature or ''
                purchase.platform_usdc_earned = platform_fee
                purchase.save(update_fields=[
                    'usdc_distribution_status', 'usdc_distributed_at',
                    'usdc_distribution_transaction', 'platform_usdc_earned',
                ])

                # Send notification
                try:
                    from rb_core.notifications_utils import notify_content_purchase
                    content_title = (purchase.chapter.title if purchase.chapter
                                     else (purchase.content.title if purchase.content else 'Content'))
                    for collab in collaborators:
                        if collab['user'] != purchase.user:
                            collab_pct = Decimal(str(collab['percentage']))
                            if is_collaborative:
                                notif_amount = (creator_pool * collab_pct / 100).quantize(Decimal('0.000001'))
                            else:
                                notif_amount = (item_price * collab_pct / 100).quantize(Decimal('0.000001'))
                            notify_content_purchase(
                                recipient=collab['user'],
                                buyer=purchase.user,
                                content_title=content_title,
                                amount_usdc=notif_amount,
                                role=collab.get('role'),
                            )
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'    Notification failed: {e}'))

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\nDRY RUN - would create {len(balance_purchases)} payment record(s)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nCreated {created} CollaboratorPayment record(s)'))
