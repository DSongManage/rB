"""
Management command to manually process a purchase.

Usage:
    python manage.py process_purchase 12
    python manage.py process_purchase 12 --dry-run

This is useful for:
- Retrying failed purchases after webhook issues
- Processing purchases that were paid but not fulfilled
"""

from django.core.management.base import BaseCommand
from rb_core.models import Purchase


class Command(BaseCommand):
    help = 'Manually process a purchase (mint NFT, distribute USDC)'

    def add_arguments(self, parser):
        parser.add_argument(
            'purchase_id',
            type=int,
            help='The purchase ID to process',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show purchase details without processing',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Process even if status is already completed',
        )

    def handle(self, *args, **options):
        purchase_id = options['purchase_id']
        dry_run = options['dry_run']
        force = options['force']

        try:
            purchase = Purchase.objects.get(id=purchase_id)
        except Purchase.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Purchase {purchase_id} not found')
            )
            return

        # Display purchase info
        self.stdout.write(self.style.HTTP_INFO('\n=== Purchase Details ==='))
        self.stdout.write(f'ID: {purchase.id}')
        self.stdout.write(f'Status: {purchase.status}')
        self.stdout.write(f'User: {purchase.user.username}')

        if purchase.content:
            self.stdout.write(f'Content: {purchase.content.title}')
        if purchase.chapter:
            self.stdout.write(f'Chapter: {purchase.chapter.title}')

        self.stdout.write(f'Price: ${purchase.chapter_price or purchase.purchase_price_usd}')
        self.stdout.write(f'Stripe Charge: {purchase.stripe_charge_id or "N/A"}')
        self.stdout.write(f'NFT Mint: {purchase.nft_mint_address or "Not minted"}')
        self.stdout.write(f'Created: {purchase.purchased_at}')
        self.stdout.write('')

        # Check if already completed
        if purchase.status == 'completed' and not force:
            self.stdout.write(
                self.style.WARNING(
                    f'Purchase {purchase_id} is already completed. '
                    f'Use --force to reprocess.'
                )
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN - Would process this purchase')
            )
            return

        # Process the purchase
        self.stdout.write(self.style.HTTP_INFO('Processing purchase...'))

        try:
            from rb_core.tasks import process_atomic_purchase
            result = process_atomic_purchase(purchase_id)

            if result.get('success'):
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nPurchase {purchase_id} processed successfully!'
                    )
                )
                self.stdout.write(f'NFT Mint: {result.get("nft_mint_address", "N/A")}')
                self.stdout.write(f'Transaction: {result.get("transaction_signature", "N/A")}')
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f'\nPurchase processing failed: {result.get("error", "Unknown error")}'
                    )
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'\nError processing purchase: {e}')
            )
            raise
