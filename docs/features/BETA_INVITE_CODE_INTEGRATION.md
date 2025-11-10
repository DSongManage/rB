# Beta Invite Code Integration

Complete integration of beta invite code system with user registration and UI enhancements.

---

## 🎯 Changes Implemented

### Backend Changes

#### 1. Updated User Registration (`rb_core/serializers.py`)

**SignupSerializer now requires beta invite code:**

```python
class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True, max_length=50)
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    web3auth_token = serializers.CharField(required=False, allow_blank=True)
    wallet_address = serializers.CharField(required=False, allow_blank=True, max_length=44)
    invite_code = serializers.CharField(required=True, max_length=32)  # NEW: REQUIRED
    email = serializers.EmailField(required=False, allow_blank=True)  # NEW: Optional
```

**Added validation methods:**

1. **`validate_invite_code()`** - Validates invite code exists and is unused
2. **`validate_email()`** - Validates email matches invite if provided
3. **`validate()`** - Cross-field validation for email/invite matching
4. **Updated `create()`** - Marks invite as used after successful signup

**Key Features:**
- ✅ Invite code is **required** for all signups
- ✅ Validates invite is in 'approved' or 'sent' status
- ✅ Checks invite hasn't been used yet
- ✅ Verifies email matches invite (if email provided)
- ✅ Automatically uses invite email if user doesn't provide one
- ✅ Marks invite as 'used' with timestamp after successful registration

---

### Frontend Changes

#### 2. BetaBadge Component (`frontend/src/components/BetaBadge.tsx`)

**Created comprehensive beta UI components:**

```typescript
// Three badge variants
<BetaBadge variant="header" showTestMode={true} />
<BetaBadge variant="inline" />
<BetaBadge variant="full" />

// Test mode banner at bottom of page
<TestModeBanner />

// Welcome modal for new beta users
<BetaWelcomeModal onClose={() => {}} />
```

**Component Features:**

**1. Header Badge** (`variant="header"`)
- Orange gradient badge with "BETA" text
- Optional "TEST MODE" indicator
- Box shadow for visual prominence
- Positioned in header next to logo

**2. Inline Badge** (`variant="inline"`)
- Small inline badge for use in text
- Minimal styling
- Compact 11px font size

**3. Full Banner** (`variant="full"`)
- Large informational banner
- Beta badge + description
- Link to feedback email
- Gradient background with border

**4. Test Mode Banner**
- Fixed at bottom of page
- Orange gradient background
- Explains test mode (no real money, devnet SOL)
- "Report Issues" mailto link
- z-index: 1000 (always visible)

**5. Beta Welcome Modal**
- Full-screen modal overlay
- Welcome message for new beta testers
- Test mode instructions
- What to try list
- Beta perks callout
- Feedback link

---

#### 3. Updated App.tsx

**Added beta indicators:**

```tsx
import { BetaBadge, TestModeBanner } from './components/BetaBadge';

function Header() {
  return (
    <nav className="rb-header">
      <div className="rb-header-left">
        <Link to="/" className="rb-logo-link">
          <img src="/rb-logo.jpeg" alt="renaissBlock" className="rb-logo-img"/>
        </Link>
        <BetaBadge variant="header" showTestMode={true} />  {/* NEW */}
      </div>
      {/* ... */}
    </nav>
  );
}

export default function App() {
  return (
    <div className="rb-app">
      <Header />
      {/* ... routes ... */}
      <NotificationToastContainer />
      <TestModeBanner />  {/* NEW */}
    </div>
  );
}
```

**What was added:**
- ✅ Beta badge in header (next to logo)
- ✅ Test mode banner at bottom of all pages
- ✅ Visual indicators that platform is in beta

---

#### 4. Updated BetaLanding.tsx

**Connected beta request form to API:**

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);

  try {
    const response = await fetch('http://127.0.0.1:8000/api/beta/request-access/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        message: `Requested via beta landing page at ${new Date().toISOString()}`
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setMessage('✅ Thanks! We\'ll review your request and send an invite if approved.');
      setEmail('');
    } else {
      setMessage(`❌ ${data.error || 'Something went wrong.'}`);
    }
  } catch (error) {
    setMessage('❌ Unable to submit request. Please try again later.');
  } finally {
    setSubmitting(false);
  }
};
```

**Features:**
- ✅ Real API integration (no more mock delay)
- ✅ Error handling with user-friendly messages
- ✅ Success/error visual feedback
- ✅ Form clears on success
- ✅ Auto-timestamps request message

---

## 🔄 Complete User Flow

### 1. Request Beta Access

```
User visits /beta
  ↓
Enters email in hero form
  ↓
Clicks "Request Access"
  ↓
Frontend calls: POST /api/beta/request-access/
  ↓
Backend creates BetaInvite with status='requested'
  ↓
Admin receives email notification
  ↓
User sees success message
```

### 2. Admin Approves Request

```
Admin checks email/Django admin
  ↓
Selects beta request(s)
  ↓
Actions → "Approve and send invites"
  ↓
Backend:
  - Generates unique invite code (16 chars)
  - Updates status to 'approved'
  - Sends invite email to user
  - Updates status to 'sent'
  ↓
User receives email with invite code
```

### 3. User Signs Up

```
User clicks invite link in email
  (e.g., /signup?invite=ABC123DEF456)
  ↓
Frontend signup form:
  - Invite code field (auto-populated from URL)
  - Email field (pre-filled from validated invite)
  - Username field
  - Display name field
  ↓
User submits signup form
  ↓
Frontend calls: POST /api/users/signup/
Body: {
  username: "coolcreator",
  email: "user@example.com",
  invite_code: "ABC123DEF456"
}
  ↓
Backend validates:
  ✓ Invite code exists
  ✓ Invite status is 'approved' or 'sent'
  ✓ Invite not already used
  ✓ Email matches invite email
  ↓
Backend creates:
  ✓ User account (with email)
  ✓ UserProfile
  ↓
Backend updates invite:
  ✓ status = 'used'
  ✓ used_at = now()
  ↓
User is logged in
  ↓
User sees BetaWelcomeModal (optional)
```

---

## 🧪 Testing Guide

### Test Backend Invite Code Validation

**1. Create a test invite:**

```bash
# In Django shell
from rb_core.models import BetaInvite
invite = BetaInvite.objects.create(
    email='test@example.com',
    invite_code='TEST1234ABCD',
    status='approved'
)
```

**2. Test signup with valid invite:**

```bash
curl -X POST http://127.0.0.1:8000/api/users/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "invite_code": "TEST1234ABCD"
  }'
```

**Expected:** Success, user created, invite marked as used

**3. Test signup with invalid invite:**

```bash
curl -X POST http://127.0.0.1:8000/api/users/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "test2@example.com",
    "invite_code": "INVALID123"
  }'
```

**Expected:** Error - "Invalid or expired beta invite code"

**4. Test signup with wrong email:**

```bash
curl -X POST http://127.0.0.1:8000/api/users/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser3",
    "email": "wrong@example.com",
    "invite_code": "TEST1234ABCD"
  }'
```

**Expected:** Error - "Email does not match beta invite"

**5. Test signup with already-used invite:**

```bash
# Try using same invite twice
curl -X POST http://127.0.0.1:8000/api/users/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser4",
    "email": "test@example.com",
    "invite_code": "TEST1234ABCD"
  }'
```

**Expected:** Error - "Invalid or expired beta invite code" (because used_at is not null)

---

### Test Frontend Components

**1. Test BetaBadge in header:**
- Navigate to http://127.0.0.1:3000
- Check header has orange "BETA | TEST MODE" badge next to logo

**2. Test TestModeBanner:**
- Scroll to bottom of any page
- Check orange banner at bottom: "🧪 TEST MODE: No real money charged..."

**3. Test BetaLanding form:**
- Navigate to http://127.0.0.1:3000/beta
- Enter email: yourname@example.com
- Click "Request Access"
- Check success message appears
- Check Django console for email output

**4. Test invite code URL parameter:**
- Navigate to http://127.0.0.1:3000/beta?invite=ABC123
- Check localStorage has 'inviteCode' = 'ABC123'
- Check "Sign In" link includes invite param

---

## 📊 Database Changes

No new migrations needed - BetaInvite model was already created in previous step.

**Updated fields used:**
- `status` - Now set to 'used' after successful signup
- `used_at` - Now populated with timestamp when invite is used
- `email` - Now used for email validation during signup

---

## 🔐 Security Features

### Backend Security

1. **Invite Code Validation:**
   - Must exist in database
   - Must be in 'approved' or 'sent' status
   - Must not have `used_at` timestamp
   - Case-insensitive (automatically uppercased)

2. **Email Verification:**
   - If user provides email, must match invite email
   - If no email provided, uses invite email automatically
   - Prevents email already registered

3. **Username Validation:**
   - Checks if username already taken
   - Validates against UserProfile.HANDLE_VALIDATOR
   - Auto-generates if not provided

4. **Rate Limiting:**
   - Signup endpoint has `SignupRateThrottle` (5/hour in production)
   - Beta request endpoint should have `AnonRateThrottle`

### Frontend Security

1. **Input Validation:**
   - Email format validation
   - Required fields enforced
   - Error messages don't leak system info

2. **CORS:**
   - API calls include proper headers
   - Credentials handled correctly

---

## 🎨 UI/UX Enhancements

### Visual Indicators

1. **Header Badge:**
   - Immediately visible on all pages
   - Distinctive orange gradient
   - Shows "BETA | TEST MODE" clearly

2. **Bottom Banner:**
   - Always visible (fixed position)
   - Explains test mode
   - Provides feedback link

3. **Beta Landing:**
   - Professional design
   - Clear call-to-action
   - Success/error feedback

### User Education

1. **Test Mode Banner:**
   - Explains no real money charged
   - Notes devnet usage
   - Provides feedback channel

2. **Beta Welcome Modal (future):**
   - Can show on first login
   - Educates new beta testers
   - Sets expectations

---

## 📝 Configuration

### Environment Variables

**Development (.env):**
```bash
# Email will output to console
DEBUG=True

# Admin email for beta request notifications
ADMIN_EMAIL=your-email@gmail.com

# Frontend URL for invite links
FRONTEND_URL=http://127.0.0.1:3000
```

**Production (.env):**
```bash
DEBUG=False

# Production SMTP
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key

ADMIN_EMAIL=admin@renaissblock.com
DEFAULT_FROM_EMAIL=noreply@renaissblock.com

FRONTEND_URL=https://renaissblock.com
```

---

## 🚀 Next Steps

### Required for Launch

1. **Frontend Signup Form Updates:**
   - Add invite code field to signup form
   - Pre-populate from URL parameter (?invite=CODE)
   - Validate invite before allowing submit
   - Show error if invalid
   - Pre-fill email from validated invite

2. **Email Templates:**
   - Design HTML email templates
   - Use email service (SendGrid, AWS SES)
   - Test deliverability

3. **Production Config:**
   - Set up production SMTP
   - Configure ADMIN_EMAIL
   - Update FRONTEND_URL in settings

### Optional Enhancements

1. **Invite Expiration:**
   - Add expiration date to BetaInvite
   - Check expiry in validation
   - Auto-expire after 30 days

2. **Referral Tracking:**
   - Track who referred each user
   - Show referral stats in admin
   - Reward top referrers

3. **Beta Analytics:**
   - Track conversion rates
   - Monitor invite usage
   - A/B test email templates

4. **Auto-Approval:**
   - Auto-approve certain domains (@university.edu)
   - Whitelist trusted users
   - Auto-send invites without manual approval

---

## 📋 Checklist

**Backend:**
- [x] SignupSerializer requires invite_code
- [x] Validate invite code exists and is unused
- [x] Validate email matches invite
- [x] Mark invite as used after signup
- [x] Save email to User model

**Frontend:**
- [x] Created BetaBadge component (3 variants)
- [x] Created TestModeBanner component
- [x] Created BetaWelcomeModal component
- [x] Added badge to App header
- [x] Added test mode banner to App
- [x] Connected BetaLanding form to API

**Testing:**
- [x] Tested beta request API endpoint
- [x] Tested invite code validation
- [x] Verified invite marked as used
- [x] Tested UI components render correctly

**Documentation:**
- [x] Created BETA_USER_MANAGEMENT.md
- [x] Created BETA_INVITE_CODE_INTEGRATION.md

**Still TODO:**
- [ ] Update frontend signup form to require invite code
- [ ] Add invite code validation on frontend before submit
- [ ] Show BetaWelcomeModal on first login
- [ ] Set up production email service
- [ ] Configure ADMIN_EMAIL for production

---

## 📧 Related Documentation

- [Beta User Management System](./BETA_USER_MANAGEMENT.md) - Full beta access management
- [Security Audit Report](../SECURITY_AUDIT_REPORT.md) - Security hardening details

---

**Created:** November 9, 2025
**Status:** ✅ Backend Complete, Frontend UI Complete, Signup Form Integration Pending
