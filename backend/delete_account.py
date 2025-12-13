#!/usr/bin/env python
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
django.setup()

from rb_core.models import UserProfile, User

if len(sys.argv) < 2:
    print("Usage: python delete_account.py <username>")
    sys.exit(1)

username = sys.argv[1]

try:
    profile = UserProfile.objects.get(username=username)
    user = profile.user

    print(f"\n🗑️  Deleting account: {username}")
    print(f"   Wallet: {profile.wallet_address[:20] if profile.wallet_address else 'None'}...")
    print(f"   Provider: {profile.wallet_provider or 'None'}")

    # Delete the user (will cascade delete the profile)
    user.delete()

    print(f"\n✅ Account '{username}' has been deleted!\n")

except UserProfile.DoesNotExist:
    print(f"\n❌ Account '{username}' not found.\n")
    sys.exit(1)
