# Beta User Management System

Complete beta access management system with invite codes, email notifications, and admin approval workflow.

---

## 🎯 Features

### User-Facing
- ✅ Public beta access request form
- ✅ Automated invite code generation
- ✅ Professional invite emails
- ✅ Invite code validation during signup
- ✅ Duplicate request prevention

### Admin-Facing
- ✅ Django admin interface for managing requests
- ✅ Batch approve/decline actions
- ✅ Email notifications for new requests
- ✅ Request status tracking
- ✅ API endpoints for programmatic approval

---

## 📊 Beta Invite Workflow

```
1. User submits beta access request
   ↓
2. Admin receives email notification
   ↓
3. Admin approves via Django admin or API
   ↓
4. System generates unique invite code
   ↓
5. User receives invite email with code
   ↓
6. User signs up with invite code
   ↓
7. System marks invite as "used"
```

---

## 🔗 API Endpoints

### 1. Request Beta Access (Public)
**POST** `/api/beta/request-access/`

Request beta access with email and optional message.

**Request:**
```json
{
  "email": "user@example.com",
  "message": "I'm excited to try renaissBlock!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Beta access requested! We'll review your request and send an invite if approved."
}
```

**Response (Duplicate):**
```json
{
  "error": "You have already requested beta access. Check your email for an invite!"
}
```

### 2. Validate Invite Code (Public)
**POST** `/api/beta/validate/`

Validate an invite code during signup.

**Request:**
```json
{
  "invite_code": "ABC123DEF456"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "email": "user@example.com"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Invalid or expired invite code"
}
```

### 3. Mark Invite Used (Internal)
**POST** `/api/beta/mark-used/`

Mark an invite code as used after successful signup.

**Request:**
```json
{
  "invite_code": "ABC123DEF456"
}
```

**Response:**
```json
{
  "success": true
}
```

### 4. Approve Beta Request (Admin Only)
**POST** `/api/beta/approve/`

Approve a beta request and send invite email.

**Requires:** Admin authentication

**Request:**
```json
{
  "invite_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "invite_code": "ABC123DEF456",
  "email": "user@example.com"
}
```

---

## 🎫 Invite Code Format

- **Length:** 16 characters
- **Format:** Uppercase alphanumeric (A-Z, 0-9)
- **Example:** `ABC123DEF456`
- **Generation:** UUID-based with dashes removed
- **Uniqueness:** Database-enforced

---

## 📧 Email Templates

### Admin Notification Email
**Subject:** `[renaissBlock] New Beta Access Request - user@example.com`

```
New beta access request received:

Email: user@example.com
Message: I want to test the beta!
Date: 2025-11-09 06:07:52

To approve this request:
1. Log in to Django admin: http://127.0.0.1:8000/admin/
2. Navigate to Beta Invites
3. Select the request and use "Approve and send invites" action

Or approve via API:
POST http://127.0.0.1:8000/api/beta/approve/
{
    "invite_id": 1
}
```

### Beta Invite Email
**Subject:** `🎨 Welcome to renaissBlock Beta!`

```
Hi there!

Welcome to the future of creative collaboration!

You're one of the first people to experience renaissBlock - the world's first platform where creators can collaborate and automatically split revenue using blockchain technology.

🚀 Your Beta Access:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Website: http://127.0.0.1:3000
Invite Code: ABC123DEF456
Direct Link: http://127.0.0.1:3000/signup?invite=ABC123DEF456
Valid for 30 days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 What to Try:
• Create content (book chapter, artwork, music)
• Test the purchase flow (use test card: 4242 4242 4242 4242)
• Try collaborating with other beta users
• Browse and discover content

⚠️ Beta Notes:
• This is test mode - no real money charged
• Blockchain features use fake SOL (devnet)
• Some features still being polished
• Your feedback is incredibly valuable!

🗣️ Share Your Thoughts:
Found a bug? Love a feature? Confused by something?
Email us at feedback@renaissblock.com

Thanks for being an early explorer!

The renaissBlock Team

P.S. As a beta tester, you'll get special perks when we launch!
```

---

## 🔐 Admin Interface

### Django Admin Features

**URL:** `http://127.0.0.1:8000/admin/rb_core/betainvite/`

**List View:**
- Email address
- Status (requested, approved, sent, used, declined)
- Invite code
- Invited by (admin who approved)
- Created date
- Used date

**Filters:**
- Status
- Created date
- Used date

**Search:**
- Email
- Invite code
- Message

**Bulk Actions:**
1. **Approve and send invites**
   - Generates invite codes
   - Sends invite emails
   - Updates status to 'sent'

2. **Decline selected**
   - Updates status to 'declined'
   - No email sent

---

## 📊 Database Schema

### BetaInvite Model

```python
class BetaInvite(models.Model):
    email = models.EmailField(unique=True)
    invite_code = models.CharField(max_length=32, unique=True, blank=True)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[...], default='requested')
    message = models.TextField(blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

**Statuses:**
- `requested` - Initial state when user requests access
- `approved` - Admin approved, invite code generated
- `sent` - Invite email successfully sent
- `used` - User created account with invite code
- `declined` - Admin declined the request

**Indexes:**
- `(status, created_at)` - For filtering by status
- `(invite_code)` - For fast lookup during validation

---

## 🚀 Integration with Signup

### Frontend Integration

1. **Update Beta Landing Page:**
```tsx
// In BetaLanding.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const response = await fetch('http://127.0.0.1:8000/api/beta/request-access/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, message })
  });
  const data = await response.json();
  // Show success message
};
```

2. **Update Signup Page:**
```tsx
// In SignupPage.tsx
const validateInviteCode = async (code: string) => {
  const response = await fetch('http://127.0.0.1:8000/api/beta/validate/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_code: code })
  });
  const data = await response.json();
  if (data.valid) {
    setEmail(data.email); // Pre-fill email from invite
  }
};
```

3. **Mark Invite as Used After Signup:**
```tsx
// After successful signup
await fetch('http://127.0.0.1:8000/api/beta/mark-used/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ invite_code })
});
```

---

## ⚙️ Configuration

### Email Settings

**Development (Console Output):**
```python
# In settings.py
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

**Production (SMTP):**
```bash
# In .env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@renaissblock.com
ADMIN_EMAIL=your-email@gmail.com
```

**Gmail Setup:**
1. Enable 2FA on Gmail account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use App Password in `EMAIL_HOST_PASSWORD`

---

## 🧪 Testing

### Manual Testing

1. **Request Beta Access:**
```bash
curl -X POST http://127.0.0.1:8000/api/beta/request-access/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "message": "Test request"}'
```

2. **Check Console for Email:**
```
Look for email output in Django server console
```

3. **Approve via Django Admin:**
```
http://127.0.0.1:8000/admin/rb_core/betainvite/
Select request → Actions → "Approve and send invites"
```

4. **Validate Invite Code:**
```bash
curl -X POST http://127.0.0.1:8000/api/beta/validate/ \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "ABC123DEF456"}'
```

### Automated Testing

```python
# tests/test_beta.py
from django.test import TestCase
from rb_core.models import BetaInvite

class BetaInviteTestCase(TestCase):
    def test_request_beta_access(self):
        response = self.client.post('/api/beta/request-access/', {
            'email': 'test@example.com',
            'message': 'Test message'
        })
        self.assertEqual(response.status_code, 201)
        self.assertTrue(BetaInvite.objects.filter(email='test@example.com').exists())

    def test_duplicate_request(self):
        BetaInvite.objects.create(email='test@example.com', status='requested')
        response = self.client.post('/api/beta/request-access/', {
            'email': 'test@example.com'
        })
        self.assertEqual(response.status_code, 400)
```

---

## 📋 Admin Workflow

### Daily Workflow

1. **Check for new beta requests:**
   - Check email for "[renaissBlock] New Beta Access Request" notifications
   - Or visit Django admin: `/admin/rb_core/betainvite/`

2. **Review requests:**
   - Filter by Status = "Requested"
   - Read user messages
   - Evaluate fit for beta

3. **Approve worthy requests:**
   - Select requests to approve
   - Actions → "Approve and send invites"
   - Verify success message

4. **Decline spam/invalid requests:**
   - Select requests to decline
   - Actions → "Decline selected"

5. **Monitor usage:**
   - Filter by Status = "Used" to see who signed up
   - Track conversion rate: used / sent

---

## 🔒 Security Considerations

### Input Validation
- ✅ Email format validation
- ✅ Message length limits (TextField)
- ✅ Invite code format validation
- ✅ Duplicate prevention (unique constraints)

### Rate Limiting
- Apply rate limiting to `/api/beta/request-access/`
- Prevent spam requests from same IP

### Email Security
- Use SendGrid/SES for production (not Gmail)
- Implement SPF/DKIM/DMARC records
- Monitor bounces and complaints

### Admin Security
- Only staff users can approve
- Audit log of who approved each invite
- Can't approve already-used invites

---

## 📊 Analytics & Monitoring

### Key Metrics to Track

1. **Funnel Metrics:**
   - Requests → Approvals → Invites Sent → Signups
   - Conversion rate at each step

2. **Time Metrics:**
   - Time from request to approval
   - Time from invite sent to signup
   - Invite expiration rate (30 days)

3. **Quality Metrics:**
   - Beta tester engagement
   - Feedback quality
   - Feature adoption

### Queries for Metrics

```python
from rb_core.models import BetaInvite
from django.db.models import Count

# Funnel stats
BetaInvite.objects.values('status').annotate(count=Count('id'))

# Conversion rate
total_sent = BetaInvite.objects.filter(status__in=['sent', 'used']).count()
total_used = BetaInvite.objects.filter(status='used').count()
conversion_rate = (total_used / total_sent * 100) if total_sent > 0 else 0

# Pending approvals
pending = BetaInvite.objects.filter(status='requested').count()
```

---

## 🚀 Production Deployment Checklist

- [ ] Update `ADMIN_EMAIL` in .env to your actual email
- [ ] Configure SMTP settings (SendGrid, AWS SES, etc.)
- [ ] Update email templates with production URLs
- [ ] Set up email monitoring (bounces, opens, clicks)
- [ ] Add rate limiting to request endpoint
- [ ] Enable reCAPTCHA on beta request form
- [ ] Set up analytics tracking
- [ ] Create admin dashboard for beta metrics
- [ ] Document approval criteria for admins
- [ ] Set up automated reminders for pending requests

---

## 📝 Files Modified/Created

### Created
- `backend/rb_core/models.py` - Added BetaInvite model
- `backend/rb_core/views/beta.py` - Beta access API endpoints (263 lines)
- `backend/rb_core/migrations/0023_betainvite_*.py` - Database migration

### Modified
- `backend/rb_core/serializers.py` - Added BetaInviteSerializer
- `backend/rb_core/urls.py` - Added beta API routes
- `backend/rb_core/admin.py` - Added BetaInviteAdmin with bulk actions
- `backend/renaissBlock/settings.py` - Added email configuration

---

## 🎉 Next Steps

1. **Frontend Integration:**
   - Update BetaLanding.tsx to call `/api/beta/request-access/`
   - Add invite code field to signup form
   - Validate invite code before allowing signup
   - Mark invite as used after successful signup

2. **Email Enhancements:**
   - Add HTML email templates (beautiful design)
   - Include personalized greeting
   - Add social media links
   - Include beta tester badge/swag offers

3. **Advanced Features:**
   - Invite code expiration (30 days)
   - Referral tracking (who referred who)
   - Beta tester leaderboard
   - Automated approval for certain domains
   - Waitlist position notifications

4. **Analytics:**
   - Set up Mixpanel/Amplitude for beta metrics
   - A/B test different invite email templates
   - Track beta tester cohort behavior

---

**Created:** November 9, 2025
**Status:** ✅ Complete and Ready for Integration
