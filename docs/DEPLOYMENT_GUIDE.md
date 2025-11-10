# Production Deployment Guide

Complete guide for deploying renaissBlock to production.

---

## 📋 Prerequisites

- [ ] PostgreSQL database (recommended: 11+)
- [ ] Python 3.13+ runtime
- [ ] Node.js 18+ (for frontend build)
- [ ] Domain name configured (renaissblock.com)
- [ ] SSL certificate (HTTPS)
- [ ] Email service (SendGrid, AWS SES, etc.)
- [ ] Stripe account (test mode keys for beta)
- [ ] Solana devnet wallet for platform fees

---

## 🔧 Backend Deployment

### 1. Environment Setup

**Copy production environment template:**
```bash
cd backend
cp .env.production.example .env
```

**Edit `.env` and fill in all values:**
- `SECRET_KEY` - Generate new: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- `DB_*` - PostgreSQL connection details
- `STRIPE_SECRET_KEY` - From Stripe dashboard (test mode)
- `EMAIL_HOST_*` - SMTP credentials
- `WEB3AUTH_CLIENT_ID` - From Web3Auth dashboard
- All other required values

### 2. Database Setup

**Create PostgreSQL database:**
```bash
psql -U postgres
CREATE DATABASE renaissblock;
CREATE USER renaissblock_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE renaissblock TO renaissblock_user;
\q
```

**Update `.env` with database credentials:**
```env
DB_NAME=renaissblock
DB_USER=renaissblock_user
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432
```

### 3. Install Dependencies

```bash
# Activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 4. Run Migrations

```bash
# Apply database migrations
python manage.py migrate

# Create superuser for admin access
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

### 5. Test Configuration

```bash
# Check for deployment issues
python manage.py check --deploy

# Test database connection
python manage.py dbshell

# Verify settings
python manage.py shell
>>> from django.conf import settings
>>> print(settings.DEBUG)  # Should be False
>>> print(settings.DATABASES['default']['ENGINE'])  # Should be postgresql
```

### 6. Run Server

**For testing:**
```bash
python manage.py runserver
```

**For production (using Gunicorn):**
```bash
gunicorn renaissBlock.wsgi --bind 0.0.0.0:8000 --workers 2
```

---

## 🎨 Frontend Deployment

### 1. Environment Setup

**Copy production environment:**
```bash
cd frontend
cp .env.production .env.production.local
```

**Edit `.env.production.local`:**
```env
VITE_API_URL=https://api.renaissblock.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_test_key
VITE_ENVIRONMENT=production
VITE_SOLANA_NETWORK=devnet
VITE_WEB3AUTH_CLIENT_ID=your-web3auth-client-id
VITE_BETA_MODE=true
VITE_TEST_MODE=true
```

### 2. Build for Production

```bash
# Install dependencies
npm install

# Build optimized production bundle
npm run build
```

**Output:** `dist/` directory contains production-ready files

### 3. Deploy Built Files

**Option A: Static hosting (Netlify, Vercel, Cloudflare Pages)**
- Upload `dist/` directory
- Configure redirects for SPA routing
- Set environment variables in hosting dashboard

**Option B: Custom server (Nginx)**
```nginx
server {
    listen 80;
    server_name renaissblock.com;

    root /var/www/renaissblock/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to Django backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🚀 Deployment Platforms

### Heroku

**Prerequisites:**
- Heroku account
- Heroku CLI installed

**Deploy:**
```bash
# Login to Heroku
heroku login

# Create app
heroku create renaissblock-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set DEBUG=False
heroku config:set SECRET_KEY=your-secret-key
heroku config:set STRIPE_SECRET_KEY=sk_test_...
# ... set all required env vars

# Deploy
git push heroku main

# Run migrations
heroku run python manage.py migrate

# Create superuser
heroku run python manage.py createsuperuser
```

### Render

**Prerequisites:**
- Render account

**Deploy:**
1. Connect GitHub repository
2. Create Web Service for backend
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn renaissBlock.wsgi`
3. Add PostgreSQL database
4. Set environment variables in dashboard
5. Deploy

### Railway

**Prerequisites:**
- Railway account

**Deploy:**
1. Connect GitHub repository
2. Add PostgreSQL service
3. Configure environment variables
4. Deploy automatically on push

---

## 🔐 Security Checklist

**Before going live:**

- [ ] `DEBUG=False` in production
- [ ] Strong `SECRET_KEY` (never commit to git)
- [ ] HTTPS enabled (SSL certificate)
- [ ] CORS configured for production domain only
- [ ] Database password is strong
- [ ] Email SMTP credentials secured
- [ ] Stripe webhooks configured with webhook secret
- [ ] Web3Auth domain whitelist configured
- [ ] Rate limiting enabled
- [ ] Static files served via CDN or WhiteNoise
- [ ] Database backups configured
- [ ] Error monitoring enabled (Sentry, etc.)

---

## 📊 Post-Deployment

### 1. Verify Deployment

**Backend health check:**
```bash
curl https://api.renaissblock.com/api/auth/csrf/
```

**Frontend health check:**
```bash
curl https://renaissblock.com
```

### 2. Test Beta Flow

1. Visit https://renaissblock.com
2. Request beta access
3. Approve in Django admin: https://api.renaissblock.com/admin
4. Receive invite email
5. Register with invite code
6. Login and test features

### 3. Monitor Logs

**Heroku:**
```bash
heroku logs --tail
```

**Render:**
- View logs in dashboard

**Custom server:**
```bash
# Gunicorn logs
tail -f /var/log/gunicorn/access.log
tail -f /var/log/gunicorn/error.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 4. Setup Monitoring

**Recommended tools:**
- **Uptime monitoring:** UptimeRobot, Pingdom
- **Error tracking:** Sentry
- **Analytics:** Google Analytics, Plausible
- **Performance:** New Relic, DataDog

---

## 🔄 Continuous Deployment

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "renaissblock-api"
          heroku_email: "your-email@example.com"
```

---

## 🆘 Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U renaissblock_user -d renaissblock
```

### Static Files Not Loading

```bash
# Recollect static files
python manage.py collectstatic --clear --noinput

# Check STATIC_ROOT in settings
python manage.py shell
>>> from django.conf import settings
>>> print(settings.STATIC_ROOT)
```

### CORS Errors

**Check `CORS_ALLOWED_ORIGINS` in settings:**
- Must include production frontend domain
- Must use HTTPS in production
- Check browser console for specific error

### Email Not Sending

```bash
# Test email configuration
python manage.py shell
>>> from django.core.mail import send_mail
>>> send_mail('Test', 'Body', 'from@example.com', ['to@example.com'])
```

---

## 📚 Additional Resources

- [Django Deployment Checklist](https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt SSL](https://letsencrypt.org/)

---

## 🎉 Production Launch Checklist

**Final checklist before announcing beta:**

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Static files collected and served
- [ ] HTTPS enabled and working
- [ ] Beta landing page accessible
- [ ] Beta request form working
- [ ] Email invites sending
- [ ] Invite code validation working
- [ ] User registration with invite working
- [ ] Authentication working
- [ ] Payment flow tested (test mode)
- [ ] NFT minting tested (devnet)
- [ ] Feedback button working
- [ ] Error monitoring active
- [ ] Backups configured
- [ ] Admin dashboard accessible

---

**Created:** 2025-11-09
**Last Updated:** 2025-11-09
**Version:** 1.0.0
