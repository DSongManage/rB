#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')
django.setup()

from rb_core.models import UserProfile

print("\n" + "=" * 100)
print("USER WALLET STATUS")
print("=" * 100 + "\n")

for p in UserProfile.objects.all():
    wallet = (p.wallet_address[:20] + "..." if p.wallet_address else "None")
    sub = (p.web3auth_sub[:20] + "..." if p.web3auth_sub else "None")
    provider = p.wallet_provider or "None"
    print(f"{p.username:15} | Wallet: {wallet:25} | Sub: {sub:25} | Provider: {provider}")
