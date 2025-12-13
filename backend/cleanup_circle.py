#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
django.setup()

from rb_core.models import UserProfile

# Find all profiles with Circle providers
circle_profiles = UserProfile.objects.filter(
    wallet_provider__in=['circle_w3s', 'circle_user_controlled']
)

print(f"\n🧹 Cleaning up {circle_profiles.count()} profiles with Circle providers...\n")

for profile in circle_profiles:
    print(f"Cleaning: {profile.username:20} | Provider: {profile.wallet_provider:30} | Wallet: {profile.wallet_address[:20] if profile.wallet_address else 'None'}...")

    # Clear Circle-related fields
    profile.wallet_provider = ''  # Set to empty string (allows web3auth linking)
    profile.wallet_address = None
    # Clear any Circle-specific fields if they exist
    if hasattr(profile, 'circle_user_id'):
        profile.circle_user_id = None

    profile.save()
    print(f"  ✅ Cleared")

print(f"\n✅ Done! All Circle providers have been cleared.\n")
print("You can now set up Web3Auth wallets for these accounts.\n")
