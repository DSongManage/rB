# Circle Payment Integration - Setup Checklist

## ✅ Completed

- [x] Circle payment service implementation
- [x] Circle webhook handler
- [x] Database migration (0026_add_circle_payment_fields)
- [x] Gas cost tracking (mint + transfer)
- [x] Revenue split calculation
- [x] URL routing configured
- [x] Django settings configured
- [x] All modules imported successfully (no syntax errors)

---

## 🔧 Remaining Setup Steps

### 1. Get Circle API Credentials

**Action Required:**
1. Go to https://circle.com and sign up/login
2. Navigate to **Dashboard → Developers → API Keys**
3. Generate a new API key
4. Copy the **API Key** (save securely - only shown once!)
5. Generate a **Webhook Secret** (or use the one provided)
6. Note your **Platform Wallet Address** (Solana USDC wallet where payments settle)

**What you need:**
- [ ] `CIRCLE_API_KEY` (e.g., `TEST:API_KEY:...` for sandbox, `LIVE:API_KEY:...` for production)
- [ ] `CIRCLE_WEBHOOK_SECRET` (e.g., `whsec_...`)
- [ ] `PLATFORM_USDC_WALLET_ADDRESS` (Your Solana wallet address, e.g., `7xKXt...`)

---

### 2. Configure Environment Variables on Render

**Action Required:**
1. Go to your Render dashboard
2. Select your backend service
3. Navigate to **Environment** tab
4. Add the following environment variables:

```bash
CIRCLE_API_KEY=<your_circle_api_key>
CIRCLE_WEBHOOK_SECRET=<your_webhook_secret>
PLATFORM_USDC_WALLET_ADDRESS=<your_solana_wallet_address>
```

**Important Notes:**
- Use **sandbox credentials** for testing first
- Switch to **production credentials** only after testing
- Keep credentials secure - never commit to git
- Render will auto-redeploy after adding env vars

---

### 3. Configure Circle Webhook Endpoint

**Action Required:**
1. Go to Circle Dashboard → **Developers → Webhooks**
2. Click **Create Webhook**
3. Enter webhook URL:
   ```
   https://your-render-app.onrender.com/api/checkout/circle/webhook/
   ```
   (Replace `your-render-app` with your actual Render URL)

4. Select events to subscribe to:
   - [x] `payment.confirmed` ✅ **Required**
   - [x] `payment.failed` ✅ **Required**
   - [x] `payment.canceled` ✅ **Required**

5. Save webhook configuration
6. Copy the **Webhook Secret** if you haven't already

**Testing with ngrok (for local development):**
```bash
ngrok http 8000
# Use ngrok URL: https://abc123.ngrok.io/api/checkout/circle/webhook/
```

---

### 4. Test Circle Integration

#### A. Sandbox Testing (Recommended First)

**Setup:**
1. Use Circle's **sandbox environment**
2. In `backend/rb_core/payments/circle_service.py` (line 25), temporarily change:
   ```python
   BASE_URL = "https://api-sandbox.circle.com"  # Sandbox for testing
   ```
3. Use sandbox API key in environment variables

**Test Card Numbers:**
- **Success:** `4007 4000 0000 0007`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`

**Test Flow:**
1. Browse to your frontend
2. Select a content item (price: $0.50 for testing)
3. Click "Buy with Card"
4. Enter test card number
5. Complete checkout
6. Verify:
   - [ ] Payment confirmed in Circle Dashboard
   - [ ] Webhook received in Render logs
   - [ ] NFT minted to buyer wallet
   - [ ] USDC transferred to creator wallet
   - [ ] Purchase record shows `status='completed'`

**Check Logs:**
```bash
# On Render, view logs for:
[Circle] Received webhook: type=payment.confirmed
[Circle] ✅ Payment confirmed for purchase X
[CircleMint] NFT minted. Mint address: ...
[CircleMint] USDC transferred to creator. Amount: $X.XX USDC
[CircleMint] Purchase X completed
```

---

#### B. Production Testing

**Only after sandbox testing succeeds!**

1. Change `BASE_URL` back to production:
   ```python
   BASE_URL = "https://api.circle.com"  # Production
   ```
2. Update environment variables with **production** credentials
3. Start with small amounts ($0.50)
4. Verify USDC arrives in platform wallet on Solana
5. Check Solana explorer: https://solscan.io
6. Verify NFT minting and creator payments

---

### 5. Monitor and Verify

#### A. Database Queries

**Check Circle purchases:**
```python
from rb_core.models import Purchase

# All Circle purchases
circle_purchases = Purchase.objects.filter(payment_provider='circle')
print(f"Total Circle purchases: {circle_purchases.count()}")

# Failed payments
failed = Purchase.objects.filter(payment_provider='circle', status='failed')
print(f"Failed payments: {failed.count()}")

# Completed with USDC
completed = Purchase.objects.filter(
    payment_provider='circle',
    status='completed'
).exclude(usdc_amount__isnull=True)
print(f"Completed with USDC: {completed.count()}")

# Revenue summary
from django.db.models import Sum
total_revenue = completed.aggregate(total=Sum('creator_amount'))
print(f"Total creator revenue: ${total_revenue['total']}")
```

#### B. Check Solana Transactions

**Platform wallet:**
```
https://solscan.io/account/YOUR_PLATFORM_WALLET_ADDRESS
```

**Creator wallet:**
```
https://solscan.io/account/CREATOR_WALLET_ADDRESS
```

**Look for:**
- USDC transfers
- NFT mints
- Transaction fees (~$0.0002 per operation)

---

## 🛠️ Troubleshooting

### Webhook not receiving events

**Check:**
1. Circle Dashboard → Webhooks → View Logs
2. Verify webhook URL is publicly accessible
3. Check Render logs for signature errors
4. Ensure `CIRCLE_WEBHOOK_SECRET` matches Circle Dashboard

**Fix:**
```bash
# Test webhook manually
curl -X POST https://your-app.onrender.com/api/checkout/circle/webhook/ \
  -H "Content-Type: application/json" \
  -H "X-Circle-Signature: test" \
  -d '{"type":"payment.confirmed","data":{"id":"test"}}'
```

---

### Payment stuck in pending

**Check:**
1. Circle Dashboard for payment status
2. Verify webhook endpoint is working
3. Check if webhook secret is correct
4. Manually trigger webhook from Circle Dashboard

---

### USDC not arriving

**Check:**
1. Verify `PLATFORM_USDC_WALLET_ADDRESS` is correct Solana address
2. Check Solana explorer: https://solscan.io
3. Verify Circle has settled payment (can take 1-2 business days)
4. Check you're on correct network (mainnet-beta, not devnet)

---

### NFT not minting

**Check:**
1. Purchase record has `status='payment_completed'`
2. Check Render logs for minting task errors
3. Verify Celery/async task is running
4. Check `mint_and_distribute_circle` function logs

**Debug:**
```python
from rb_core.models import Purchase
purchase = Purchase.objects.get(id=YOUR_PURCHASE_ID)
print(f"Status: {purchase.status}")
print(f"Circle payment ID: {purchase.circle_payment_id}")
print(f"NFT minted: {purchase.nft_minted}")
print(f"Mint address: {purchase.nft_mint_address}")
```

---

## 📚 Additional Resources

- **Circle API Docs:** https://developers.circle.com
- **Circle Support:** support@circle.com
- **Solana Explorer:** https://solscan.io
- **Web3Auth Docs:** https://web3auth.io/docs
- **renaissBlock Circle README:** `backend/rb_core/payments/README.md`

---

## ✨ Integration Complete Checklist

Before going live, verify:

- [ ] Circle account created (production)
- [ ] Production API credentials obtained
- [ ] Environment variables set on Render
- [ ] Webhook configured in Circle Dashboard
- [ ] Sandbox testing completed successfully
- [ ] Small production test ($0.50) completed
- [ ] USDC received in platform wallet
- [ ] NFT minting working
- [ ] Creator payments working
- [ ] Database queries show correct data
- [ ] Error handling tested (declined cards)
- [ ] Webhook signature verification working
- [ ] Logs show successful flow

---

## 🎯 Next Steps After Setup

1. **Update frontend** to call `/api/checkout/circle/`
2. **Add Circle payment option** in UI alongside Stripe
3. **Display USDC amounts** in creator dashboards
4. **Show gas costs** in transaction history
5. **Implement retry logic** for failed transfers
6. **Set up monitoring** for Circle webhook failures
7. **Create admin dashboard** for Circle payment analytics

---

## 🚀 You're Ready!

Once all checklist items are complete, your Circle payment integration will be live and users can purchase NFTs with credit cards that settle in USDC on Solana!
