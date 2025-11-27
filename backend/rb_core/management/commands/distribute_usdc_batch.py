"""
Django management command for weekly USDC distribution to creators.

This command should be run via cron every Monday at 9am after manual USD → USDC conversion.

Usage:
    python manage.py distribute_usdc_batch

Workflow:
1. Admin manually converts USD from Stripe to USDC (Stripe → Coinbase → Buy USDC → Circle W3S platform wallet)
2. Admin confirms USDC is in platform wallet
3. Run this command to distribute USDC to all pending creators
"""

import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db.models import Q, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Distribute pending USDC to creators (run weekly after USD → USDC conversion)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be distributed without actually distributing',
        )
        parser.add_argument(
            '--auto-confirm',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        auto_confirm = options['auto_confirm']

        self.stdout.write(self.style.WARNING('\n' + '='*80))
        self.stdout.write(self.style.WARNING('WEEKLY USDC DISTRIBUTION TO CREATORS'))
        self.stdout.write(self.style.WARNING('='*80 + '\n'))

        # Get all purchases pending distribution
        from rb_core.models import Purchase

        pending_purchases = Purchase.objects.filter(
            Q(usdc_payment_status='pending_distribution') | Q(usdc_payment_status='pending_conversion'),
            usdc_amount__isnull=False,
            usdc_amount__gt=0
        ).select_related('content__creator', 'user')

        if not pending_purchases.exists():
            self.stdout.write(self.style.SUCCESS('✅ No pending USDC distributions'))
            return

        # Calculate totals
        total_count = pending_purchases.count()
        total_usdc = pending_purchases.aggregate(total=Sum('usdc_amount'))['total'] or Decimal('0')

        # Group by creator
        creator_totals = {}
        for purchase in pending_purchases:
            creator = purchase.content.creator.username
            if creator not in creator_totals:
                creator_totals[creator] = {
                    'amount': Decimal('0'),
                    'purchases': []
                }
            creator_totals[creator]['amount'] += purchase.usdc_amount
            creator_totals[creator]['purchases'].append(purchase.id)

        # Display summary
        self.stdout.write(self.style.WARNING(f'\n📊 DISTRIBUTION SUMMARY:'))
        self.stdout.write(f'  Total purchases: {total_count}')
        self.stdout.write(f'  Total USDC to distribute: {total_usdc} USDC')
        self.stdout.write(f'  Number of creators: {len(creator_totals)}')

        self.stdout.write(self.style.WARNING(f'\n📋 BREAKDOWN BY CREATOR:'))
        for creator, data in sorted(creator_totals.items(), key=lambda x: x[1]['amount'], reverse=True):
            self.stdout.write(
                f'  {creator:30} {data["amount"]:>10} USDC  ({len(data["purchases"])} purchases)'
            )

        # Check platform wallet balance
        self.stdout.write(self.style.WARNING(f'\n💰 PLATFORM WALLET CHECK:'))
        try:
            from blockchain.circle_w3s_service import get_circle_w3s_service
            circle_service = get_circle_w3s_service()
            platform_balance = circle_service.get_wallet_balance(circle_service.platform_wallet_id)

            self.stdout.write(f'  Platform wallet balance: {platform_balance} USDC')

            if platform_balance < total_usdc:
                self.stdout.write(self.style.ERROR(
                    f'\n  ⚠️  WARNING: Insufficient balance!'
                ))
                self.stdout.write(self.style.ERROR(
                    f'  Need: {total_usdc} USDC'
                ))
                self.stdout.write(self.style.ERROR(
                    f'  Have: {platform_balance} USDC'
                ))
                self.stdout.write(self.style.ERROR(
                    f'  Short: {total_usdc - platform_balance} USDC'
                ))
                self.stdout.write(self.style.ERROR(
                    f'\n  Please convert more USD to USDC before distributing.\n'
                ))
                return
            else:
                self.stdout.write(self.style.SUCCESS(
                    f'  ✅ Sufficient balance to distribute'
                ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'  ⚠️  Could not check platform wallet balance: {e}'
            ))
            self.stdout.write(self.style.WARNING(
                f'  Proceeding anyway (check Circle W3S dashboard manually)'
            ))

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n🔍 DRY RUN - No distributions will be made\n'))
            return

        # Confirm before distributing
        if not auto_confirm:
            self.stdout.write(self.style.WARNING(
                f'\n⚠️  This will distribute {total_usdc} USDC to {len(creator_totals)} creators.'
            ))
            confirm = input('Continue? (yes/no): ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.ERROR('Aborted'))
                return

        # Process distributions
        self.stdout.write(self.style.WARNING(f'\n🚀 DISTRIBUTING USDC...\n'))

        from rb_core.tasks import distribute_usdc_to_creator_task

        # First, update all to pending_distribution status
        updated = pending_purchases.filter(
            usdc_payment_status='pending_conversion'
        ).update(
            usdc_payment_status='pending_distribution'
        )

        if updated > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f'  Updated {updated} purchases from pending_conversion → pending_distribution'
                )
            )

        # Queue distribution tasks
        success_count = 0
        error_count = 0

        for purchase in pending_purchases:
            try:
                # Queue Celery task for each purchase
                result = distribute_usdc_to_creator_task.delay(purchase.id)

                self.stdout.write(
                    f'  ✅ Queued distribution for purchase {purchase.id} '
                    f'({purchase.usdc_amount} USDC to {purchase.content.creator.username})'
                )
                success_count += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  ❌ Failed to queue purchase {purchase.id}: {e}'
                ))
                error_count += 1

        # Summary
        self.stdout.write(self.style.WARNING(f'\n' + '='*80))
        self.stdout.write(self.style.SUCCESS(f'✅ DISTRIBUTION COMPLETE'))
        self.stdout.write(f'  Queued: {success_count}')
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'  Errors: {error_count}'))
        self.stdout.write(self.style.WARNING('='*80 + '\n'))

        self.stdout.write(self.style.WARNING(
            'Note: Distributions are processing asynchronously via Celery.\n'
            'Check logs and database for final status.'
        ))
