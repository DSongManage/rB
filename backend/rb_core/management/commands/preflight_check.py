"""
Pre-flight check for USDC payment flow.

This command verifies that all components are properly configured
and ready for testing the complete payment flow.

Usage:
    python manage.py preflight_check
"""

from django.core.management.base import BaseCommand
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Pre-flight check for USDC payment flow'

    def __init__(self):
        super().__init__()
        self.errors = []
        self.warnings = []

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed information',
        )

    def handle(self, *args, **options):
        verbose = options.get('verbose', False)

        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("USDC PAYMENT FLOW PRE-FLIGHT CHECK"))
        self.stdout.write("=" * 80)
        self.stdout.write("")

        # Run all checks
        self.check_environment_variables()
        self.check_platform_wallet_file()
        self.check_solana_connection()
        self.check_platform_usdc_balance()
        self.check_database_models()
        self.check_celery_availability()
        self.check_users_with_wallets()
        self.check_url_endpoints()

        # Summary
        self.stdout.write("")
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("PRE-FLIGHT CHECK SUMMARY"))
        self.stdout.write("=" * 80)

        if self.errors:
            self.stdout.write("")
            self.stdout.write(self.style.ERROR("❌ ERRORS FOUND:"))
            for err in self.errors:
                self.stdout.write(f"  - {err}")

        if self.warnings:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("⚠️  WARNINGS:"))
            for warn in self.warnings:
                self.stdout.write(f"  - {warn}")

        if not self.errors and not self.warnings:
            self.stdout.write("")
            self.stdout.write(self.style.SUCCESS("✅ ALL CHECKS PASSED - READY FOR TESTING!"))

        self.stdout.write("=" * 80)
        self.stdout.write("")

    def check_environment_variables(self):
        """Check required environment variables."""
        self.stdout.write("1. Checking Environment Variables...")

        required_vars = {
            'SOLANA_RPC_URL': 'Solana RPC endpoint',
            'PLATFORM_USDC_WALLET_ADDRESS': 'Platform treasury wallet address',
            'PLATFORM_WALLET_KEYPAIR_PATH': 'Path to platform wallet keypair file',
            'USDC_MINT_ADDRESS': 'USDC token mint address',
            'STRIPE_SECRET_KEY': 'Stripe secret key',
            'STRIPE_WEBHOOK_SECRET': 'Stripe webhook signing secret',
        }

        all_present = True

        for var, description in required_vars.items():
            value = getattr(settings, var, None)
            if value:
                # Mask sensitive values
                if 'SECRET' in var or 'KEY' in var:
                    display_value = f"{value[:20]}..." if len(value) > 20 else "***"
                else:
                    display_value = value

                self.stdout.write(f"   ✅ {var}: {display_value}")
            else:
                self.stdout.write(f"   ❌ {var}: NOT SET")
                self.errors.append(f"Missing environment variable: {var} ({description})")
                all_present = False

        # Check network setting
        network = getattr(settings, 'SOLANA_NETWORK', 'devnet')
        self.stdout.write(f"   ✅ SOLANA_NETWORK: {network}")

        if network != 'devnet':
            self.warnings.append(f"Solana network is set to '{network}' (expected 'devnet')")

        self.stdout.write("")

    def check_platform_wallet_file(self):
        """Check platform wallet keypair file exists."""
        self.stdout.write("2. Checking Platform Wallet File...")

        wallet_path = getattr(settings, 'PLATFORM_WALLET_KEYPAIR_PATH', '')

        if not wallet_path:
            self.stdout.write(f"   ❌ No wallet path configured")
            self.errors.append("PLATFORM_WALLET_KEYPAIR_PATH not set")
        elif os.path.exists(wallet_path):
            self.stdout.write(f"   ✅ Platform wallet file exists")
            self.stdout.write(f"      Path: {wallet_path}")

            # Try to load it
            try:
                import json
                with open(wallet_path, 'r') as f:
                    keypair_data = json.load(f)

                if isinstance(keypair_data, list) and len(keypair_data) == 64:
                    self.stdout.write(f"   ✅ Keypair file format is valid")
                else:
                    self.errors.append(f"Keypair file has invalid format (expected array of 64 bytes)")
            except Exception as e:
                self.errors.append(f"Failed to load keypair file: {e}")
        else:
            self.stdout.write(f"   ❌ Platform wallet file not found")
            self.errors.append(f"Platform wallet file not found: {wallet_path}")

        self.stdout.write("")

    def check_solana_connection(self):
        """Check Solana RPC connectivity."""
        self.stdout.write("3. Checking Solana RPC Connection...")

        try:
            from solana.rpc.api import Client

            rpc_url = getattr(settings, 'SOLANA_RPC_URL', None)
            if not rpc_url:
                self.errors.append("SOLANA_RPC_URL not configured")
                return

            client = Client(rpc_url)
            version = client.get_version()

            self.stdout.write(f"   ✅ Solana RPC connected")
            self.stdout.write(f"      URL: {rpc_url}")
            self.stdout.write(f"      Version: {version.value}")

        except ImportError:
            self.stdout.write(f"   ⚠️  Solana libraries not installed")
            self.warnings.append("Solana SDK not installed (will use mock data)")
            self.stdout.write(f"      Install with: pip install solana solders spl-token")
        except Exception as e:
            self.stdout.write(f"   ❌ Solana RPC connection failed")
            self.errors.append(f"Solana RPC connection failed: {e}")

        self.stdout.write("")

    def check_platform_usdc_balance(self):
        """Check platform USDC balance."""
        self.stdout.write("4. Checking Platform USDC Balance...")

        try:
            from blockchain.solana_service import get_platform_usdc_balance

            balance = get_platform_usdc_balance()

            wallet_address = getattr(settings, 'PLATFORM_USDC_WALLET_ADDRESS', 'Unknown')
            self.stdout.write(f"   ✅ Platform USDC balance: {balance}")
            self.stdout.write(f"      Wallet: {wallet_address}")

            if balance < 1:
                self.warnings.append(f"Low USDC balance: {balance} (recommend at least 1 USDC for testing)")
            elif balance < 0.1:
                self.errors.append(f"Insufficient USDC balance: {balance}")

        except ImportError:
            self.stdout.write(f"   ⚠️  Cannot check balance (Solana SDK not installed)")
        except Exception as e:
            self.stdout.write(f"   ⚠️  Failed to check USDC balance: {e}")
            self.warnings.append(f"Failed to check USDC balance: {e}")

        self.stdout.write("")

    def check_database_models(self):
        """Check database models are properly configured."""
        self.stdout.write("5. Checking Database Models...")

        try:
            from rb_core.models import Purchase, CollaboratorPayment, Chapter, User

            # Check Purchase model has required fields
            required_fields = [
                'user', 'chapter', 'content',
                'stripe_payment_intent_id', 'stripe_checkout_session_id',
                'nft_mint_address', 'usdc_distribution_status',
                'platform_usdc_fronted', 'platform_usdc_earned',
                'usdc_distribution_transaction'
            ]

            purchase_fields = [f.name for f in Purchase._meta.get_fields()]

            missing_fields = [f for f in required_fields if f not in purchase_fields]

            if missing_fields:
                self.errors.append(f"Purchase model missing fields: {', '.join(missing_fields)}")
            else:
                self.stdout.write(f"   ✅ Purchase model: All required fields present")

            # Check CollaboratorPayment model
            collab_fields = [f.name for f in CollaboratorPayment._meta.get_fields()]
            required_collab_fields = ['purchase', 'collaborator', 'amount_usdc', 'percentage', 'role']

            missing_collab_fields = [f for f in required_collab_fields if f not in collab_fields]

            if missing_collab_fields:
                self.errors.append(f"CollaboratorPayment model missing fields: {', '.join(missing_collab_fields)}")
            else:
                self.stdout.write(f"   ✅ CollaboratorPayment model: All required fields present")

            # Check Chapter has get_collaborators_with_wallets method
            if hasattr(Chapter, 'get_collaborators_with_wallets'):
                self.stdout.write(f"   ✅ Chapter.get_collaborators_with_wallets: Method exists")
            else:
                self.errors.append("Chapter model missing get_collaborators_with_wallets() method")

            # Check User has wallet_address
            if hasattr(User, 'wallet_address'):
                self.stdout.write(f"   ✅ User.wallet_address: Property exists")
            else:
                self.errors.append("User model missing wallet_address property")

        except Exception as e:
            self.errors.append(f"Database model check failed: {e}")

        self.stdout.write("")

    def check_celery_availability(self):
        """Check Celery task availability."""
        self.stdout.write("6. Checking Celery Configuration...")

        try:
            from rb_core.tasks import process_atomic_purchase

            self.stdout.write(f"   ✅ process_atomic_purchase task: Imported successfully")

            # Check if Celery is actually available
            try:
                from celery import Celery
                self.stdout.write(f"   ✅ Celery: Available")
            except ImportError:
                self.stdout.write(f"   ⚠️  Celery not installed (tasks will run synchronously)")
                self.warnings.append("Celery not installed - tasks will run synchronously in development")

        except ImportError as e:
            self.errors.append(f"Failed to import Celery task: {e}")

        self.stdout.write("")

    def check_users_with_wallets(self):
        """Check how many users have Web3Auth wallets."""
        self.stdout.write("7. Checking User Wallets...")

        try:
            from rb_core.models import User

            total_users = User.objects.count()
            users_with_wallets = User.objects.filter(
                profile__wallet_address__isnull=False
            ).exclude(profile__wallet_address='').count()

            self.stdout.write(f"   ✅ Users with wallets: {users_with_wallets}/{total_users}")

            if users_with_wallets == 0:
                self.warnings.append("No users have wallet addresses! Users need to authenticate with Web3Auth.")
            elif users_with_wallets < total_users:
                self.stdout.write(f"      ⚠️  {total_users - users_with_wallets} users missing wallets")

        except Exception as e:
            self.errors.append(f"User wallet check failed: {e}")

        self.stdout.write("")

    def check_url_endpoints(self):
        """Check URL endpoints are configured."""
        self.stdout.write("8. Checking URL Endpoints...")

        try:
            from django.urls import reverse

            # Check checkout endpoint
            try:
                checkout_url = reverse('checkout_create')
                self.stdout.write(f"   ✅ Checkout endpoint: /api/checkout/create/")
            except:
                try:
                    checkout_url = reverse('checkout_session')
                    self.warnings.append("Using legacy checkout endpoint name 'checkout_session'")
                except:
                    self.errors.append("Checkout endpoint not found (expected 'checkout_create')")

            # Check webhook endpoint
            try:
                webhook_url = reverse('stripe_webhook')
                self.stdout.write(f"   ✅ Webhook endpoint: /api/webhooks/stripe/")
            except:
                self.errors.append("Stripe webhook endpoint not found")

        except Exception as e:
            self.errors.append(f"URL endpoint check failed: {e}")

        self.stdout.write("")
