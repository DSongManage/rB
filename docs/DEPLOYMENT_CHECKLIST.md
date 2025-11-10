# Production Deployment Checklist

Complete this checklist to deploy renaissBlock to production.

---

## ✅ Pre-Deployment Setup

### 1. Get Required API Keys

**Stripe (Test Mode for Beta):**
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. For webhooks: Go to Developers → Webhooks → Add endpoint
   - URL: `https://your-railway-url.railway.app/api/payments/webhook/`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
   - Copy the **Webhook signing secret** (starts with `whsec_`)

**Web3Auth:**
1. Go to https://dashboard.web3auth.io/
2. Create a new project for "renaissBlock Beta"
3. Add your domains to whitelist:
   - Development: `http://localhost:3000`
   - Production: `https://renaissblock.com`, `https://your-vercel-url.vercel.app`
4. Copy your **Client ID**

**Email (Gmail App Password):**
1. Go to https://myaccount.google.com/apppasswords
2. Create a new app password for "renaissBlock Beta"
3. Copy the 16-character password

**Solana Wallet:**
- You already have: `C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk`

---

## 🚂 Backend Deployment (Railway)

### 1. Deploy via GitHub

1. **Go to Railway Dashboard**: https://railway.app/
2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose: `DSongManage/rB`
3. **Configure Service**
   - Set **Root Directory**: `backend`
   - Railway will auto-detect Django

### 2. Add PostgreSQL Database

1. In your project, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will create the database and set `DATABASE_URL`

### 3. Set Environment Variables

Click on backend service → Variables tab → Raw Editor, paste this:

```bash
# Core Django Settings
SECRET_KEY=bklb(ilbn)!s9tv3puhz0pyo**vl2x#$b=bdro%7l$$5x*d9e#
DEBUG=False
ENVIRONMENT=production
BETA_MODE=true
ALLOWED_HOSTS=.railway.app,renaissblock.com,api.renaissblock.com

# Database (these reference the PostgreSQL service)
DB_NAME=${{PGDATABASE}}
DB_USER=${{PGUSER}}
DB_PASSWORD=${{PGPASSWORD}}
DB_HOST=${{PGHOST}}
DB_PORT=${{PGPORT}}

# Stripe Keys (UPDATE WITH YOUR ACTUAL KEYS)
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
STRIPE_TEST_MODE=true

# Email Configuration (UPDATE WITH YOUR GMAIL)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-16-char-app-password
DEFAULT_FROM_EMAIL=beta@renaissblock.com
ADMIN_EMAIL=your-email@gmail.com

# Web3Auth (UPDATE WITH YOUR CLIENT ID)
WEB3AUTH_CLIENT_ID=YOUR_WEB3AUTH_CLIENT_ID_HERE

# Solana (Devnet for Beta)
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
PLATFORM_WALLET_PUBKEY=C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk

# URLs (will update after frontend deployment)
FRONTEND_URL=https://renaissblock.com
FRONTEND_ORIGIN=https://renaissblock.com
CORS_ORIGINS=https://renaissblock.com,https://www.renaissblock.com

# Features
FEATURE_COLLABORATIVE_MINTING=true
MAX_UPLOAD_BYTES=10485760
```

### 4. Get Your Backend URL

1. After deployment, go to "Settings" → "Networking"
2. Click "Generate Domain"
3. Copy your Railway URL (e.g., `https://renaissblock-backend-production.up.railway.app`)
4. **Save this URL** - you'll need it for frontend deployment

### 5. Create Superuser (Optional - for admin access)

Option A - Railway CLI:
```bash
railway login
railway link  # Select your project
railway run python manage.py createsuperuser
```

Option B - Django Shell via Railway:
```bash
railway run python manage.py shell
# Then run:
from django.contrib.auth import get_user_model
User = get_user_model()
User.objects.create_superuser('admin', 'admin@renaissblock.com', 'secure-password')
```

---

## 🎨 Frontend Deployment (Vercel)

### 1. Update Environment Variables

Edit `frontend/.env.production` with your Railway backend URL:

```env
VITE_API_URL=https://your-railway-url.railway.app
VITE_FRONTEND_URL=https://renaissblock.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
VITE_ENVIRONMENT=beta
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_WEB3AUTH_CLIENT_ID=YOUR_WEB3AUTH_CLIENT_ID_HERE
VITE_BETA_MODE=true
VITE_TEST_MODE=true
VITE_FEATURE_COLLABORATIVE_MINTING=true
```

### 2. Deploy to Vercel

```bash
cd ~/repos/songProjects/rB/frontend

# Login to Vercel (opens browser)
vercel login

# Deploy to production
vercel --prod
```

Follow the prompts:
- Link to existing project? **No**
- What's your project's name? **renaissblock**
- In which directory is your code located? **./`** (current directory)
- Vercel will auto-detect Vite

### 3. Add Environment Variables to Vercel

After deployment:
1. Go to your project in Vercel dashboard
2. Settings → Environment Variables
3. Add all variables from `.env.production`
4. Redeploy: `vercel --prod`

### 4. Get Your Frontend URL

Vercel will give you a URL like: `https://renaissblock.vercel.app`

### 5. Update Backend CORS Settings

Go back to Railway → Backend service → Variables and update:
```
CORS_ORIGINS=https://renaissblock.vercel.app,https://renaissblock.com
FRONTEND_URL=https://renaissblock.vercel.app
FRONTEND_ORIGIN=https://renaissblock.vercel.app
```

---

## 🌐 Domain Configuration (renaissblock.com)

### 1. Configure Frontend Domain (Vercel)

**In Vercel Dashboard:**
1. Go to your project → Settings → Domains
2. Add domain: `renaissblock.com`
3. Add domain: `www.renaissblock.com`
4. Vercel will show you DNS records to add

**In Your Domain Registrar (GoDaddy/Namecheap/etc):**

Add these DNS records:
```
Type: A
Name: @
Value: 76.76.19.61
TTL: 3600

Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

### 2. Configure Backend Domain (Railway)

**In Railway Dashboard:**
1. Backend service → Settings → Networking
2. Custom Domain: `api.renaissblock.com`
3. Railway will show you DNS records

**In Your Domain Registrar:**
```
Type: CNAME
Name: api
Value: your-railway-url.railway.app
TTL: 3600
```

### 3. Update Environment Variables After Domain Setup

**Railway (Backend):**
```
ALLOWED_HOSTS=.railway.app,renaissblock.com,api.renaissblock.com,www.renaissblock.com
CORS_ORIGINS=https://renaissblock.com,https://www.renaissblock.com
FRONTEND_URL=https://renaissblock.com
FRONTEND_ORIGIN=https://renaissblock.com
```

**Vercel (Frontend):**
```
VITE_API_URL=https://api.renaissblock.com
VITE_FRONTEND_URL=https://renaissblock.com
```

---

## ✅ Post-Deployment Verification

### 1. Test Backend Health
```bash
curl https://api.renaissblock.com/api/auth/csrf/
# Should return JSON with CSRF token
```

### 2. Test Frontend
```bash
curl https://renaissblock.com
# Should return HTML
```

### 3. Test Full Beta Flow

1. Visit https://renaissblock.com
2. Click "Request Beta Access"
3. Submit your email
4. Go to Django admin: https://api.renaissblock.com/admin
5. Login with superuser credentials
6. Approve beta request (generates invite code and sends email)
7. Check email for invite
8. Register with invite code
9. Login and test features:
   - Buy credits with Stripe test card: `4242 4242 4242 4242`
   - Upload a book
   - Mint NFT on Solana devnet
   - Test collaboration features

### 4. Monitor Logs

**Railway:**
- View logs in real-time in the deployment tab

**Vercel:**
- View logs under Deployments → Your deployment → View Function Logs

---

## 🔐 Security Final Checks

- [ ] `DEBUG=False` in Railway
- [ ] Strong `SECRET_KEY` set (never commit to git)
- [ ] HTTPS working on both domains
- [ ] CORS only allows your domains
- [ ] Stripe test mode enabled
- [ ] Email sending works
- [ ] Web3Auth whitelist configured
- [ ] Database backups enabled in Railway
- [ ] `.env` files in `.gitignore`

---

## 📊 Monitoring Setup (Recommended)

1. **Sentry** (Error Tracking)
   - Sign up at https://sentry.io
   - Add Sentry SDK to both frontend and backend

2. **UptimeRobot** (Uptime Monitoring)
   - Monitor https://api.renaissblock.com/api/auth/csrf/
   - Monitor https://renaissblock.com

3. **Railway Metrics**
   - View CPU, Memory, and Database usage in Railway dashboard

---

## 🎉 You're Live!

Once all checks pass:
1. Share beta landing page: https://renaissblock.com
2. Start accepting beta testers
3. Monitor feedback via the in-app feedback button
4. Check Django admin regularly for beta requests

---

**Last Updated:** 2025-11-09
**Version:** 1.0.0
