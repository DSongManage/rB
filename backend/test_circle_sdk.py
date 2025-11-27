#!/usr/bin/env python
"""
Test Circle W3S using the official SDK.
This should handle authentication correctly.

Usage:
    python test_circle_sdk.py
"""

import os
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Django before loading env
import django
django.setup()

from django.conf import settings

# Now import Circle SDK
from circle.web3.user_controlled_wallets import (
    Configuration,
    ApiClient,
    PINAuthenticationApi,
    CreateUserRequest,
    UserTokenRequest
)


def test_circle_sdk():
    """Test Circle W3S SDK with official client."""
    print("=" * 80)
    print("Circle W3S SDK Test (Using Official SDK)")
    print("=" * 80)

    try:
        # Get credentials from settings
        api_key = settings.CIRCLE_W3S_API_KEY

        print(f"\n✅ Loading credentials")
        print(f"   API Key: {api_key[:30]}...")
        print(f"   API Key format: {'✓ Valid' if api_key.count(':') == 2 else '✗ Invalid'}")

        # Initialize Circle SDK client
        print("\n📡 Initializing Circle SDK client...")

        # Configure SDK
        configuration = Configuration(
            host="https://api.circle.com",
            access_token=api_key
        )

        with ApiClient(configuration) as api_client:
            # Create PIN Authentication API instance
            pin_api = PINAuthenticationApi(api_client)

            print("✅ Circle SDK client initialized!")

            # Test 1: Create a user
            print("\n" + "-" * 80)
            print("TEST 1: Creating Circle user account...")
            print("-" * 80)

            import uuid
            test_user_id = str(uuid.uuid4())

            print(f"User ID: {test_user_id}")
            print("\nCalling SDK create_user()...")

            # Create user (backend step - no PIN needed yet)
            create_user_request = CreateUserRequest(user_id=test_user_id)
            response = pin_api.create_user(create_user_request=create_user_request)

            print("\n✅ User created successfully!")
            print(f"   User ID: {response.data.id if hasattr(response, 'data') else 'N/A'}")
            print(f"   Status: {response.data.status if hasattr(response, 'data') else 'N/A'}")
            print(f"   Create Date: {response.data.create_date if hasattr(response, 'data') else 'N/A'}")

            # Test 2: Get user token
            print("\n" + "-" * 80)
            print("TEST 2: Getting user token...")
            print("-" * 80)

            user_token_request = UserTokenRequest(user_id=test_user_id)
            token_response = pin_api.get_user_token(user_token_request=user_token_request)

            print("\n✅ User token retrieved!")
            print(f"   Has userToken: {hasattr(token_response, 'data') and hasattr(token_response.data, 'user_token')}")
            print(f"   Token (first 20 chars): {token_response.data.user_token[:20] if hasattr(token_response, 'data') and hasattr(token_response.data, 'user_token') else 'N/A'}...")
            print(f"   Encryption key available: {hasattr(token_response, 'data') and hasattr(token_response.data, 'encryption_key')}")

        print("\n" + "=" * 80)
        print("✅ ALL SDK TESTS PASSED!")
        print("=" * 80)
        print("\n📝 SDK is working correctly!")
        print("   1. Can create Circle users via SDK ✅")
        print("   2. Can get user tokens via SDK ✅")
        print("   3. Ready to integrate with signup flow ✅")

        return True

    except Exception as e:
        print("\n" + "=" * 80)
        print("❌ SDK TEST ERROR")
        print("=" * 80)
        print(f"\nError: {e}")
        print(f"\nType: {type(e).__name__}")

        import traceback
        traceback.print_exc()

        print("\nPossible issues:")
        print("  1. API key is invalid or expired")
        print("  2. Circle account not fully activated")
        print("  3. SDK version mismatch")

        return False


if __name__ == '__main__':
    success = test_circle_sdk()
    sys.exit(0 if success else 1)
