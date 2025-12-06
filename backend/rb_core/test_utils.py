"""
Testing utilities for USDC payment flow.

Provides helper functions to:
- Check platform USDC balance
- Check user wallet balances (SOL + USDC)
- Simulate purchases for testing
"""

import logging
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)


def check_platform_usdc_balance():
    """
    Check current platform USDC balance.

    Returns:
        float: USDC balance
    """
    from blockchain.solana_service import get_platform_usdc_balance

    try:
        balance = get_platform_usdc_balance()
        logger.info(f"Platform USDC Balance: {balance}")
        print(f"\n{'='*60}")
        print(f"Platform Wallet: {settings.PLATFORM_USDC_WALLET_ADDRESS}")
        print(f"USDC Balance: {balance}")
        print(f"{'='*60}\n")
        return balance
    except Exception as e:
        logger.error(f"Failed to check platform balance: {e}")
        print(f"❌ Error: {e}")
        return None


def check_user_wallet(user):
    """
    Check a user's Web3Auth wallet status and balances.

    Args:
        user: Django User object

    Returns:
        dict: Wallet info with SOL and USDC balances
    """
    try:
        from solana.rpc.api import Client
        from solders.pubkey import Pubkey
        from spl.token.instructions import get_associated_token_address
    except ImportError:
        print("⚠️  Solana libraries not installed")
        print("Install with: pip install solana solders spl-token")
        return None

    if not user.wallet_address:
        print(f"❌ User {user.username} has no wallet address!")
        return None

    try:
        client = Client(settings.SOLANA_RPC_URL)
        wallet = Pubkey.from_string(user.wallet_address)
        usdc_mint = Pubkey.from_string(settings.USDC_MINT_ADDRESS)

        # Check SOL balance
        sol_response = client.get_balance(wallet)
        sol_balance = sol_response.value / 1e9

        # Check USDC balance
        try:
            token_account = get_associated_token_address(wallet, usdc_mint)
            usdc_response = client.get_token_account_balance(token_account)
            usdc_balance = int(usdc_response.value.amount) / 1e6
        except Exception as e:
            usdc_balance = 0
            logger.debug(f"No USDC account for {user.username}: {e}")

        info = {
            'username': user.username,
            'wallet': user.wallet_address,
            'sol_balance': sol_balance,
            'usdc_balance': usdc_balance
        }

        print(f"\n{'='*60}")
        print(f"User: {user.username}")
        print(f"Wallet: {user.wallet_address}")
        print(f"SOL Balance: {sol_balance}")
        print(f"USDC Balance: {usdc_balance}")
        print(f"{'='*60}\n")

        return info

    except Exception as e:
        logger.error(f"Error checking wallet for {user.username}: {e}")
        print(f"❌ Error: {e}")
        return None


def simulate_purchase(chapter_id, user_id, amount=3.00):
    """
    Simulate a complete purchase flow for testing.

    This bypasses Stripe and directly calls the Celery task.
    ONLY for local development testing!

    Args:
        chapter_id: Chapter ID to purchase
        user_id: User ID making purchase
        amount: Purchase amount (default $3.00)

    Returns:
        dict: Purchase result
    """
    from rb_core.models import Purchase, Chapter, User
    from rb_core.tasks import process_atomic_purchase
    import time

    if not settings.DEBUG:
        print("❌ This function only works in DEBUG mode")
        return None

    try:
        # Get chapter and user
        chapter = Chapter.objects.get(id=chapter_id)
        user = User.objects.get(id=user_id)

        print(f"\n{'='*60}")
        print(f"SIMULATING PURCHASE")
        print(f"{'='*60}")
        print(f"Chapter: {chapter.title}")
        print(f"User: {user.username}")
        print(f"Amount: ${amount}")
        print(f"{'='*60}\n")

        # Create mock purchase
        purchase = Purchase.objects.create(
            user=user,
            chapter=chapter,
            purchase_price_usd=Decimal(str(amount)),
            gross_amount=Decimal(str(amount)),
            stripe_payment_intent_id=f'test_pi_{int(time.time())}',
            stripe_checkout_session_id=f'test_cs_{int(time.time())}',
            status='payment_completed',
            payment_provider='stripe'
        )

        print(f"✅ Purchase created: ID {purchase.id}")
        print(f"Calling process_atomic_purchase task...\n")

        # Call task directly (not via Celery .delay())
        try:
            result = process_atomic_purchase(purchase.id)

            print(f"\n{'='*60}")
            print(f"PURCHASE RESULT")
            print(f"{'='*60}")
            print(f"Success: {result.get('success')}")
            if result.get('success'):
                print(f"NFT Mint: {result.get('nft_mint')}")
                print(f"TX Signature: {result.get('tx_signature')}")
                print(f"USDC Fronted: {result.get('usdc_fronted')}")
                print(f"USDC Earned: {result.get('usdc_earned')}")
            else:
                print(f"Error: {result.get('error')}")
            print(f"{'='*60}\n")

            return result

        except Exception as e:
            logger.error(f"Task execution failed: {e}", exc_info=True)
            print(f"❌ Task failed: {e}")
            return {'success': False, 'error': str(e)}

    except Chapter.DoesNotExist:
        print(f"❌ Chapter {chapter_id} not found")
        return None
    except User.DoesNotExist:
        print(f"❌ User {user_id} not found")
        return None
    except Exception as e:
        logger.error(f"Simulation failed: {e}", exc_info=True)
        print(f"❌ Error: {e}")
        return None


def list_recent_purchases(limit=10):
    """
    List recent purchases with their status.

    Args:
        limit: Number of purchases to show (default 10)

    Returns:
        QuerySet: Recent purchases
    """
    from rb_core.models import Purchase

    purchases = Purchase.objects.select_related(
        'user', 'chapter', 'chapter__book_project'
    ).order_by('-purchased_at')[:limit]

    print(f"\n{'='*80}")
    print(f"RECENT PURCHASES (Last {limit})")
    print(f"{'='*80}")

    if not purchases:
        print("No purchases found")
        print(f"{'='*80}\n")
        return purchases

    for p in purchases:
        item_name = p.chapter.title if p.chapter else (p.content.title if p.content else 'Unknown')
        print(f"\nPurchase ID: {p.id}")
        print(f"  User: {p.user.username}")
        print(f"  Item: {item_name}")
        print(f"  Amount: ${p.purchase_price_usd}")
        print(f"  Status: {p.status}")
        print(f"  USDC Status: {p.usdc_distribution_status}")
        if p.nft_mint_address:
            print(f"  NFT Mint: {p.nft_mint_address}")
        if p.usdc_distribution_transaction:
            print(f"  USDC TX: {p.usdc_distribution_transaction}")
        print(f"  Purchased: {p.purchased_at}")

    print(f"\n{'='*80}\n")

    return purchases


def check_system_health():
    """
    Run comprehensive system health check.

    Checks:
    - Database connectivity
    - Solana RPC connectivity
    - Platform wallet status
    - USDC balance
    - Environment variables

    Returns:
        dict: Health check results
    """
    print(f"\n{'='*80}")
    print(f"SYSTEM HEALTH CHECK")
    print(f"{'='*80}\n")

    results = {
        'database': False,
        'solana_rpc': False,
        'platform_wallet': False,
        'usdc_balance': None,
        'env_vars': False
    }

    # 1. Check database
    try:
        from rb_core.models import User
        user_count = User.objects.count()
        print(f"✅ Database: Connected ({user_count} users)")
        results['database'] = True
    except Exception as e:
        print(f"❌ Database: Failed - {e}")

    # 2. Check Solana RPC
    try:
        from solana.rpc.api import Client
        client = Client(settings.SOLANA_RPC_URL)
        version = client.get_version()
        print(f"✅ Solana RPC: Connected - {settings.SOLANA_RPC_URL}")
        print(f"   Version: {version.value}")
        results['solana_rpc'] = True
    except Exception as e:
        print(f"❌ Solana RPC: Failed - {e}")

    # 3. Check platform wallet
    try:
        wallet_path = settings.PLATFORM_WALLET_KEYPAIR_PATH
        if wallet_path and __import__('os').path.exists(wallet_path):
            print(f"✅ Platform Wallet Keypair: Found")
            print(f"   Path: {wallet_path}")
            print(f"   Address: {settings.PLATFORM_USDC_WALLET_ADDRESS}")
            results['platform_wallet'] = True
        else:
            print(f"❌ Platform Wallet Keypair: Not found")
            print(f"   Expected path: {wallet_path}")
    except Exception as e:
        print(f"❌ Platform Wallet: Failed - {e}")

    # 4. Check USDC balance
    try:
        balance = check_platform_usdc_balance()
        if balance is not None:
            results['usdc_balance'] = balance
            if balance > 1:
                print(f"✅ USDC Balance: Sufficient ({balance})")
            else:
                print(f"⚠️  USDC Balance: Low ({balance})")
    except Exception as e:
        print(f"❌ USDC Balance: Failed - {e}")

    # 5. Check environment variables
    required_vars = [
        'SOLANA_RPC_URL',
        'PLATFORM_USDC_WALLET_ADDRESS',
        'PLATFORM_WALLET_KEYPAIR_PATH',
        'USDC_MINT_ADDRESS',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
    ]

    missing_vars = []
    for var in required_vars:
        if not getattr(settings, var, None):
            missing_vars.append(var)

    if not missing_vars:
        print(f"✅ Environment Variables: All required vars set")
        results['env_vars'] = True
    else:
        print(f"❌ Environment Variables: Missing {len(missing_vars)} vars")
        for var in missing_vars:
            print(f"   - {var}")

    print(f"\n{'='*80}")
    print(f"HEALTH CHECK SUMMARY")
    print(f"{'='*80}")
    print(f"Database: {'✅' if results['database'] else '❌'}")
    print(f"Solana RPC: {'✅' if results['solana_rpc'] else '❌'}")
    print(f"Platform Wallet: {'✅' if results['platform_wallet'] else '❌'}")
    print(f"USDC Balance: {'✅' if results['usdc_balance'] and results['usdc_balance'] > 1 else '⚠️'}")
    print(f"Environment: {'✅' if results['env_vars'] else '❌'}")

    all_healthy = all([
        results['database'],
        results['solana_rpc'],
        results['platform_wallet'],
        results['env_vars']
    ])

    if all_healthy:
        print(f"\n✅ SYSTEM READY FOR TESTING")
    else:
        print(f"\n⚠️  SYSTEM HAS ISSUES - CHECK ABOVE")

    print(f"{'='*80}\n")

    return results
