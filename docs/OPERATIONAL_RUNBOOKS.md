# Operational Runbooks

This document contains procedures for handling common operational scenarios for the renaissBlock platform.

## Table of Contents

1. [Site Down Procedure](#1-site-down-procedure)
2. [Payment Processor Issues](#2-payment-processor-issues)
3. [Solana RPC Issues](#3-solana-rpc-issues)
4. [Database Issues](#4-database-issues)
5. [High Load / Performance Issues](#5-high-load--performance-issues)
6. [Security Incident Response](#6-security-incident-response)
7. [Maintenance Mode](#7-maintenance-mode)
8. [Rollback Procedure](#8-rollback-procedure)

---

## 1. Site Down Procedure

### Detection
- UptimeRobot alert or user reports
- Check `/health/` endpoint returns non-200

### Immediate Actions

1. **Check Railway Dashboard**
   ```bash
   railway status
   railway logs
   ```

2. **Check Health Endpoint**
   ```bash
   curl -s https://api.renaissblock.com/health/ | jq
   ```

3. **Identify the component that's failing:**
   - `database: unhealthy` → See [Database Issues](#4-database-issues)
   - `redis: unhealthy` → Celery issues, check worker logs
   - HTTP 503 → Maintenance mode may be enabled

4. **If Railway is down:**
   - Check [Railway Status Page](https://status.railway.app/)
   - Tweet update via company Twitter
   - Update Statuspage.io

5. **If application is crashing:**
   ```bash
   # Check recent deploys
   railway logs --recent

   # Rollback if needed
   railway rollback
   ```

### Post-Incident
- Update Statuspage.io with resolution
- Create incident report
- Identify root cause and preventive measures

---

## 2. Payment Processor Issues

### Stripe Issues

**Symptoms:**
- Checkout sessions failing
- Webhook not receiving events
- Refunds not processing

**Diagnosis:**
```bash
# Check Stripe dashboard for failed webhooks
# Go to: https://dashboard.stripe.com/webhooks

# Check backend logs for Stripe errors
railway logs | grep -i stripe
```

**Resolution Steps:**

1. **Verify Stripe API keys:**
   ```bash
   railway variables | grep STRIPE
   ```

2. **Check webhook endpoint is reachable:**
   ```bash
   curl -X POST https://api.renaissblock.com/api/webhooks/stripe/ -H "Content-Type: application/json" -d '{}'
   # Should return 400 (invalid signature), not 500
   ```

3. **Resend failed webhooks:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Find failed events and click "Resend"

4. **If Stripe is down:**
   - Check [Stripe Status](https://status.stripe.com/)
   - Enable maintenance mode for checkout
   - Communicate to users

### Bridge.xyz Issues

**Symptoms:**
- Creator payouts failing
- KYC links not generating
- USDC not converting to USD

**Diagnosis:**
```bash
# Check Bridge logs
railway logs | grep -i bridge

# Check Bridge dashboard
# https://dashboard.bridge.xyz
```

**Resolution:**

1. **Check Bridge API status:**
   ```bash
   curl -s https://api.bridge.xyz/health
   ```

2. **For failed transfers:**
   - Check `BridgeTransfer` model in Django admin
   - Look for `status='failed'` records
   - Manually retry or issue Stripe refund

### Coinbase Onramp Issues

**Symptoms:**
- Onramp widget not loading
- Transactions stuck in pending
- Webhooks not received

**Resolution:**

1. **Verify Coinbase credentials:**
   ```bash
   railway variables | grep COINBASE
   ```

2. **Check transaction status in Django admin:**
   - Go to `/admin/rb_core/coinbasetransaction/`
   - Find stuck transactions
   - Check `status` and `error_message` fields

---

## 3. Solana RPC Issues

### Symptoms
- NFT minting failing
- Balance checks timing out
- Transaction confirmation delays

### Diagnosis

```bash
# Check current RPC endpoint
railway variables | grep SOLANA_RPC

# Test RPC connectivity
curl -X POST https://api.devnet.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

### Resolution

1. **If public RPC is throttling:**
   - Upgrade to paid RPC (Helius, QuickNode)
   - Set new URL in Railway:
   ```bash
   railway variables set SOLANA_RPC_URL=https://your-helius-url.helius.xyz
   ```

2. **If devnet is having issues:**
   - Check [Solana Status](https://status.solana.com/)
   - Wait for network recovery
   - Enable maintenance mode if prolonged

3. **Temporary mitigation:**
   - Increase retry attempts in code
   - Add longer timeouts
   - Queue failed transactions for retry

---

## 4. Database Issues

### Connection Errors

**Symptoms:**
- 500 errors on all API calls
- Health check shows `database: unhealthy`

**Diagnosis:**
```bash
# Check Railway PostgreSQL status
railway status

# Check connection count
railway run python manage.py dbshell -c "SELECT count(*) FROM pg_stat_activity;"
```

**Resolution:**

1. **Connection pool exhausted:**
   - Restart web service: `railway restart`
   - Consider adding connection pooler (PgBouncer)

2. **Database disk full:**
   - Check Railway dashboard for storage usage
   - Upgrade database plan or clean old data

3. **Database corruption:**
   - Contact Railway support
   - Restore from backup (see below)

### Restoring from Backup

```bash
# If Railway backups are enabled (Pro tier)
# Go to Railway Dashboard → Database → Backups → Restore

# Manual restore from dump:
pg_restore -d DATABASE_URL backup.dump
```

---

## 5. High Load / Performance Issues

### Symptoms
- Slow response times (>2s)
- 502/503 errors during traffic spikes
- Memory exhaustion warnings

### Immediate Actions

1. **Check Railway metrics:**
   - Dashboard → Service → Metrics
   - Look for CPU/Memory spikes

2. **Scale up workers:**
   ```bash
   railway variables set GUNICORN_WORKERS=4
   railway restart
   ```

3. **Enable rate limiting (already configured in DRF):**
   - Check current limits in settings.py
   - Reduce if needed to protect service

4. **Identify slow endpoints:**
   - Check Sentry Performance dashboard
   - Look for N+1 queries
   - Add database indexes if needed

### Capacity Planning

| Tier | RAM | Workers | Estimated Capacity |
|------|-----|---------|-------------------|
| Hobby | 512MB | 2 | ~10-20 concurrent |
| Pro | 8GB | 4-8 | ~100-200 concurrent |

### Upgrading to Railway Pro

1. Go to Railway Dashboard → Settings → Plan
2. Upgrade to Pro ($20/mo)
3. Increase workers:
   ```bash
   railway variables set GUNICORN_WORKERS=4
   railway restart
   ```

---

## 6. Security Incident Response

### Suspected Data Breach

1. **Immediate containment:**
   - Enable maintenance mode
   - Rotate all API keys and secrets
   - Check access logs

2. **Investigation:**
   - Review Sentry for unusual errors
   - Check Railway audit logs
   - Review recent code changes

3. **Notification (if required):**
   - Consult legal counsel
   - Prepare user notification
   - Report to relevant authorities if PII involved

### Suspicious Activity

1. **Block specific IP:**
   - Add to blocked IPs in Cloudflare (if using)
   - Or add to Django blocklist

2. **Disable compromised accounts:**
   ```python
   # Django admin or shell
   user.is_active = False
   user.save()
   ```

3. **Force password reset:**
   - Send password reset email to affected users

---

## 7. Maintenance Mode

### Enabling Maintenance Mode

```bash
# Via Railway environment variables
railway variables set MAINTENANCE_MODE=true
railway variables set MAINTENANCE_MESSAGE="We're performing scheduled maintenance. Back in 30 minutes."
railway restart
```

### Bypassing Maintenance Mode (for testing)

Add your IP to bypass list:
```bash
railway variables set MAINTENANCE_BYPASS_IPS=YOUR_IP_ADDRESS
```

### Disabling Maintenance Mode

```bash
railway variables set MAINTENANCE_MODE=false
railway restart
```

---

## 8. Rollback Procedure

### Railway Rollback

1. **Via Dashboard:**
   - Go to Railway Dashboard → Deployments
   - Find the last working deployment
   - Click "Redeploy"

2. **Via CLI:**
   ```bash
   railway rollback
   ```

### Database Migration Rollback

```bash
# Identify the migration to rollback to
railway run python manage.py showmigrations rb_core

# Rollback to specific migration
railway run python manage.py migrate rb_core 0085_previous_migration
```

**Warning:** Always backup before migration rollbacks:
```bash
# Export current data first
railway run python manage.py dumpdata > backup.json
```

---

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry error tracking DSN | - |
| `SLACK_WEBHOOK_URL` | Slack alerts webhook | - |
| `MAINTENANCE_MODE` | Enable maintenance mode | false |
| `MAINTENANCE_BYPASS_IPS` | IPs that bypass maintenance | - |
| `GEO_RESTRICTION_ENABLED` | Enable US-only restriction | false |
| `OFAC_SCREENING_ENABLED` | Enable OFAC screening | false |
| `GUNICORN_WORKERS` | Number of web workers | 2 |
| `GUNICORN_THREADS` | Threads per worker | 1 |
| `GUNICORN_TIMEOUT` | Request timeout (seconds) | 120 |

---

## Contact Information

- **Railway Support:** https://railway.app/help
- **Stripe Support:** https://support.stripe.com/
- **Bridge.xyz Support:** support@bridge.xyz
- **Solana Status:** https://status.solana.com/

---

## Incident Report Template

```markdown
## Incident Report: [TITLE]

**Date:** YYYY-MM-DD
**Duration:** X hours Y minutes
**Severity:** Critical/High/Medium/Low
**Affected Services:** [List services]

### Summary
Brief description of what happened.

### Timeline
- HH:MM - First alert received
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

### Root Cause
Detailed explanation of what caused the incident.

### Resolution
What was done to fix the issue.

### Preventive Measures
What will be done to prevent recurrence.

### Lessons Learned
Key takeaways from this incident.
```
