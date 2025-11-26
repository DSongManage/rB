# Urgent Fixes Required for NFT Purchase & Image Loading

## 🚨 Critical Issues Found

### 1. Circle Payment Error - IMMEDIATE FIX NEEDED
**Error:** `PLATFORM_USDC_WALLET_ADDRESS not configured`

**Fix in Railway:**
```bash
# Go to Railway → Variables → Add Variable
PLATFORM_USDC_WALLET_ADDRESS=your_solana_wallet_address_here
```

Without this, ALL Circle payments will fail with "payment system error".

---

### 2. Railway Trying to Run Node.js Instead of Django
**Error:** `Error: Cannot find module '/app/index.js'`

**Root Cause:** `package.json` in root directory makes Railway think it's a Node.js app.

**Fix in Railway Dashboard:**

**Option A: Set Root Directory**
1. Go to your Django backend service in Railway
2. Settings → **Root Directory** → Set to: `backend`
3. This makes Railway run from the backend folder

**Option B: Set Start Command**
1. Settings → **Start Command** → Set to: `cd backend && bash start.sh`
2. This changes to backend directory before running

**Option C: Create railway.toml** (Recommended)
```toml
# Create this file at: /railway.toml

[build]
builder = "nixpacks"
buildCommand = "cd backend && pip install -r requirements.txt"

[deploy]
startCommand = "cd backend && bash start.sh"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

---

### 3. NFT Images Going to IPFS Before Minting (BREAKS LAZY MINTING!)

**Problem:** Images are uploaded to IPFS in `ContentListView.perform_create()` - this happens when content is **created**, NOT when it's minted!

**Current Flow (WRONG for lazy minting):**
```
1. User uploads art → IPFS upload happens immediately
2. teaser_link = https://ipfs.io/ipfs/{hash}
3. Content created with teaser_link
4. Later: Minting happens (but image already on IPFS!)
```

**This violates lazy minting principle:** Images should NOT go to IPFS until NFT is actually minted.

**Correct Flow for Lazy Minting:**
```
1. User uploads art → Save to Cloudinary (temporary storage)
2. teaser_link = Cloudinary URL
3. Content created as "draft"
4. User clicks "Mint" → THEN upload to IPFS
5. Update teaser_link to IPFS URL
6. Content status = "minted"
```

**Files to Change:**

**A. Content Creation (backend/rb_core/views/__init__.py:132-240)**

Current code uploads to IPFS immediately:
```python
if file:
    validate_upload(file)
    # Try IPFS ← WRONG! This happens before minting
    client = ipfshttpclient.connect(...)
    res = client.add(out)  # Uploads to IPFS NOW
    teaser_link = f'https://ipfs.io/ipfs/{ipfs_hash}'
```

**Should be changed to:**
```python
if file:
    validate_upload(file)
    # Save to Cloudinary for preview (NOT IPFS yet!)
    # Use Django's default file storage (configured for Cloudinary)

    # For images, save directly to Cloudinary
    if is_image:
        # Create a ContentImage model or use Cloudinary upload
        from cloudinary.uploader import upload
        result = upload(file, folder='content_previews')
        teaser_link = result['secure_url']
        ipfs_hash = ''  # Leave empty until minting
    else:
        # For non-images, still save to Cloudinary or local storage
        teaser_link = ''
        ipfs_hash = ''
```

**B. Minting (backend/rb_core/views/__init__.py:326-400)**

The MintView should handle IPFS upload:
```python
class MintView(APIView):
    def post(self, request):
        content_id = request.data.get('content_id')
        content = Content.objects.get(id=content_id)

        # NOW upload to IPFS (during minting, not creation)
        if content.teaser_link.startswith('https://res.cloudinary.com'):
            # Fetch image from Cloudinary
            # Upload to IPFS
            # Update content.ipfs_hash and content.teaser_link
            pass

        content.inventory_status = 'minted'
        content.save()
```

**Why This Matters:**
- IPFS uploads are permanent and public
- Lazy minting means NO blockchain/IPFS interaction until user pays gas
- Current code exposes content to IPFS before minting
- IPFS gateway (ipfs.io) can be slow/unreliable for loading images

---

## 📋 Recommended Solution

### Short-term (Quick Fix):
1. **Add PLATFORM_USDC_WALLET_ADDRESS to Railway** ← DO THIS NOW
2. **Fix Railway start command** to use `backend/start.sh`
3. **Keep current IPFS flow** but check if IPFS gateway is working:
   - Test: `https://ipfs.io/ipfs/{your_hash}`
   - If not loading, use faster gateway: `https://gateway.pinata.cloud/ipfs/{hash}`

### Long-term (Proper Lazy Minting):
1. **Change content creation to use Cloudinary**
2. **Move IPFS upload to MintView**
3. **Store both Cloudinary URL (preview) and IPFS hash (minted)**
4. **Show Cloudinary image before minting, IPFS after**

---

## 🧪 Testing After Fixes

**Test 1: Circle Payment**
```bash
# After adding PLATFORM_USDC_WALLET_ADDRESS:
1. Try purchasing NFT
2. Should redirect to Circle checkout
3. Check logs for success (not "not configured" error)
```

**Test 2: Image Loading**
```bash
# Check what URL is being used for thumbnails:
1. Inspect network tab in browser
2. Look for image requests
3. Should see either:
   - https://ipfs.io/ipfs/{hash} (current - might be slow)
   - https://res.cloudinary.com/{your_cloud}/... (better)
```

**Test 3: Lazy Minting**
```bash
# Verify IPFS upload only happens on mint:
1. Create content → Check ipfs_hash field (should be empty)
2. Mint content → Check ipfs_hash field (should be populated)
3. Check logs for IPFS upload only during minting
```

---

## 🔍 Quick Diagnostics

**Check if IPFS is the problem:**
```python
# In Django shell or logs, check a content object:
content = Content.objects.first()
print(f"teaser_link: {content.teaser_link}")
print(f"ipfs_hash: {content.ipfs_hash}")

# Try loading the IPFS URL directly:
# https://ipfs.io/ipfs/{ipfs_hash}
# If it times out → IPFS gateway issue
# If 404 → Upload failed
# If loads → Frontend not loading properly
```

**Check Cloudinary config:**
```python
# In Django shell:
from django.conf import settings
print(settings.CLOUDINARY_STORAGE)
print(settings.DEFAULT_FILE_STORAGE)

# Should show Cloudinary is configured
```

---

## 🎯 Priority Order

1. **[URGENT]** Add `PLATFORM_USDC_WALLET_ADDRESS` to Railway
2. **[URGENT]** Fix Railway start command / root directory
3. **[HIGH]** Test if IPFS images are actually loading (browser network tab)
4. **[HIGH]** If IPFS slow, switch to faster gateway
5. **[MEDIUM]** Implement proper lazy minting with Cloudinary
6. **[LOW]** Optimize image loading with CDN/caching

---

## Current Image Loading Flow

```
Content Creation:
├── User uploads image file
├── Watermark added (PIL)
├── Upload to IPFS (Infura gateway) ← Happens immediately!
├── Set teaser_link = ipfs.io URL
└── Save Content object

User Views Library:
├── Fetch purchases
├── Get content.teaser_link for each
├── Browser loads: https://ipfs.io/ipfs/{hash}
└── Image displays (or times out if IPFS slow)
```

**Problem:** IPFS gateway might be:
- Slow to respond
- Not pinning the content
- Blocked by firewall
- Content not propagated across IPFS network

**Solution:** Use Cloudinary for thumbnails, IPFS only for minted/final content.
