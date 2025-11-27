# Hybrid Payment Architecture: Stripe + Circle Web3 Services

## Overview

renaissBlock uses a **hybrid payment architecture** combining traditional payments (Stripe) with Web3 wallet management and NFT minting (Circle Web3 Services).

**Why Hybrid?**
- Users pay with credit cards (familiar Web2 UX)
- Creators receive USDC (instant, global, low-fee)
- NFTs minted to user wallets automatically
- No crypto knowledge required from users

---

## Architecture Components

### 1. Stripe (Fiat Payment Processing)
- **Purpose**: Accept credit card payments from buyers
- **Settles to**: renaissBlock bank account in USD
- **Fee**: ~3.5% per transaction

### 2. Circle Web3 Services (Wallet & NFT Management)
- **Purpose**: Create user wallets, mint NFTs, distribute USDC
- **Blockchain**: Solana (fast, low-cost)
- **Wallet Type**: User-controlled Circle W3S wallets (PIN-based, no seed phrases)
- **Gas Fees**: Sponsored by platform via Circle W3S Gas Station

### 3. Weekly Manual Conversion (USD → USDC)
- **Frequency**: Every Monday at 9am
- **Process**: Stripe → Coinbase → Buy USDC → Transfer to Circle W3S platform wallet
- **Automated Distribution**: After conversion, run batch USDC distribution to creators

---

## Payment Flow (End-to-End)

### **Step 1: User Purchases Content ($3.00)**

```
Buyer clicks "Purchase" → Stripe Checkout → Stripe processes payment
```

**Stripe Webhook: `payment_intent.succeeded`**
- Gross amount: $3.00
- Stripe fee: $0.387
- Net after Stripe: $2.613

**Database Updates:**
```python
purchase.gross_amount = 3.00
purchase.stripe_fee = 0.387
purchase.net_after_stripe = 2.613
purchase.status = 'payment_completed'
```

### **Step 2: NFT Minted to Buyer's Wallet**

**Celery Task: `process_purchase_with_circle_w3s_task`**

1. Fetch buyer's Circle W3S wallet address
2. Prepare NFT metadata (IPFS hash or Cloudinary URL)
3. Call Circle W3S API to mint NFT to buyer's wallet
4. Update purchase record:
```python
purchase.circle_nft_id = 'nft_abc123'
purchase.nft_mint_address = 'solana_mint_address'
purchase.nft_minted = True
purchase.mint_cost = 0.00  # Circle sponsors gas
```

5. Calculate USDC distribution (90% to creator, 10% to platform):
```python
purchase.usdc_amount = 2.613 * 0.90 = 2.35 USDC
purchase.usdc_payment_status = 'pending_conversion'
purchase.status = 'completed'
```

### **Step 3: Weekly USD → USDC Conversion (Manual)**

**Every Monday at 9am:**

1. Admin checks total pending USDC distributions:
```bash
python manage.py distribute_usdc_batch --dry-run
```

Output:
```
📊 DISTRIBUTION SUMMARY:
  Total purchases: 47
  Total USDC to distribute: $112.35 USDC
  Number of creators: 12

📋 BREAKDOWN BY CREATOR:
  creator1                      $28.50 USDC  (8 purchases)
  creator2                      $19.20 USDC  (5 purchases)
  ...
```

2. Admin manually converts USD to USDC:
   - Withdraw $112.35 from Stripe to bank account
   - Transfer to Coinbase
   - Buy $112.35 USDC
   - Send USDC to Circle W3S platform wallet

3. Verify USDC arrived in platform wallet (check Circle W3S dashboard)

### **Step 4: Batch Distribute USDC to Creators**

```bash
python manage.py distribute_usdc_batch
```

**For each purchase:**

**Celery Task: `distribute_usdc_to_creator_task`**

1. Fetch creator's Circle W3S wallet address
2. Transfer USDC from platform wallet to creator wallet via Circle W3S API
3. Update purchase record:
```python
purchase.usdc_transfer_signature = 'solana_tx_hash'
purchase.usdc_payment_status = 'distributed'
purchase.usdc_distributed_at = datetime.now()
```

4. Update creator's total sales:
```python
creator_profile.total_sales_usd += 2.35
```

**Result:** Creator sees $2.35 USDC in their Circle W3S wallet, can cash out anytime

---

## User Flows

### **New User Signup**

1. User signs up with email + password
2. Circle W3S wallet created automatically (background task)
3. User receives wallet address (Solana)
4. No action required from user - wallet is ready

**Technical:**
```python
# In SignupSerializer.create()
create_circle_wallet_for_user_task.delay(user.id, email)

# Background task creates wallet via Circle W3S API
circle_service.create_user_wallet(user_id, email)

# Profile updated with wallet info
profile.circle_wallet_id = 'wallet_abc123'
profile.circle_wallet_address = 'solana_address'
profile.wallet_provider = 'circle_w3s'
```

### **Buyer Purchases NFT**

1. Buyer clicks "Purchase" ($3.00)
2. Stripe checkout modal opens
3. Buyer enters credit card, submits
4. Payment succeeds → NFT minted to buyer's Circle W3S wallet
5. Buyer sees NFT in their library immediately

**User Experience:**
- No crypto wallet setup required
- No gas fee payment
- Instant NFT ownership

### **Creator Receives Payment**

1. Creator sells content
2. NFT minted to buyer immediately
3. Creator sees "Pending USDC Distribution" status
4. Every Monday, USDC distributed to creator's Circle W3S wallet
5. Creator can:
   - Keep USDC in Circle W3S wallet
   - Transfer to external wallet (Phantom, Solflare, etc.)
   - Cash out to USD via Coinbase or other exchange

**Creator Dashboard Shows:**
```
Total Sales: $125.50 USDC
Pending Distribution: $28.35 USDC (12 sales this week)
Available Balance: $97.15 USDC
```

---

## Database Schema

### **UserProfile (updated)**

```python
class UserProfile(models.Model):
    # Existing fields...
    wallet_address = CharField()  # For backward compatibility

    # Circle W3S fields (NEW)
    circle_wallet_id = CharField(unique=True, nullable=True)
    circle_wallet_address = CharField(nullable=True)  # Solana address
    wallet_provider = CharField(choices=[
        ('circle_w3s', 'Circle Web3 Services'),
        ('external', 'External Wallet'),
        ('web3auth', 'Web3Auth (Deprecated)'),
    ])
```

### **Purchase (updated)**

```python
class Purchase(models.Model):
    # Existing Stripe fields...
    stripe_payment_intent_id = CharField()
    gross_amount = DecimalField()
    stripe_fee = DecimalField()
    net_after_stripe = DecimalField()

    # Circle W3S NFT tracking (NEW)
    circle_nft_id = CharField()
    circle_mint_transaction_id = CharField()
    nft_mint_address = CharField()

    # USDC distribution tracking (NEW)
    usdc_payment_status = CharField(choices=[
        ('pending_conversion', 'Pending USD → USDC Conversion'),
        ('pending_distribution', 'Pending USDC Distribution'),
        ('distributed', 'USDC Distributed'),
        ('failed', 'Distribution Failed'),
    ])
    usdc_amount = DecimalField()  # Amount to distribute to creator (90%)
    usdc_transfer_signature = CharField()
    usdc_distributed_at = DateTimeField()
```

---

## API Endpoints & Webhooks

### **Stripe Webhook**

**Endpoint:** `POST /api/checkout/webhook/`

**Events Handled:**
- `checkout.session.completed`: Create Purchase record, decrement editions
- `payment_intent.succeeded`: Update with actual fees, queue NFT minting

### **Stripe Checkout Endpoint (unchanged)**

**Endpoint:** `POST /api/checkout/stripe/`

**Request:**
```json
{
  "content_id": 123,
  "payment_method": "card"
}
```

**Response:**
```json
{
  "session_id": "cs_test_abc123",
  "redirect_url": "https://checkout.stripe.com/pay/cs_test_abc123"
}
```

---

## Celery Tasks

### **1. Create Circle W3S Wallet (Signup)**

```python
@shared_task
def create_circle_wallet_for_user_task(user_id, email):
    # Create Circle W3S wallet
    # Update user profile with wallet info
```

**Triggered:** During user signup (background task)

### **2. Process Purchase with Circle W3S (After Payment)**

```python
@shared_task
def process_purchase_with_circle_w3s_task(purchase_id):
    # Mint NFT to buyer's Circle W3S wallet
    # Calculate USDC distribution amount
    # Mark for weekly distribution
```

**Triggered:** By Stripe webhook (`payment_intent.succeeded`)

### **3. Distribute USDC to Creator (Weekly Batch)**

```python
@shared_task
def distribute_usdc_to_creator_task(purchase_id):
    # Transfer USDC from platform wallet to creator wallet
    # Update purchase status to 'distributed'
    # Update creator total_sales_usd
```

**Triggered:** By `distribute_usdc_batch` management command (Mondays)

---

## Management Commands

### **Weekly USDC Distribution**

```bash
# Dry run (shows what would be distributed)
python manage.py distribute_usdc_batch --dry-run

# Actual distribution
python manage.py distribute_usdc_batch

# Auto-confirm (skip prompt)
python manage.py distribute_usdc_batch --auto-confirm
```

**Cron Schedule (Railway):**
```cron
# Every Monday at 9:00 AM UTC
0 9 * * 1 cd /app/backend && python manage.py distribute_usdc_batch --auto-confirm
```

---

## Environment Variables

### **Required Configuration**

```bash
# Stripe (existing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Circle Web3 Services (NEW)
CIRCLE_W3S_API_KEY=TEST_API_KEY:96d744d12958f4b3ded1b898032da07f:604247290b1607abc91c6b02adb2fb6d
CIRCLE_W3S_ENTITY_ID=your_entity_id_from_circle_console
CIRCLE_W3S_PLATFORM_WALLET_ID=your_developer_controlled_wallet_id
CIRCLE_W3S_PRODUCTION=false  # Set to 'true' for production

# Cloudinary (for fast image previews)
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
```

---

## Testing

### **1. Test User Signup & Wallet Creation**

```bash
# Create user via API
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "invite_code": "BETA2024"
  }'

# Check Celery logs for wallet creation
# Check user profile for circle_wallet_id and circle_wallet_address
```

### **2. Test Purchase Flow**

```bash
# 1. Create Stripe checkout session
# 2. Complete payment in Stripe test mode
# 3. Check webhook logs for payment_intent.succeeded
# 4. Check Celery logs for NFT minting task
# 5. Verify purchase.status = 'completed'
# 6. Verify purchase.usdc_payment_status = 'pending_conversion'
```

### **3. Test Weekly USDC Distribution**

```bash
# Dry run to see pending distributions
python manage.py distribute_usdc_batch --dry-run

# Mark purchases as ready for distribution (simulate manual conversion)
# In Django shell:
from rb_core.models import Purchase
Purchase.objects.filter(usdc_payment_status='pending_conversion').update(
    usdc_payment_status='pending_distribution'
)

# Run distribution
python manage.py distribute_usdc_batch --auto-confirm

# Check Celery logs for USDC transfer tasks
# Verify purchases updated to 'distributed'
```

---

## Error Handling

### **Circle W3S API Errors**

All Circle W3S API calls wrapped with try/except and logging:

```python
try:
    result = circle_service.create_user_wallet(user_id, email)
except CircleW3SError as e:
    logger.error(f'Circle API error: {e}')
    # Don't fail signup - wallet can be created later
```

### **Insufficient Platform Wallet Balance**

Before distributing USDC, check platform wallet balance:

```python
platform_balance = circle_service.get_wallet_balance(platform_wallet_id)
if platform_balance < total_usdc_needed:
    raise InsufficientBalanceError(
        f'Need {total_usdc_needed} USDC, have {platform_balance} USDC'
    )
```

### **Purchase Processing Failures**

If NFT minting fails:
- Purchase marked as `status='failed'`
- Celery task logs error with full traceback
- Admin can manually retry via Django admin or Celery flower

---

## Migration Path

### **From Web3Auth to Circle W3S**

**Existing Users:**
- Keep `web3auth_sub` and `wallet_address` for backward compatibility
- New field `wallet_provider` tracks wallet source
- Gradual migration: Prompt existing users to create Circle W3S wallet

**New Users:**
- Automatically get Circle W3S wallet on signup
- `wallet_provider='circle_w3s'` by default

---

## Security Considerations

### **1. Webhook Signature Verification**

Always verify Stripe webhook signatures (already implemented):

```python
event = stripe.Webhook.construct_event(
    payload, sig_header, webhook_secret
)
```

### **2. Circle W3S API Key Protection**

- Store `CIRCLE_W3S_API_KEY` in environment variables only
- Never commit to version control
- Rotate keys regularly
- Use Circle's API key permissions to restrict access

### **3. Platform Wallet Security**

- Use Circle W3S **developer-controlled wallet** (not user-controlled)
- Platform wallet holds USDC temporarily during weekly distribution
- Monitor wallet balance alerts via Circle dashboard

### **4. Idempotency**

All critical operations use idempotency keys:

```python
# Stripe checkout (built-in)
stripe.checkout.Session.create(idempotency_key=f'purchase-{uuid}')

# Circle W3S wallet creation
circle_service.create_user_wallet(
    idempotency_key=str(uuid.uuid5(uuid.NAMESPACE_DNS, f'user-{user_id}-wallet'))
)

# Circle W3S USDC transfer
circle_service.transfer_usdc(
    reference_id=f'purchase-{purchase_id}-distribution'
)
```

---

## Monitoring & Logging

### **Key Metrics to Track**

1. **Wallet Creation Success Rate**
   - Monitor Circle W3S wallet creation task success/failure

2. **NFT Minting Success Rate**
   - Track `process_purchase_with_circle_w3s_task` success/failure

3. **USDC Distribution Lag**
   - Time from payment to USDC distribution
   - Target: Within 1 week (next Monday)

4. **Platform Wallet Balance**
   - Alert if balance drops below $500 USDC

### **Logging**

All tasks log extensively:

```python
logger.info(f'[Circle W3S Task] Creating wallet for user {user_id}')
logger.info(f'[Circle W3S Task] ✅ Wallet created: {wallet_id}')
logger.error(f'[Circle W3S Task] Circle API error: {e}')
```

Check logs in Railway dashboard or via:
```bash
railway logs --tail
```

---

## Future Enhancements

### **1. Automated USD → USDC Conversion**

**Current:** Manual conversion via Coinbase

**Future:** Automated via:
- Circle Account (USD → USDC directly)
- Stripe → Circle integration
- Automated ACH → USDC on-ramp

### **2. Real-Time USDC Distribution**

**Current:** Weekly batch distribution

**Future:** Distribute USDC immediately after purchase (if platform wallet balance sufficient)

### **3. Creator Cashout UI**

Add "Cash Out" button in creator dashboard:
- Show USDC balance
- Generate withdrawal instructions
- Link to Coinbase/exchange tutorials

### **4. Multi-Chain Support**

**Current:** Solana only

**Future:** Support Ethereum, Polygon, etc. via Circle W3S

---

## Troubleshooting

### **Issue: User wallet not created during signup**

**Check:**
1. Celery running? `celery -A renaissBlock worker --loglevel=info`
2. Circle W3S API key valid? Check env var `CIRCLE_W3S_API_KEY`
3. Check Celery logs for errors

**Fix:**
Manually retry wallet creation:
```python
from rb_core.tasks import create_circle_wallet_for_user_task
create_circle_wallet_for_user_task.delay(user_id, email)
```

### **Issue: NFT not minted after payment**

**Check:**
1. Purchase status: Should be `payment_completed`
2. Celery task logs: Look for `process_purchase_with_circle_w3s_task`
3. Buyer has Circle W3S wallet? Check `user.profile.circle_wallet_address`

**Fix:**
Manually retry NFT minting:
```python
from rb_core.tasks import process_purchase_with_circle_w3s_task
process_purchase_with_circle_w3s_task.delay(purchase_id)
```

### **Issue: USDC distribution failing**

**Check:**
1. Platform wallet balance sufficient?
2. Creator has Circle W3S wallet?
3. Purchase status: Should be `pending_distribution`

**Fix:**
Manually retry distribution:
```python
from rb_core.tasks import distribute_usdc_to_creator_task
distribute_usdc_to_creator_task.delay(purchase_id)
```

---

## Summary

**Hybrid Stripe + Circle W3S gives us:**

✅ **Web2 UX**: Users pay with credit cards
✅ **Web3 Benefits**: NFTs, USDC payments, blockchain ownership
✅ **Creator-Friendly**: Low fees, fast payouts, global access
✅ **No Crypto Knowledge Required**: Wallets created automatically
✅ **Production-Ready**: Error handling, logging, idempotency

**Next Steps:**
1. Deploy to Railway with Circle W3S environment variables
2. Run migrations: `python manage.py migrate`
3. Set up Monday cron job for USDC distribution
4. Test purchase flow end-to-end
5. Monitor Celery task success rates

---

**Last Updated:** 2025-11-26
**Status:** ✅ Implemented, ready for testing
