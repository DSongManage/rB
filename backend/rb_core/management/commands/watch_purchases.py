"""
Auto-process pending purchases in development mode.

This command watches for new purchases and automatically processes them,
simulating the Stripe webhook flow for local testing.

Usage:
    python manage.py watch_purchases

    # Or run in background:
    python manage.py watch_purchases &

Features:
- Automatically detects new pending purchases
- Processes them immediately (simulates webhook)
- Runs continuously in the background
- Only works in DEBUG mode
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Q
from rb_core.models import Purchase
from rb_core.tasks import process_atomic_purchase
from decimal import Decimal
import time
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Watch and auto-process pending purchases (DEV MODE ONLY)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=5,
            help='Check interval in seconds (default: 5)',
        )
        parser.add_argument(
            '--once',
            action='store_true',
            help='Process pending purchases once and exit (no watching)',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            self.stdout.write(
                self.style.ERROR('❌ This command only works in DEBUG mode')
            )
            return

        interval = options['interval']
        run_once = options['once']

        self.stdout.write("=" * 70)
        self.stdout.write(self.style.SUCCESS("🔍 PURCHASE WATCHER STARTED"))
        self.stdout.write("=" * 70)
        self.stdout.write("")
        self.stdout.write("This will automatically process pending purchases for local testing.")
        self.stdout.write("Press Ctrl+C to stop.")
        self.stdout.write("")

        if run_once:
            self.stdout.write("Running once (--once mode)...")
            self.stdout.write("")
            self.process_pending_purchases()
            return

        processed_ids = set()

        try:
            while True:
                # Find new pending purchases (only after Stripe webhook completes payment)
                pending = Purchase.objects.filter(
                    status='payment_completed',  # Only process after Stripe checkout completes
                    usdc_distribution_status='pending'
                ).exclude(id__in=processed_ids).order_by('-purchased_at')

                for purchase in pending:
                    self.process_purchase(purchase)
                    processed_ids.add(purchase.id)

                # Sleep before next check
                time.sleep(interval)

        except KeyboardInterrupt:
            self.stdout.write("")
            self.stdout.write("=" * 70)
            self.stdout.write(self.style.SUCCESS("👋 Purchase watcher stopped"))
            self.stdout.write("=" * 70)

    def process_pending_purchases(self):
        """Process all pending purchases (for --once mode)."""

        pending = Purchase.objects.filter(
            status='payment_completed',  # Only process after Stripe checkout completes
            usdc_distribution_status='pending'
        ).order_by('-purchased_at')

        count = pending.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("✅ No pending purchases found!"))
            return

        self.stdout.write(f"Found {count} pending purchase(s)")
        self.stdout.write("")

        for purchase in pending:
            self.process_purchase(purchase)

    def process_purchase(self, purchase):
        """Process a single purchase."""

        chapter_name = purchase.chapter.title if purchase.chapter else (
            purchase.content.title if purchase.content else 'Unknown'
        )

        self.stdout.write("─" * 70)
        self.stdout.write(f"Processing Purchase #{purchase.id}")
        self.stdout.write(f"  👤 User: {purchase.user.username}")
        self.stdout.write(f"  📖 Item: {chapter_name}")
        self.stdout.write(f"  💰 Amount: ${purchase.purchase_price_usd}")
        self.stdout.write(f"  📊 Status: {purchase.status} → {purchase.usdc_distribution_status}")

        try:
            # Simulate webhook: Mark as payment_completed
            if purchase.status == 'payment_pending':
                purchase.status = 'payment_completed'
                purchase.gross_amount = purchase.purchase_price_usd
                purchase.stripe_fee = Decimal('0.09')  # Mock Stripe fee
                purchase.net_after_stripe = purchase.purchase_price_usd - purchase.stripe_fee
                purchase.save()

                self.stdout.write(f"  ✅ Updated to payment_completed")

            # Process atomic purchase (NFT mint + USDC distribution)
            self.stdout.write(f"  ⚙️  Running atomic settlement...")

            result = process_atomic_purchase(purchase.id)

            if result.get('success'):
                self.stdout.write(
                    self.style.SUCCESS(f"  ✅ Processing successful!")
                )
                nft_mint = result.get('nft_mint', 'N/A')
                tx_sig = result.get('tx_signature', 'N/A')

                if len(tx_sig) > 32:
                    tx_sig = tx_sig[:32] + '...'

                self.stdout.write(f"     🎨 NFT Mint: {nft_mint[:20]}...")
                self.stdout.write(f"     🔗 TX Sig: {tx_sig}")
                self.stdout.write(f"     💸 USDC Fronted: ${result.get('usdc_fronted', 0):.6f}")
                self.stdout.write(f"     💰 Platform Fee: ${result.get('usdc_earned', 0):.6f}")

                # Refresh purchase to show updated status
                purchase.refresh_from_db()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"     ✅ Purchase now {purchase.status} "
                        f"(USDC: {purchase.usdc_distribution_status})"
                    )
                )

            else:
                error = result.get('error', 'Unknown error')
                self.stdout.write(
                    self.style.ERROR(f"  ❌ Processing failed: {error}")
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"  ❌ Error: {e}")
            )
            logger.exception(f"Failed to process purchase {purchase.id}")

        self.stdout.write("")
