"""
Management command to test atomic NFT minting + USDC distribution on devnet.

Usage:
    # Test with mock data (no real transactions)
    python manage.py test_atomic_purchase --mock

    # Test on devnet with real transactions
    python manage.py test_atomic_purchase --devnet

    # Test specific purchase
    python manage.py test_atomic_purchase --purchase-id 12

    # Full integration test
    python manage.py test_atomic_purchase --full-test

This command tests:
1. SOL price oracle integration
2. IPFS metadata upload
3. Atomic NFT minting + USDC distribution
4. Fee calculations
"""

import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Test atomic NFT minting and USDC distribution'

    def add_arguments(self, parser):
        parser.add_argument(
            '--mock',
            action='store_true',
            help='Use mock implementation (no real blockchain calls)',
        )
        parser.add_argument(
            '--devnet',
            action='store_true',
            help='Run on Solana devnet with real transactions',
        )
        parser.add_argument(
            '--purchase-id',
            type=int,
            help='Test with a specific purchase ID',
        )
        parser.add_argument(
            '--full-test',
            action='store_true',
            help='Run full integration test suite',
        )
        parser.add_argument(
            '--test-price-oracle',
            action='store_true',
            help='Only test SOL price oracle',
        )
        parser.add_argument(
            '--test-metadata',
            action='store_true',
            help='Only test IPFS metadata upload',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO('\n' + '=' * 80))
        self.stdout.write(self.style.HTTP_INFO('ATOMIC PURCHASE TEST SUITE'))
        self.stdout.write(self.style.HTTP_INFO('=' * 80 + '\n'))

        if options['test_price_oracle']:
            self._test_price_oracle()
            return

        if options['test_metadata']:
            self._test_metadata_upload()
            return

        if options['full_test']:
            self._run_full_test(options)
            return

        if options['purchase_id']:
            self._test_existing_purchase(options['purchase_id'], options['mock'])
            return

        # Default: run basic tests
        self._test_price_oracle()
        self._test_metadata_upload()
        self._test_mock_atomic_transaction()

    def _test_price_oracle(self):
        """Test SOL price oracle integration."""
        self.stdout.write(self.style.HTTP_INFO('\n--- Testing SOL Price Oracle ---\n'))

        try:
            from blockchain.price_oracle import (
                get_sol_price_usd,
                convert_lamports_to_usd,
                convert_sol_to_usd
            )

            # Test price fetch
            self.stdout.write('Fetching SOL price from CoinGecko...')
            price = get_sol_price_usd(use_cache=False)
            self.stdout.write(self.style.SUCCESS(f'✅ SOL Price: ${price}'))

            # Test cached fetch
            self.stdout.write('Testing cached price...')
            cached_price = get_sol_price_usd(use_cache=True)
            self.stdout.write(self.style.SUCCESS(f'✅ Cached Price: ${cached_price}'))

            # Test conversions
            self.stdout.write('Testing conversions...')

            # 10,000 lamports (typical tx fee)
            fee_usd = convert_lamports_to_usd(10000)
            self.stdout.write(f'  10,000 lamports = ${fee_usd}')

            # 0.01 SOL
            sol_usd = convert_sol_to_usd(Decimal('0.01'))
            self.stdout.write(f'  0.01 SOL = ${sol_usd}')

            self.stdout.write(self.style.SUCCESS('\n✅ Price oracle tests passed!\n'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Price oracle test failed: {e}'))
            raise

    def _test_metadata_upload(self):
        """Test IPFS metadata upload."""
        self.stdout.write(self.style.HTTP_INFO('\n--- Testing IPFS Metadata Upload ---\n'))

        try:
            from blockchain.metadata_service import (
                create_chapter_nft_metadata,
                upload_metadata_to_ipfs
            )

            # Create test metadata
            self.stdout.write('Creating test metadata...')
            metadata = create_chapter_nft_metadata(
                chapter_title="Test Chapter",
                chapter_description="This is a test chapter for the atomic purchase system.",
                content_title="Test Book",
                creator_name="TestCreator",
                creator_wallet="DevnetTestWallet123456789",
                chapter_number=1,
                cover_image_url="https://renaissblock.com/test-cover.png",
                collaborators=[
                    {'wallet': 'Creator1Wallet', 'percentage': 60},
                    {'wallet': 'Creator2Wallet', 'percentage': 40},
                ],
                edition_number=1,
                total_editions=100,
                purchase_price_usd=Decimal('1.00')
            )

            self.stdout.write(f'  Name: {metadata["name"]}')
            self.stdout.write(f'  Symbol: {metadata["symbol"]}')
            self.stdout.write(f'  Attributes: {len(metadata["attributes"])} items')

            # Upload to IPFS (or mock)
            self.stdout.write('Uploading to IPFS...')
            uri = upload_metadata_to_ipfs(metadata)
            self.stdout.write(self.style.SUCCESS(f'✅ Metadata URI: {uri}'))

            # Verify it's a valid URI
            if uri.startswith('https://') or uri.startswith('ipfs://'):
                self.stdout.write(self.style.SUCCESS('\n✅ Metadata upload tests passed!\n'))
            else:
                self.stdout.write(self.style.WARNING(f'⚠️ Unexpected URI format: {uri}'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Metadata upload test failed: {e}'))
            raise

    def _test_mock_atomic_transaction(self):
        """Test atomic transaction with mock data."""
        self.stdout.write(self.style.HTTP_INFO('\n--- Testing Mock Atomic Transaction ---\n'))

        try:
            from blockchain.solana_service import mint_and_distribute_atomic

            # Create mock collaborator data
            class MockUser:
                def __init__(self, username):
                    self.username = username

            # Use valid Solana devnet addresses for testing
            # These are real devnet addresses (won't have funds, but valid format)
            TEST_WALLET_1 = 'Gu3LDkn3Acg5ZjRrzbTvpN1DXRK4gQBe7RrwuBzNUwJH'
            TEST_WALLET_2 = '5YNmS1R9nNSCDzb5a7mMJ1dwK9uHeAAF4CmPEwKgVWr8'
            TEST_BUYER = 'FG4Y3yX4AAchp1HvNZ7LfzFTewF2f6nDoMDCohTFrdpk'

            collaborators = [
                {
                    'user': MockUser('creator1'),
                    'wallet_address': TEST_WALLET_1,
                    'amount_usdc': 0.45,
                    'percentage': 50,
                    'role': 'author'
                },
                {
                    'user': MockUser('creator2'),
                    'wallet_address': TEST_WALLET_2,
                    'amount_usdc': 0.45,
                    'percentage': 50,
                    'role': 'illustrator'
                }
            ]

            self.stdout.write('Executing mock atomic transaction...')
            result = mint_and_distribute_atomic(
                buyer_wallet_address=TEST_BUYER,
                metadata_uri='https://arweave.net/test_metadata',
                nft_name='Test NFT',
                nft_symbol='TEST',
                collaborator_payments=collaborators,
                platform_usdc_amount=0.10,
                total_usdc_amount=1.00
            )

            self.stdout.write(f'  Success: {result["success"]}')
            self.stdout.write(f'  NFT Mint: {result["nft_mint_address"]}')
            self.stdout.write(f'  Transaction: {result["transaction_signature"]}')
            self.stdout.write(f'  Gas Fee: ${result.get("actual_gas_fee_usd", "N/A")}')

            if result['success']:
                self.stdout.write(self.style.SUCCESS('\n✅ Mock atomic transaction passed!\n'))
            else:
                self.stdout.write(self.style.ERROR(f'❌ Transaction failed'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Mock atomic transaction failed: {e}'))
            raise

    def _test_existing_purchase(self, purchase_id, use_mock=False):
        """Test with an existing purchase."""
        self.stdout.write(self.style.HTTP_INFO(f'\n--- Testing Purchase #{purchase_id} ---\n'))

        try:
            from rb_core.models import Purchase
            from rb_core.tasks import process_atomic_purchase

            purchase = Purchase.objects.get(id=purchase_id)

            self.stdout.write(f'Purchase Details:')
            self.stdout.write(f'  ID: {purchase.id}')
            self.stdout.write(f'  Status: {purchase.status}')
            self.stdout.write(f'  User: {purchase.user.username}')
            self.stdout.write(f'  Content: {purchase.content.title if purchase.content else "N/A"}')
            self.stdout.write(f'  Chapter: {purchase.chapter.title if purchase.chapter else "N/A"}')
            self.stdout.write(f'  Price: ${purchase.chapter_price or purchase.purchase_price_usd}')

            if use_mock or input('\nProcess this purchase? (y/N): ').lower() == 'y':
                self.stdout.write('\nProcessing...')
                result = process_atomic_purchase(purchase_id)

                self.stdout.write(f'\nResult:')
                for key, value in result.items():
                    self.stdout.write(f'  {key}: {value}')

                if result.get('success'):
                    self.stdout.write(self.style.SUCCESS('\n✅ Purchase processed successfully!'))
                else:
                    self.stdout.write(self.style.ERROR(f'\n❌ Purchase failed: {result.get("error")}'))

        except Purchase.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Purchase #{purchase_id} not found'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {e}'))
            raise

    def _run_full_test(self, options):
        """Run full integration test suite."""
        self.stdout.write(self.style.HTTP_INFO('\n' + '=' * 80))
        self.stdout.write(self.style.HTTP_INFO('FULL INTEGRATION TEST'))
        self.stdout.write(self.style.HTTP_INFO('=' * 80))

        tests_passed = 0
        tests_failed = 0

        # Test 1: Price Oracle
        try:
            self._test_price_oracle()
            tests_passed += 1
        except Exception:
            tests_failed += 1

        # Test 2: Metadata Upload
        try:
            self._test_metadata_upload()
            tests_passed += 1
        except Exception:
            tests_failed += 1

        # Test 3: Mock Atomic Transaction
        try:
            self._test_mock_atomic_transaction()
            tests_passed += 1
        except Exception:
            tests_failed += 1

        # Test 4: Fee Calculation
        try:
            self._test_fee_calculation()
            tests_passed += 1
        except Exception:
            tests_failed += 1

        # Summary
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(f'RESULTS: {tests_passed} passed, {tests_failed} failed')
        self.stdout.write('=' * 80 + '\n')

        if tests_failed == 0:
            self.stdout.write(self.style.SUCCESS('✅ ALL TESTS PASSED!'))
        else:
            self.stdout.write(self.style.ERROR(f'❌ {tests_failed} TEST(S) FAILED'))

    def _test_fee_calculation(self):
        """Test fee calculation accuracy."""
        self.stdout.write(self.style.HTTP_INFO('\n--- Testing Fee Calculations ---\n'))

        from rb_core.payment_utils import calculate_payment_breakdown

        test_prices = [Decimal('1.00'), Decimal('5.00'), Decimal('10.00')]

        for price in test_prices:
            breakdown = calculate_payment_breakdown(price)

            self.stdout.write(f'\nChapter Price: ${price}')
            self.stdout.write(f'  Buyer Total: ${breakdown["buyer_total"]}')
            self.stdout.write(f'  Stripe Fee: ${breakdown["stripe_fee"]}')
            self.stdout.write(f'  Platform Receives: ${breakdown["platform_receives"]}')
            self.stdout.write(f'  Creator USDC: ${breakdown["creator_usdc"]}')
            self.stdout.write(f'  Platform USDC: ${breakdown["platform_usdc"]}')
            self.stdout.write(f'  Gas Fee: ${breakdown["gas_fee"]}')

            # Verify math
            total_distributed = breakdown['creator_usdc'] + breakdown['platform_usdc']
            expected = breakdown['usdc_to_distribute']

            if abs(total_distributed - expected) < Decimal('0.01'):
                self.stdout.write(self.style.SUCCESS(f'  ✅ Math verified'))
            else:
                self.stdout.write(self.style.ERROR(f'  ❌ Math error: {total_distributed} != {expected}'))
                raise ValueError("Fee calculation mismatch")

        self.stdout.write(self.style.SUCCESS('\n✅ Fee calculation tests passed!\n'))
