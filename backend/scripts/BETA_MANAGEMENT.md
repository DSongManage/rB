# Beta User Management Guide

Quick reference for managing beta invites and users.

## 🚀 Quick Start

### Method 1: Django Management Command (Recommended)

```bash
cd backend
source ../venv/bin/activate  # Activate virtual environment

# List all invites
python manage.py beta list

# Show statistics
python manage.py beta stats

# List pending requests
python manage.py beta pending

# Create direct invite (skip request)
python manage.py beta invite friend@example.com

# Approve pending request
python manage.py beta approve user@example.com
```

### Method 2: Standalone Script

```bash
cd backend
source ../venv/bin/activate

# List all invites
python scripts/manage_beta.py list

# List pending requests
python scripts/manage_beta.py pending

# Create direct invite
python scripts/manage_beta.py invite friend@example.com

# Approve pending request
python scripts/manage_beta.py approve user@example.com
```

### Method 3: Django Shell (Advanced)

```bash
cd backend
source ../venv/bin/activate
python manage.py shell
```

```python
from rb_core.models import BetaInvite
from django.core.mail import send_mail
from django.conf import settings

# List all invites
for invite in BetaInvite.objects.all():
    print(f"{invite.email} - {invite.status} - {invite.invite_code}")

# Create direct invite
invite = BetaInvite.objects.create(
    email='friend@example.com',
    status='approved'
)
invite.generate_invite_code()
invite.save()
print(f"Invite code: {invite.invite_code}")

# Approve pending request
invite = BetaInvite.objects.get(email='user@example.com', status='requested')
invite.generate_invite_code()
invite.status = 'approved'
invite.save()

# Get stats
total = BetaInvite.objects.count()
requested = BetaInvite.objects.filter(status='requested').count()
approved = BetaInvite.objects.filter(status='approved').count()
used = BetaInvite.objects.filter(status='used').count()
print(f"Total: {total}, Requested: {requested}, Approved: {approved}, Used: {used}")
```

---

## 📋 Common Tasks

### Inviting Your First Beta Testers

```bash
# Invite friends directly (no request needed)
python manage.py beta invite friend1@example.com
python manage.py beta invite friend2@example.com
python manage.py beta invite friend3@example.com

# Check status
python manage.py beta list
```

### Processing Beta Requests from Landing Page

```bash
# See who's requesting access
python manage.py beta pending

# Approve specific users
python manage.py beta approve interested@example.com

# Or approve multiple in shell
python manage.py shell
```

```python
from rb_core.models import BetaInvite

# Approve all pending requests
pending = BetaInvite.objects.filter(status='requested')
for invite in pending:
    invite.generate_invite_code()
    invite.status = 'approved'
    invite.save()
    print(f"Approved: {invite.email} - {invite.invite_code}")
```

### Monitoring Beta Program

```bash
# See statistics
python manage.py beta stats

# Output:
# 📊 Beta Program Statistics
# ==================================================
# Total Invites:     25
# Pending Requests:  5
# Approved (unused): 10
# Registered Users:  10
# ==================================================
# Conversion Rate:   40.0%
```

---

## 🔧 Configuration

### Email Settings

Make sure these are set in your `.env` file:

```bash
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
DEFAULT_FROM_EMAIL=beta@renaissblock.com
```

### Frontend URL

The invite emails include a registration link:

```bash
FRONTEND_URL=https://renaissblock.com
```

---

## 📧 Email Template

When you send an invite, users receive:

- **Subject:** Welcome to renaissBlock Beta!
- **Content:**
  - Personalized invite code
  - Direct registration link
  - Platform overview
  - Beta testing disclaimers
  - Feedback instructions

---

## 🎯 Beta Invite Workflow

```
1. User Submits Beta Request
   └─> Landing page form
   └─> Stored with status='requested'

2. You Review Request
   └─> python manage.py beta pending
   └─> Review messages and emails

3. You Approve Request
   └─> python manage.py beta approve email@example.com
   └─> Invite code generated
   └─> Email sent automatically
   └─> Status changed to 'approved'

4. User Registers
   └─> Enters invite code
   └─> Account created
   └─> Status changed to 'used'
```

---

## 🛠️ Troubleshooting

### Emails Not Sending

1. Check SMTP settings in `.env`
2. For Gmail, create an [App Password](https://myaccount.google.com/apppasswords)
3. Test email manually:

```python
from django.core.mail import send_mail

send_mail(
    'Test Email',
    'Testing SMTP settings',
    'beta@renaissblock.com',
    ['your-email@example.com'],
    fail_silently=False,
)
```

### Invite Code Not Working

1. Check code was generated:
   ```bash
   python manage.py beta list
   ```
2. Verify status is 'approved' not 'used'
3. Code format should be: `XXXX-XXXX-XXXX` (12 chars with dashes)

### Production Deployment

For Railway, you can run commands via SSH or Railway CLI:

```bash
# Using Railway CLI
railway run python manage.py beta invite user@example.com

# Or SSH into container
railway connect
python manage.py beta list
```

---

## 📊 Beta Program Best Practices

1. **Start Small**: Invite 5-10 users initially
2. **Iterate**: Get feedback, fix issues, invite more
3. **Engage**: Follow up with beta testers regularly
4. **Track**: Monitor stats and conversion rates
5. **Reward**: Thank early testers (special recognition, perks, etc.)

---

## 🎉 Launch Day Checklist

- [ ] Test email sending works
- [ ] Invite 5-10 close friends/colleagues
- [ ] Monitor for registration issues
- [ ] Check feedback submissions
- [ ] Respond to questions quickly
- [ ] Fix critical bugs ASAP
- [ ] Gradually expand beta cohort

---

**Need Help?**

- Check Django logs: `tail -f backend/logs/django.log`
- Email issues: Test SMTP settings
- Database issues: `python manage.py dbshell`

Happy beta testing! 🚀
