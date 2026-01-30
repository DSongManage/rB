"""
Auto-process pending purchases in development mode.

This command watches for new purchases and automatically processes them,
simulating the Stripe webhook flow for local testing.

Usage:
    python manage.py watch_purchases

    # Or run in background:
    python manage.py watch_purchases &

Features:
- Automatically detects new pending purchases (single AND batch/cart)
- Processes them immediately (simulates webhook)
- Runs continuously in the background
- Only works in DEBUG mode
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from rb_core.models import Purchase, BatchPurchase
from rb_core.tasks import process_atomic_purchase, process_batch_purchase
from rb_core.payment_utils import calculate_payment_breakdown
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
        parser.add_argument(
            '--delay',
            type=int,
            default=10,
            help='Only process purchases older than this many seconds (default: 10)',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            self.stdout.write(
                self.style.ERROR('❌ This command only works in DEBUG mode')
            )
            return

        interval = options['interval']
        run_once = options['once']
        delay_seconds = options['delay']

        self.stdout.write("=" * 70)
        self.stdout.write(self.style.SUCCESS("🔍 PURCHASE WATCHER STARTED"))
        self.stdout.write("=" * 70)
        self.stdout.write("")
        self.stdout.write("This will automatically process pending purchases for local testing.")
        self.stdout.write("Watches for BOTH single-item purchases AND cart/batch purchases.")
        self.stdout.write(f"Purchases must be at least {delay_seconds} seconds old before processing.")
        self.stdout.write("Press Ctrl+C to stop.")
        self.stdout.write("")

        if run_once:
            self.stdout.write("Running once (--once mode)...")
            self.stdout.write("")
            self.process_pending_purchases(delay_seconds)
            self.process_pending_batch_purchases(delay_seconds)
            return

        processed_ids = set()
        processed_batch_ids = set()

        try:
            while True:
                # Calculate cutoff time (only process purchases older than delay_seconds)
                cutoff_time = timezone.now() - timedelta(seconds=delay_seconds)

                # ═══════════════════════════════════════════════════════════════
                # SINGLE-ITEM PURCHASES
                # ═══════════════════════════════════════════════════════════════
                pending = Purchase.objects.filter(
                    status='payment_pending',
                    usdc_distribution_status='pending',
                    purchased_at__lt=cutoff_time
                ).exclude(id__in=processed_ids).order_by('-purchased_at')

                count = pending.count()
                if count > 0:
                    self.stdout.write(f"\n[DEBUG] Found {count} single purchase(s) older than {delay_seconds}s")

                for purchase in pending:
                    self.process_purchase(purchase)
                    processed_ids.add(purchase.id)

                # ═══════════════════════════════════════════════════════════════
                # BATCH/CART PURCHASES
                # ═══════════════════════════════════════════════════════════════
                pending_batches = BatchPurchase.objects.filter(
                    status='payment_pending',
                    created_at__lt=cutoff_time
                ).exclude(id__in=processed_batch_ids).order_by('-created_at')

                batch_count = pending_batches.count()
                if batch_count > 0:
                    self.stdout.write(f"\n[DEBUG] Found {batch_count} batch purchase(s) older than {delay_seconds}s")

                for batch in pending_batches:
                    self.process_batch(batch)
                    processed_batch_ids.add(batch.id)

                # Sleep before next check
                time.sleep(interval)

        except KeyboardInterrupt:
            self.stdout.write("")
            self.stdout.write("=" * 70)
            self.stdout.write(self.style.SUCCESS("👋 Purchase watcher stopped"))
            self.stdout.write("=" * 70)

    def process_pending_purchases(self, delay_seconds=120):
        """Process all pending purchases (for --once mode)."""

        # Calculate cutoff time
        cutoff_time = timezone.now() - timedelta(seconds=delay_seconds)

        pending = Purchase.objects.filter(
            status='payment_pending',  # Simulate webhook
            usdc_distribution_status='pending',
            purchased_at__lt=cutoff_time  # Only process old purchases
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

        # Calculate age of purchase for debugging
        age_seconds = (timezone.now() - purchase.purchased_at).total_seconds()

        self.stdout.write("─" * 70)
        self.stdout.write(f"Processing Purchase #{purchase.id}")
        self.stdout.write(f"  👤 User: {purchase.user.username}")
        self.stdout.write(f"  📖 Item: {chapter_name}")
        self.stdout.write(f"  💰 Amount: ${purchase.purchase_price_usd}")
        self.stdout.write(f"  ⏰ Age: {age_seconds:.0f} seconds (created at {purchase.purchased_at})")
        self.stdout.write(f"  📊 Status: {purchase.status} → {purchase.usdc_distribution_status}")

        # Debug: Show fee breakdown fields
        self.stdout.write(f"  📋 chapter_price: {purchase.chapter_price}, credit_card_fee: {purchase.credit_card_fee}, buyer_total: {purchase.buyer_total}")

        # SAFETY CHECK: Don't process purchases that are too new (user might still be paying)
        # This is a backup check - the query should already filter these out
        MIN_AGE_SECONDS = 10  # At minimum, wait 10 seconds (for dev testing)
        if age_seconds < MIN_AGE_SECONDS:
            self.stdout.write(
                self.style.WARNING(
                    f"  ⚠️  SKIPPING: Purchase is only {age_seconds:.0f}s old (min: {MIN_AGE_SECONDS}s). "
                    f"User may still be completing payment."
                )
            )
            return

        try:
            # Simulate webhook: Mark as payment_completed
            if purchase.status == 'payment_pending':
                purchase.status = 'payment_completed'

                # If this is a new purchase with fee breakdown (chapter purchase)
                if purchase.chapter_price is not None:
                    # Use the pre-calculated breakdown
                    breakdown = calculate_payment_breakdown(purchase.chapter_price)
                    purchase.gross_amount = breakdown['buyer_total']
                    purchase.stripe_fee = breakdown['stripe_fee']
                    purchase.net_after_stripe = breakdown['platform_receives']
                else:
                    # Legacy content purchase - use old calculation
                    purchase.gross_amount = purchase.purchase_price_usd
                    purchase.stripe_fee = (purchase.purchase_price_usd * Decimal('0.029')) + Decimal('0.30')
                    purchase.net_after_stripe = purchase.purchase_price_usd - purchase.stripe_fee

                purchase.save()

                self.stdout.write(f"  ✅ Updated to payment_completed")
                if purchase.chapter_price:
                    self.stdout.write(
                        f"  💳 FEE PASS-THROUGH: Item: ${purchase.chapter_price:.2f} + "
                        f"CC Fee: ${purchase.credit_card_fee:.2f} = "
                        f"Buyer Paid: ${purchase.buyer_total:.2f}"
                    )
                else:
                    self.stdout.write(
                        f"  💳 LEGACY FEE: Buyer Paid: ${purchase.purchase_price_usd:.2f}, "
                        f"Stripe deducted from creator's share"
                    )

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

                # Get actual distribution amounts
                total_usdc = result.get('usdc_fronted', 0)
                platform_fee = result.get('usdc_earned', 0)

                self.stdout.write(f"     💸 USDC Distribution:")
                self.stdout.write(f"        Total pool: ${total_usdc:.6f} USDC")

                # Show actual collaborator breakdown from purchase record
                purchase.refresh_from_db()
                if purchase.distribution_details and 'collaborators' in purchase.distribution_details:
                    collaborators = purchase.distribution_details['collaborators']
                    self.stdout.write(f"        Collaborators ({len(collaborators)}):")
                    for collab in collaborators:
                        self.stdout.write(
                            f"          → {collab['user']}: ${collab['amount']:.6f} USDC "
                            f"({collab['percentage']}%) [{collab.get('role', 'collaborator')}]"
                        )
                else:
                    # Fallback display if no distribution details
                    creator_gets = total_usdc - platform_fee
                    self.stdout.write(f"        To creator(s): ${creator_gets:.6f} USDC")

                self.stdout.write(f"        Platform fee: ${platform_fee:.6f} USDC ← kept in treasury")

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

    def process_pending_batch_purchases(self, delay_seconds=120):
        """Process all pending batch purchases (for --once mode)."""
        cutoff_time = timezone.now() - timedelta(seconds=delay_seconds)

        pending = BatchPurchase.objects.filter(
            status='payment_pending',
            created_at__lt=cutoff_time
        ).order_by('-created_at')

        count = pending.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("✅ No pending batch purchases found!"))
            return

        self.stdout.write(f"Found {count} pending batch purchase(s)")
        self.stdout.write("")

        for batch in pending:
            self.process_batch(batch)

    def process_batch(self, batch):
        """Process a batch/cart purchase by verifying Stripe payment and triggering processing."""
        age_seconds = (timezone.now() - batch.created_at).total_seconds()

        self.stdout.write("─" * 70)
        self.stdout.write(self.style.WARNING(f"🛒 Processing BATCH Purchase #{batch.id}"))
        self.stdout.write(f"  👤 User: {batch.user.username}")
        self.stdout.write(f"  📦 Items: {batch.total_items}")
        self.stdout.write(f"  💰 Total: ${batch.total_charged}")
        self.stdout.write(f"  ⏰ Age: {age_seconds:.0f} seconds")
        self.stdout.write(f"  📊 Status: {batch.status}")
        self.stdout.write(f"  🔗 Session: {batch.stripe_checkout_session_id[:30]}...")

        # Safety check
        MIN_AGE_SECONDS = 10
        if age_seconds < MIN_AGE_SECONDS:
            self.stdout.write(
                self.style.WARNING(
                    f"  ⚠️  SKIPPING: Batch is only {age_seconds:.0f}s old (min: {MIN_AGE_SECONDS}s)."
                )
            )
            return

        try:
            # Verify payment with Stripe
            self.stdout.write(f"  🔍 Checking Stripe session status...")
            session = stripe.checkout.Session.retrieve(batch.stripe_checkout_session_id)

            if session.payment_status != 'paid':
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⏳ Payment not completed yet (status: {session.payment_status}). Skipping."
                    )
                )
                return

            self.stdout.write(self.style.SUCCESS(f"  ✅ Stripe payment confirmed!"))

            # Update batch status to payment_completed (simulating webhook)
            batch.stripe_payment_intent_id = session.payment_intent or ''
            batch.status = 'payment_completed'
            batch.save(update_fields=['stripe_payment_intent_id', 'status'])

            self.stdout.write(f"  ⚙️  Running batch processing...")

            # Process the batch (this creates individual Purchase records and mints NFTs)
            result = process_batch_purchase(batch.id)

            if result.get('status') in ['completed', 'partial']:
                self.stdout.write(
                    self.style.SUCCESS(f"  ✅ Batch processing successful!")
                )
                self.stdout.write(f"     📊 Status: {result.get('status')}")
                self.stdout.write(f"     ✅ Minted: {result.get('items_minted', 0)}/{batch.total_items}")
                self.stdout.write(f"     ❌ Failed: {result.get('items_failed', 0)}")

                if result.get('total_refunded', 0) > 0:
                    self.stdout.write(f"     💸 Refunded: ${result.get('total_refunded', 0)}")

                # Show individual item results
                if result.get('successful_items'):
                    self.stdout.write(f"     🎨 NFTs Minted:")
                    for item in result['successful_items']:
                        nft_mint = item.get('nft_mint', 'N/A')
                        if len(nft_mint) > 20:
                            nft_mint = nft_mint[:20] + '...'
                        self.stdout.write(f"        → {item['item_type']} #{item['item_id']}: {nft_mint}")
            else:
                error = result.get('error', 'Unknown error')
                self.stdout.write(
                    self.style.ERROR(f"  ❌ Batch processing failed: {error}")
                )

        except stripe.error.StripeError as e:
            self.stdout.write(
                self.style.ERROR(f"  ❌ Stripe error: {e}")
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"  ❌ Error: {e}")
            )
            logger.exception(f"Failed to process batch {batch.id}")

        self.stdout.write("")
