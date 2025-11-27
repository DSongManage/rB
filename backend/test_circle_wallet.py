#!/usr/bin/env python
"""
Quick test script to verify Circle W3S API key works.
Run this to test wallet creation before running full signup flow.

Usage:
    python test_circle_wallet.py
"""

import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from blockchain.circle_w3s_service import get_circle_w3s_service, CircleW3SError


def test_circle_api():
    """Test Circle W3S API connection and wallet creation."""
    print("=" * 80)
    print("Circle W3S API Test")
    print("=" * 80)

    try:
        # Get Circle service instance
        circle_service = get_circle_w3s_service()

        print(f"\n✅ Circle W3S service initialized")
        print(f"   API Key: {circle_service.api_key[:30]}...")
        print(f"   Environment: {'Production' if circle_service.is_production else 'Sandbox'}")
        print(f"   Base URL: {circle_service.base_url}")

        # Test 1: Create a test wallet
        print("\n" + "-" * 80)
        print("TEST 1: Creating test wallet...")
        print("-" * 80)

        test_user_id = 99999  # Fake test user ID
        test_email = "test@example.com"

        print(f"User ID: {test_user_id}")
        print(f"Email: {test_email}")
        print("\nCalling Circle W3S API to create wallet...")

        wallet_data = circle_service.create_user_wallet(test_user_id, test_email)

        print("\n✅ Wallet created successfully!")
        print(f"   Wallet ID: {wallet_data.get('wallet_id')}")
        print(f"   Address: {wallet_data.get('address')}")
        print(f"   Blockchain: {wallet_data.get('blockchain')}")
        print(f"   State: {wallet_data.get('state')}")

        # Test 2: Get wallet balance (if wallet was created)
        if wallet_data.get('wallet_id'):
            print("\n" + "-" * 80)
            print("TEST 2: Getting wallet balance...")
            print("-" * 80)

            wallet_id = wallet_data.get('wallet_id')
            balance = circle_service.get_wallet_balance(wallet_id)

            print(f"\n✅ Wallet balance retrieved")
            print(f"   Balance: {balance} USDC")

        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED - Circle W3S API is working!")
        print("=" * 80)
        print("\nYou can now proceed with user signup. Wallets will be created automatically.")

    except CircleW3SError as e:
        print("\n" + "=" * 80)
        print("❌ CIRCLE W3S API ERROR")
        print("=" * 80)
        print(f"\nError: {e}")
        print("\nPossible issues:")
        print("  1. API key is invalid or expired")
        print("  2. API key doesn't have permission to create wallets")
        print("  3. Circle API endpoint is down")
        print("  4. Entity ID or Platform Wallet ID is not configured")
        print("\nCheck your .env file:")
        print("  - CIRCLE_W3S_API_KEY should start with 'TEST_API_KEY:'")
        print("  - CIRCLE_W3S_PRODUCTION should be 'false' for sandbox")
        sys.exit(1)

    except Exception as e:
        print("\n" + "=" * 80)
        print("❌ UNEXPECTED ERROR")
        print("=" * 80)
        print(f"\nError: {e}")
        print(f"\nType: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    test_circle_api()
