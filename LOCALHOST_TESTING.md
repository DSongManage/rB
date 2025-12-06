# Localhost Testing Guide 🧪

Since Stripe webhooks don't fire on localhost, you need to manually trigger purchase processing. Here are **3 easy ways** to do it:

---

## 🚀 Method 1: Auto-Watcher (RECOMMENDED)

**Best for continuous testing** - Runs in the background and auto-processes all purchases.

### Start the Watcher

In a **separate terminal**, run:

```bash
cd backend
source ../venv/bin/activate
python manage.py watch_purchases
```

You'll see:
```
======================================================================
🔍 PURCHASE WATCHER STARTED
======================================================================

This will automatically process pending purchases for local testing.
Press Ctrl+C to stop.

──────────────────────────────────────────────────────────────────────
Processing Purchase #42
  👤 User: davidsmith
  📖 Item: Chapter 1: The Beginning
  💰 Amount: $3.00
  📊 Status: payment_pending → pending
  ✅ Updated to payment_completed
  ⚙️  Running atomic settlement...
  ✅ Processing successful!
     🎨 NFT Mint: 8e2f4a1c...
     🔗 TX Sig: 5a3b2c1d...
     💸 USDC Fronted: $2.864000
     💰 Platform Fee: $0.286400
     ✅ Purchase now completed (USDC: completed)
```

**The watcher will:**
- ✅ Automatically detect new purchases
- ✅ Process them immediately
- ✅ Show detailed logs
- ✅ Keep running until you stop it (Ctrl+C)

**Leave this running while you test!** Every purchase you make will be auto-processed.

---

## ⚡ Method 2: Quick Script (ONE-TIME)

**Best for processing a single stuck purchase** - Fast, simple script.

```bash
cd backend
source ../venv/bin/activate
python process_pending_purchase.py
```

This will:
1. Find ALL pending purchases
2. Process them immediately
3. Exit when done

Output:
```
============================================================
Found 1 pending purchase(s)
============================================================

Processing Purchase #42
  User: davidsmith
  Item: Chapter 1: The Beginning
  Amount: $3.00
  Status: payment_pending
  ✅ Marked as payment_completed
  ✅ Processing successful!
     NFT Mint: 8e2f4a1c...
     TX Signature: 5a3b2c1d...

============================================================
Done! Your purchases should now appear in your library.
============================================================
```

---

## 🎯 Method 3: One-Off Command (CLEANEST)

**Best for a quick one-time check** - Django management command.

```bash
cd backend
source ../venv/bin/activate
python manage.py watch_purchases --once
```

The `--once` flag processes pending purchases and exits immediately.

---

## 🔧 Advanced Options

### Watch with Custom Interval

Check every 2 seconds instead of 5:
```bash
python manage.py watch_purchases --interval 2
```

### Run Watcher in Background

Keep it running even after you close the terminal:
```bash
python manage.py watch_purchases > /tmp/purchase_watcher.log 2>&1 &
```

Stop it later:
```bash
pkill -f watch_purchases
```

---

## 🧪 Recommended Testing Workflow

### First Time Setup (One-time)

```bash
# Terminal 1: Django server
cd backend && python manage.py runserver

# Terminal 2: Purchase watcher (LEAVE THIS RUNNING)
cd backend && python manage.py watch_purchases
```

### Daily Testing

Just start the watcher once:
```bash
python manage.py watch_purchases
```

Then make as many test purchases as you want! They'll all be auto-processed.

---

## 📊 Verify Your Purchase

After processing, check your library:

```bash
python manage.py shell
```

```python
>>> from rb_core.models import Purchase
>>>
>>> # Check your recent purchases
>>> Purchase.objects.filter(
...     user__username='YOUR_USERNAME'
... ).order_by('-created_at').values(
...     'id', 'status', 'usdc_distribution_status',
...     'nft_mint_address', 'chapter__title'
... )[:5]
```

You should see:
- `status='completed'`
- `usdc_distribution_status='completed'`
- `nft_mint_address` populated
- NFT visible in your library

---

## 🆘 Troubleshooting

### "No pending purchases found" but I just bought one

Check the purchase status:
```python
>>> Purchase.objects.latest('created_at')
<Purchase: ...>
```

If status is already `'completed'`, it was already processed!

### Purchase shows as "pending" in library

The frontend might be caching. Hard refresh (Cmd+Shift+R) or check database directly:

```bash
python manage.py shell
```

```python
>>> from rb_core.models import Purchase
>>> p = Purchase.objects.latest('created_at')
>>> print(f"Status: {p.status}")
>>> print(f"USDC: {p.usdc_distribution_status}")
>>> print(f"NFT: {p.nft_mint_address}")
```

### Error: "User has no wallet address"

The buyer needs to authenticate with Web3Auth to get a Solana wallet. Have them:
1. Log out
2. Log back in with Web3Auth
3. Try purchasing again

---

## 🎉 Pro Tips

1. **Always run the watcher** when doing local testing - set it and forget it!
2. **Check the logs** - the watcher shows detailed info about each purchase
3. **Use simulate_purchase()** for quick tests without going through the UI:

```python
>>> from rb_core.test_utils import simulate_purchase
>>> simulate_purchase(chapter_id=1, user_id=2, amount=3.00)
```

4. **Monitor Solana Explorer**:
   - Platform wallet: https://explorer.solana.com/address/C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3RK?cluster=devnet
   - Look for USDC transfers matching your purchase amount

---

## 🔄 What's Happening Behind the Scenes?

When you make a purchase on localhost:

1. ❌ Stripe webhook **doesn't fire** (localhost not accessible to Stripe)
2. ✅ Purchase created with `status='payment_pending'`
3. ✅ **Watcher detects it** (checks every 5 seconds)
4. ✅ Updates to `status='payment_completed'` (simulates webhook)
5. ✅ Runs `process_atomic_purchase()` task
6. ✅ Executes USDC distribution on Solana devnet
7. ✅ Mints NFT and updates database
8. ✅ NFT appears in your library!

**In production**: Step 3-7 happen automatically via Stripe webhook → Celery. On localhost, the watcher replaces the webhook.

---

**Happy testing!** 🚀

For production webhook setup, see `PAYMENT_FLOW_VERIFICATION.md`.
