# Circle Payment Integration & Image Fixes

## Summary of Changes

### ✅ 1. Circle Payment Integration (COMPLETED)

#### Backend Changes:
- **Purchase Model** (`backend/rb_core/models.py`):
  - Added `payment_provider` field (stripe/circle)
  - Added Circle-specific fields: `circle_payment_id`, `circle_tracking_ref`, `circle_fee`, `net_after_circle`
  - Updated model indexes for Circle fields
  - Made `stripe_payment_intent_id` non-unique to support both payment providers

- **Migration Created** (`backend/rb_core/migrations/0027_add_circle_payment_support.py`):
  - Adds all Circle payment fields
  - Updates indexes
  - Makes stripe_payment_intent_id optional (blank=True)

#### Frontend Changes:
- **PreviewModal.tsx**:
  - Changed checkout endpoint from `/api/checkout/session/` (Stripe) to `/api/checkout/circle/` (Circle)
  - Added `payment_method: 'card'` to request body
  - Updated error handling for Circle-specific error codes:
    - `NO_BUYER_WALLET`: User needs to set up wallet in profile
    - `NO_CREATOR_WALLET`: Creator wallet not configured
    - `CIRCLE_ERROR`: Circle API error

#### Existing Circle Infrastructure:
- ✅ Circle checkout view already exists (`backend/rb_core/payments/views.py`)
- ✅ Circle webhook handler already exists (`backend/rb_core/webhooks.py`)
- ✅ Circle service already exists (`backend/rb_core/payments/circle_service.py`)
- ✅ URLs already configured in `backend/rb_core/urls.py`

---

## 🔧 Action Items Required

### 1. Railway Environment Variables

Add these variables in Railway (Variables tab):

```bash
# Circle Payment Integration
CIRCLE_API_KEY=your_circle_api_key_here
CIRCLE_WEBHOOK_SECRET=your_circle_webhook_secret_here
PLATFORM_USDC_WALLET_ADDRESS=your_solana_wallet_address_here

# Cloudinary (if not already set)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

**Where to find Circle credentials:**
1. Go to Circle developer dashboard
2. API Key: Under "API Settings" or "Credentials"
3. Webhook Secret: Under "Webhooks" section when you configure the webhook
4. Platform wallet: Your Solana wallet address to receive USDC payments

### 2. Circle Webhook Configuration

In Circle dashboard:
1. Go to Webhooks section
2. Add webhook URL: `https://your-railway-app.up.railway.app/api/checkout/circle/webhook/`
3. Enable these events:
   - `payment.confirmed`
   - `payment.failed`
   - `payment.canceled`
4. Copy the Webhook Secret and add to Railway as `CIRCLE_WEBHOOK_SECRET`

### 3. Run Database Migrations

After deploying, run this command in Railway terminal or via Railway's interface:

```bash
python backend/manage.py migrate
```

This will apply the new Circle payment fields to the Purchase model.

### 4. Frontend Build

The frontend code has been updated. Make sure to:
```bash
cd frontend
npm run build
```

---

## 🖼️ Image Loading Issues Explained

### Avatar Images (Cloudinary)
- ✅ **Already configured correctly**
- Avatars use Django's `ImageField` which uploads to Cloudinary via `DEFAULT_FILE_STORAGE`
- Should work once `CLOUDINARY_*` env vars are set in Railway

### Art/PDF NFT Images (IPFS)
- ⚠️ **These use IPFS, not Cloudinary** (by design for decentralization)
- Content files are uploaded to IPFS gateway: `https://ipfs.io/ipfs/{hash}`
- Images in library use `content.teaser_link` which points to IPFS

**Why images might not load:**
1. **IPFS gateway slow/down**: IPFS can be slow or unreliable
2. **IPFS upload failing**: Check if IPFS client is properly configured
3. **Missing Cloudinary config**: Avatars won't work without Cloudinary env vars

**Solutions:**
1. **Immediate**: Verify `CLOUDINARY_*` env vars are set in Railway
2. **For IPFS**: Consider adding Cloudinary as fallback for art/images if IPFS is unreliable
3. **For avatars**: Once Cloudinary is configured, avatars should load properly

---

## 📝 Library Display Fix

The library currently uses `content.teaser_link` for thumbnails (backend/rb_core/views/library.py:46).

For art/images, this points to IPFS. If you want to use Cloudinary instead:

**Option A: Keep IPFS (recommended for decentralization)**
- Ensure IPFS gateway is working
- Consider using faster IPFS gateway (Pinata, Fleek, etc.)

**Option B: Add Cloudinary support for content images**
- Modify content upload to also save to Cloudinary
- Update library view to use Cloudinary URL
- (This requires more code changes)

---

## 🚀 Deployment Steps

1. **Set Environment Variables in Railway:**
   - Circle: `CIRCLE_API_KEY`, `CIRCLE_WEBHOOK_SECRET`, `PLATFORM_USDC_WALLET_ADDRESS`
   - Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

2. **Configure Circle Webhook:**
   - Add webhook URL in Circle dashboard
   - Copy webhook secret to Railway

3. **Commit and Push Changes:**
   ```bash
   git add -A
   git commit -m "Integrate Circle payments and add Circle fields to Purchase model"
   git push origin main
   ```

4. **After Deployment:**
   - Railway will automatically redeploy
   - Run migrations: `python backend/manage.py migrate`
   - Test a purchase flow

5. **Verify Setup:**
   - Upload an avatar (should use Cloudinary)
   - Create art content (will use IPFS)
   - Purchase an NFT (should use Circle)
   - Check if it appears in library
   - Verify edition count decreases

---

## ⚠️ Important Notes

### Purchase Flow Changes
- **Before**: Stripe → Stripe webhook → decrement editions → create Purchase
- **After**: Circle → Circle webhook → decrement editions → create Purchase

The Circle webhook handler already implements the post-purchase logic:
- Decrements `content.editions` (line 261-263 in payments/views.py)
- Creates/updates Purchase record
- Should trigger NFT minting (if celery task exists)

### Testing
1. **Test wallet setup**: Users must have wallet address in profile
2. **Test purchase**: Go through full Circle checkout flow
3. **Check library**: Purchased content should appear
4. **Check editions**: Should decrement after successful purchase

### Rollback Plan
If Circle doesn't work:
1. Frontend: Change `/api/checkout/circle/` back to `/api/checkout/session/`
2. Purchases will still use Stripe
3. No data loss - old Stripe purchases are unaffected

---

## 🐛 Known Issues & Next Steps

1. **Wallet Address Required**: Users must set up wallet in profile before purchasing
   - May want to add better error message or onboarding flow

2. **IPFS Reliability**: IPFS images might load slowly
   - Consider adding Cloudinary as fallback or using faster IPFS gateway

3. **NFT Minting**: Circle webhook calls `mint_and_distribute_circle` task
   - Verify this Celery task exists and works
   - If not, purchases will complete but NFTs won't mint

4. **Mobile Optimization**: Circle checkout might need mobile testing

---

## 📞 Support

If you encounter issues:
1. Check Railway logs for errors
2. Check Circle dashboard for payment status
3. Check database to see if Purchase records are being created
4. Verify all environment variables are set correctly
