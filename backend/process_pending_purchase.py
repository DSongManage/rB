#!/usr/bin/env python
"""
Quick script to process pending purchases in development.

Usage:
    python process_pending_purchase.py

This will find your most recent pending purchase and process it.
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
django.setup()

from rb_core.models import Purchase
from rb_core.tasks import process_atomic_purchase
from decimal import Decimal

def process_pending_purchases():
    """Find and process all pending purchases."""

    # Find pending purchases
    pending = Purchase.objects.filter(
        status='payment_pending'
    ).order_by('-purchased_at')

    count = pending.count()

    if count == 0:
        print("✅ No pending purchases found!")
        return

    print(f"\n{'='*60}")
    print(f"Found {count} pending purchase(s)")
    print(f"{'='*60}\n")

    for purchase in pending:
        chapter_name = purchase.chapter.title if purchase.chapter else (
            purchase.content.title if purchase.content else 'Unknown'
        )

        print(f"Processing Purchase #{purchase.id}")
        print(f"  User: {purchase.user.username}")
        print(f"  Item: {chapter_name}")
        print(f"  Amount: ${purchase.purchase_price_usd}")
        print(f"  Status: {purchase.status}")

        try:
            # Simulate webhook: Mark as payment_completed
            purchase.status = 'payment_completed'
            purchase.gross_amount = purchase.purchase_price_usd
            purchase.stripe_fee = Decimal('0.09')  # Mock Stripe fee (2.9% + $0.30)
            purchase.net_after_stripe = purchase.purchase_price_usd - purchase.stripe_fee
            purchase.save()

            print(f"  ✅ Marked as payment_completed")

            # Process atomic purchase
            result = process_atomic_purchase(purchase.id)

            if result.get('success'):
                print(f"  ✅ Processing successful!")
                print(f"     NFT Mint: {result.get('nft_mint')}")
                print(f"     TX Signature: {result.get('tx_signature')[:32]}...")
            else:
                print(f"  ❌ Processing failed: {result.get('error')}")

            print()

        except Exception as e:
            print(f"  ❌ Error: {e}")
            import traceback
            traceback.print_exc()
            print()

    print(f"{'='*60}")
    print("Done! Your purchases should now appear in your library.")
    print(f"{'='*60}\n")

if __name__ == '__main__':
    process_pending_purchases()
