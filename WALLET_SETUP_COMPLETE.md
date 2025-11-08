# Platform Wallet Setup - COMPLETE ✅

## Setup Summary

The renaissBlock platform wallet has been successfully created, configured, and funded for development testing.

---

## Wallet Details

**Public Key (Platform Fee Collection Address):**
```
C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk
```

**Network:** Solana Devnet (for testing)

**Current Balance:** 2 SOL (devnet)

**Purpose:** Collects 10% platform fee from all collaborative NFT sales

---

## Security Checklist ✅

- [x] Wallet keypair generated with secure seed phrase
- [x] Keypair file permissions set to 400 (read-only, owner only)
- [x] Seed phrase documented in PLATFORM_WALLET_BACKUP.md
- [x] Keypair file added to .gitignore
- [x] PLATFORM_WALLET_BACKUP.md added to .gitignore
- [x] All wallet files excluded from git tracking
- [x] Environment variables configured in backend/.env
- [x] Django settings verified to load wallet correctly
- [x] Wallet funded with 2 SOL on devnet for testing
- [x] Public key verified matches keypair file

---

## Configuration Files Updated

### 1. `/backend/.env` (Created)
```bash
SOLANA_PLATFORM_WALLET=C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk
PLATFORM_WALLET_KEYPAIR_PATH=/Users/davidsong/repos/songProjects/rB/platform-wallet.json
SOLANA_RPC_URL=https://api.devnet.solana.com
SOL_PRICE_USD=100.00
FEATURE_COLLABORATIVE_MINTING=true
```

### 2. `/.gitignore` (Updated)
```
platform-wallet.json
*-wallet.json
PLATFORM_WALLET_BACKUP.md
```

### 3. `/backend/renaissBlock/settings.py` (Already configured)
```python
SOLANA_PLATFORM_WALLET = os.getenv('SOLANA_PLATFORM_WALLET', ...)
PLATFORM_WALLET_KEYPAIR_PATH = os.getenv('PLATFORM_WALLET_KEYPAIR_PATH', '')
```

---

## Verification Tests Passed ✅

### Django Configuration Test
```bash
$ python manage.py shell
>>> from django.conf import settings
>>> settings.SOLANA_PLATFORM_WALLET
'C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk'

>>> from rb_core.utils import get_platform_fee_account
>>> get_platform_fee_account()
'C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk'
```

### Solana CLI Tests
```bash
# Verify public key
$ solana-keygen pubkey platform-wallet.json
C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk

# Check balance
$ solana balance C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk --url devnet
2 SOL

# Verify file permissions
$ ls -l platform-wallet.json
-r--------  1 davidsong  staff  235 Nov  7 21:27 platform-wallet.json
```

---

## Transaction History

### Initial Airdrop (Devnet)
- **Signature:** `4pREoWXL8JgWrD3ivo664PnD2z3zkT9dabTpfBjSwAWWATxZaUrR8ipzqFVW5qfjF6774kyrrAMqGWbCZCvrP1HC`
- **Amount:** 2 SOL
- **Date:** November 7, 2024
- **Purpose:** Initial funding for development testing

**View on Explorer:**
https://explorer.solana.com/tx/4pREoWXL8JgWrD3ivo664PnD2z3zkT9dabTpfBjSwAWWATxZaUrR8ipzqFVW5qfjF6774kyrrAMqGWbCZCvrP1HC?cluster=devnet

---

## How Revenue Collection Works

When a collaborative NFT is minted and sold:

1. **Buyer pays:** 1.0 SOL (example)
2. **Platform receives:** 0.1 SOL (10% fee) → `C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk`
3. **Creators receive:** 0.9 SOL split according to their percentages

### Example: 70/30 Split Between 2 Creators

```
Sale: 1.0 SOL
├─ Platform Fee (10%): 0.1 SOL → C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk
└─ Creators (90%): 0.9 SOL
    ├─ Creator 1 (70%): 0.63 SOL
    └─ Creator 2 (30%): 0.27 SOL
```

All transfers happen atomically in a single transaction via the Solana smart contract.

---

## Next Steps for Development

### 1. Test Collaborative Minting
```python
# In Django shell
from rb_core.utils import mint_collaborative_nft
from decimal import Decimal

result = mint_collaborative_nft(
    project_id=1,
    sale_amount_usd=Decimal('10.00'),
    creator_splits=[
        {
            'user_id': 1,
            'wallet_address': 'Creator1Wallet...',
            'percentage': 70
        },
        {
            'user_id': 2,
            'wallet_address': 'Creator2Wallet...',
            'percentage': 30
        }
    ],
    metadata_uri='https://arweave.net/metadata',
    title='Test NFT'
)
```

### 2. Monitor Platform Fees
```bash
# Check balance regularly
solana balance C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk --url devnet

# View transaction history
solana transaction-history C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk --url devnet
```

### 3. Before Production Deployment

- [ ] Generate new production wallet on mainnet
- [ ] Fund production wallet with 0.5-1 SOL for transaction fees
- [ ] Update SOLANA_PLATFORM_WALLET in production environment
- [ ] Update SOLANA_RPC_URL to mainnet: `https://api.mainnet-beta.solana.com`
- [ ] Store production seed phrase in secure location (safe deposit box)
- [ ] Consider multi-signature wallet for additional security
- [ ] Set up monitoring and alerts for low balance
- [ ] Integrate price oracle for real-time SOL/USD conversion

---

## Security Reminders

### CRITICAL ⚠️
- **NEVER** commit `platform-wallet.json` to git
- **NEVER** commit `PLATFORM_WALLET_BACKUP.md` to git
- **NEVER** share the seed phrase with anyone
- **ALWAYS** store seed phrase backups in multiple secure physical locations
- **ALWAYS** use HTTPS for production RPC endpoints
- **MONITOR** wallet balance regularly to ensure sufficient SOL for fees

### Backup Locations
The 12-word seed phrase should be written on paper and stored in:
1. Primary: Fireproof safe or safe deposit box
2. Backup: Second secure location (different building)
3. Emergency: Trusted family member or lawyer (optional)

---

## Related Documentation

- **Backup Instructions:** `/PLATFORM_WALLET_BACKUP.md` (KEEP SECRET)
- **Backend Integration:** `/BACKEND_SOLANA_INTEGRATION.md`
- **Smart Contract:** `/blockchain/rb_contracts/programs/renaiss_block/src/lib.rs`
- **Tests:** `/blockchain/rb_contracts/tests/mint_collaborative.ts`

---

## Support & Troubleshooting

### Check Wallet Balance
```bash
solana balance C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk --url devnet
```

### View Recent Transactions
```bash
solana transaction-history C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk --url devnet
```

### Verify Django Configuration
```bash
cd backend
python manage.py shell
>>> from django.conf import settings
>>> settings.SOLANA_PLATFORM_WALLET
```

### Request More Devnet SOL
```bash
solana airdrop 2 C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk --url devnet
```

---

**Status:** ✅ Platform wallet fully configured and ready for development testing

**Last Updated:** November 7, 2024
