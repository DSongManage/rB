#!/usr/bin/env python
"""
Test creating a Circle W3S user (backend step).
The wallet creation requires frontend SDK with PIN setup.

Usage:
    python test_circle_user.py
"""

import os
import sys
import django
import uuid

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from blockchain.circle_w3s_service import get_circle_w3s_service, CircleW3SError


def test_create_circle_user():
    """Test creating a Circle W3S user (backend-only step)."""
    print("=" * 80)
    print("Circle W3S User Creation Test (Backend)")
    print("=" * 80)

    try:
        # Get Circle service instance
        circle_service = get_circle_w3s_service()

        print(f"\n✅ Circle W3S service initialized")
        print(f"   API Key: {circle_service.api_key[:30]}...")
        print(f"   App ID: {circle_service.app_id}")
        print(f"   Environment: {'Production' if circle_service.is_production else 'Sandbox'}")
        print(f"   Base URL: {circle_service.base_url}")

        # Test 1: Create a Circle user
        print("\n" + "-" * 80)
        print("TEST 1: Creating Circle user...")
        print("-" * 80)

        test_user_id = 99999
        circle_user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f'renaissblock-user-{test_user_id}'))

        print(f"Internal User ID: {test_user_id}")
        print(f"Circle User ID: {circle_user_id}")
        print("\nCalling Circle W3S API POST /users...")

        user_data = {
            'userId': circle_user_id
        }

        result = circle_service._make_request('POST', '/users', data=user_data)

        print("\n✅ Circle user created successfully!")
        print(f"   Response: {result}")

        # Test 2: Get user token
        print("\n" + "-" * 80)
        print("TEST 2: Getting user token...")
        print("-" * 80)

        token_data = {
            'userId': circle_user_id
        }

        token_result = circle_service._make_request('POST', '/users/token', data=token_data)
        user_token = token_result.get('data', {}).get('userToken')
        encryption_key = token_result.get('data', {}).get('encryptionKey')

        print("\n✅ User token retrieved!")
        print(f"   Has userToken: {bool(user_token)}")
        print(f"   Has encryptionKey: {bool(encryption_key)}")
        print(f"   Token (first 30 chars): {user_token[:30] if user_token else 'N/A'}...")

        print("\n" + "=" * 80)
        print("✅ BACKEND TESTS PASSED")
        print("=" * 80)
        print("\n📝 Next Steps:")
        print("   1. Backend can create Circle users ✅")
        print("   2. Need to integrate Circle Web SDK in frontend for PIN setup")
        print("   3. User will create wallet via frontend with their PIN")
        print("   4. Backend will receive wallet address after creation")

    except CircleW3SError as e:
        print("\n" + "=" * 80)
        print("❌ CIRCLE W3S API ERROR")
        print("=" * 80)
        print(f"\nError: {e}")
        print("\nPossible issues:")
        print("  1. API key is invalid or expired")
        print("  2. API key doesn't have permission for this endpoint")
        print("  3. Circle API endpoint URL is incorrect")
        print("  4. App ID is not configured correctly")
        print("\nCheck your Circle Console:")
        print("  - Verify API key is active")
        print("  - Verify App ID matches your user-controlled wallet configurator")
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
    test_create_circle_user()
