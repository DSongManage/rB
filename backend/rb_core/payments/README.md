# Circle Payment Integration for renaissBlock

Circle payment processing enables credit card payments that settle in USDC on Solana blockchain.

## Overview

**Flow:**
1. User selects content to purchase
2. Frontend calls `/api/checkout/circle/` with `content_id` and `payment_method: "card"`
3. Backend creates Circle payment intent
4. User redirected to Circle's checkout page to enter card details
5. Circle processes payment and converts to USDC
6. USDC settles to platform's Solana wallet
7. Circle webhook notifies backend (`payment.confirmed` event)
8. Backend triggers NFT minting and distribution

## Setup

### 1. Get Circle API Credentials

1. Sign up at https://circle.com
2. Go to Dashboard → API Keys
3. Generate API key and webhook secret
4. Note your platform USDC wallet address (Solana)

### 2. Configure Environment Variables

Add to Railway/production:

```bash
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_WEBHOOK_SECRET=your_circle_webhook_secret
PLATFORM_USDC_WALLET_ADDRESS=your_solana_wallet_address
```

### 3. Configure Circle Webhook

In Circle Dashboard:
- **Webhook URL:** `https://api.renaissblock.com/api/checkout/circle/webhook/`
- **Events to subscribe:**
  - `payment.confirmed`
  - `payment.failed`
  - `payment.canceled`

### 4. Run Database Migration

```bash
python manage.py migrate
```

This adds Circle-specific fields to the Purchase model:
- `payment_provider` (stripe|circle)
- `circle_payment_id`
- `circle_tracking_ref`
- `circle_fee`
- `net_after_circle`
- `usdc_amount`
- `transfer_gas_cost` (Solana gas for USDC transfer to creator)

## API Endpoints

### Create Circle Payment Intent

**Endpoint:** `POST /api/checkout/circle/`

**Headers:**
- `Authorization: Bearer <user_token>`
- `Content-Type: application/json`
- `X-CSRFToken: <csrf_token>`

**Request Body:**
```json
{
  "content_id": 123,
  "payment_method": "card"
}
```

**Response:**
```json
{
  "purchase_id": 456,
  "payment_id": "circle_payment_id",
  "checkout_url": "https://checkout.circle.com/...",
  "status": "pending"
}
```

**Frontend should redirect user to `checkout_url`**

### Circle Webhook (Internal)

**Endpoint:** `POST /api/checkout/circle/webhook/`

**Headers:**
- `X-Circle-Signature: <signature>`
- `Content-Type: application/json`

**This endpoint is called by Circle, not your frontend.**

## Payment Flow Details

### Purchase Creation
When user initiates payment:
1. Purchase record created with `status='payment_pending'`
2. Purchase is linked to Circle payment ID
3. User redirected to Circle checkout

### Payment Confirmation
When Circle webhook receives `payment.confirmed`:
1. Webhook verifies signature
2. Updates Purchase with:
   - `status='payment_completed'`
   - `gross_amount`, `circle_fee`, `net_after_circle`
3. Decrements content editions
4. Triggers `mint_and_distribute_circle` task which:
   - Mints NFT to buyer's Solana wallet (tracks `mint_cost`)
   - Transfers USDC to creator's Solana wallet (tracks `transfer_gas_cost`)
   - Calculates revenue split: (net_after_circle - mint_cost - transfer_gas_cost) × 90% to creator
   - Updates purchase with all final amounts

### Error Handling
- Payment failures update Purchase `status='failed'`
- Idempotency: Uses `purchase_id` as idempotency key
- Signature verification prevents spoofed webhooks
- Race condition handling with database locks

## Testing

### Development Testing

1. Use Circle's sandbox environment:
```python
# In circle_service.py, change:
BASE_URL = "https://api-sandbox.circle.com"  # Sandbox
```

2. Use test card numbers provided by Circle:
   - Success: `4007 4000 0000 0007`
   - Decline: `4000 0000 0000 0002`

3. Test webhook locally with ngrok:
```bash
ngrok http 8000
# Update Circle webhook URL to: https://your-ngrok-url/api/checkout/circle/webhook/
```

### Production Testing

1. Start with small amounts ($0.50)
2. Verify USDC arrives in platform wallet
3. Check webhook logs in Circle Dashboard
4. Verify NFT minting triggered

## Monitoring

### Check Payment Status

```python
from rb_core.payments.circle_service import CirclePaymentService

service = CirclePaymentService()
status = service.get_payment_status('circle_payment_id')
print(status)
```

### View Webhook Logs

Check Railway logs for:
```
[Circle] Received webhook: type=payment.confirmed
[Circle] ✅ Payment confirmed for purchase X
[Circle] Queued minting task for purchase X
```

### Database Queries

```python
from rb_core.models import Purchase

# Get all Circle purchases
circle_purchases = Purchase.objects.filter(payment_provider='circle')

# Get failed Circle payments
failed = Purchase.objects.filter(
    payment_provider='circle',
    status='failed'
)

# Get completed with USDC amounts
completed = Purchase.objects.filter(
    payment_provider='circle',
    status='completed'
).exclude(usdc_amount__isnull=True)
```

## Fees

Circle charges for card processing:
- **Domestic cards:** ~2.9% + $0.30
- **International cards:** ~3.9% + $0.30

Settlement is 1:1 with USD (1 USD = 1 USDC).

Platform handles:
- Circle fee (deducted from gross)
- Solana gas costs:
  - NFT minting: ~0.000005 SOL (~$0.0001)
  - USDC transfer to creator: ~0.000005 SOL (~$0.0001)
  - Total gas: ~$0.0002 (Solana is extremely cheap!)
- Revenue split calculation:
  1. Gross amount (what customer paid)
  2. - Circle fee
  3. = Net after Circle
  4. - Mint gas cost
  5. - Transfer gas cost
  6. = Net after all costs
  7. Creator gets 90% of net after costs
  8. Platform gets 10% of net after costs

## Security

1. **Webhook Signature Verification:** HMAC-SHA256 signature prevents spoofed webhooks
2. **Idempotency:** Duplicate webhooks won't create duplicate purchases
3. **Database Locks:** `select_for_update()` prevents race conditions
4. **HTTPS Only:** All API calls use HTTPS
5. **No Card Data:** Card details never touch our servers (PCI compliance)

## Troubleshooting

### Webhook not receiving events

1. Check Circle Dashboard → Webhooks → View Logs
2. Verify webhook URL is publicly accessible
3. Check Railway logs for signature errors
4. Ensure `CIRCLE_WEBHOOK_SECRET` matches Circle Dashboard

### Payment stuck in pending

1. Check Circle Dashboard for payment status
2. Verify webhook endpoint is working
3. Check if webhook secret is correct
4. Manually trigger webhook from Circle Dashboard

### USDC not arriving

1. Verify `PLATFORM_USDC_WALLET_ADDRESS` is correct Solana address
2. Check Solana explorer: https://solscan.io
3. Verify Circle has settled payment (can take 1-2 business days)

### NFT not minting

1. Check Purchase record has `status='payment_completed'`
2. Check Railway logs for minting task errors
3. Verify Celery/async task is running
4. Check `mint_and_distribute` function logs

## Support

- Circle Docs: https://developers.circle.com
- Circle Support: support@circle.com
- Solana Explorer: https://solscan.io
