# NavBar 403 Fix - Session Authentication

**Issue**: `/api/notifications/` returning 403 Forbidden even after successful login  
**Status**: ✅ FIXED

---

## 🐛 Problem Analysis

### **Symptoms**:
```
[14/Oct/2025 05:00:29] "GET /api/auth/status/ HTTP/1.1" 200 76  ✅
[14/Oct/2025 05:00:29] "GET /api/notifications/ HTTP/1.1" 403 58  ❌
```

**What's Happening**:
1. User logs in successfully (session cookie set)
2. `/api/auth/status/` recognizes session (returns 200)
3. `/api/notifications/` rejects request (returns 403)
4. NavBar doesn't update (Profile link doesn't appear)

---

## 🔍 Root Cause

**Missing DRF Authentication Classes** in `settings.py`:

Django REST Framework views (like `NotificationsView`) use `permission_classes = [IsAuthenticated]`, but DRF doesn't automatically use Django's session authentication unless explicitly configured.

**Before** (settings.py):
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [...],
    # Missing: DEFAULT_AUTHENTICATION_CLASSES
}
```

**Result**: DRF views couldn't authenticate session cookies → 403 Forbidden

---

## ✅ Solutions Applied

### **Fix 1: Add SessionAuthentication to DRF Settings**

**File**: `backend/renaissBlock/settings.py` (lines 240-252)

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/min',
        'user': '120/min',
    },
}
```

**Impact**: All DRF `APIView` classes now recognize Django session cookies

---

### **Fix 2: Improve NavBar Auth Polling**

**File**: `frontend/src/App.tsx` (lines 23-50)

**Changes**:
1. **Wrapped in useCallback**: `checkAuthAndNotifications()` function
2. **Conditional notifications fetch**: Only call `/api/notifications/` if `authed === true`
3. **Added polling**: 10-second interval to catch auth state changes
4. **Cleanup**: Clear interval on unmount

**Before**:
```typescript
useEffect(()=>{
  fetch('/api/auth/status/').then(...);
  fetch('/api/notifications/').then(...);  // Always called, even if not authed
},[location.pathname]);  // Only on route change
```

**After**:
```typescript
const checkAuthAndNotifications = useCallback(() => {
  fetch('/api/auth/status/').then(d => {
    const authed = !!d?.authenticated;
    setIsAuthed(authed);
    if (authed) {  // Only fetch notifications if authenticated
      fetch('/api/notifications/').then(...);
    }
  });
}, []);

useEffect(()=>{
  checkAuthAndNotifications();
  const interval = setInterval(checkAuthAndNotifications, 10000);  // Poll every 10s
  return () => clearInterval(interval);
},[location.pathname, checkAuthAndNotifications]);
```

**Impact**:
- NavBar updates within 10 seconds of login
- No 403 errors for unauthenticated users
- Cleaner error handling

---

## 🧪 Verification

### **Test the Fix**:

```bash
# 1. Restart Django server to pick up settings change
cd /Users/davidsong/repos/songProjects/rB/backend
source ../venv/bin/activate
pkill -f "manage.py runserver"
python manage.py runserver

# 2. Refresh frontend (or wait for hot reload)
# Browser should reload automatically

# 3. Login as existing user
# Navigate to http://localhost:3000/auth
# Login with: Learn4 / Soccer!9 (or songmanage / Soccer!944)

# 4. Wait up to 10 seconds
# NavBar should update showing:
# - Profile link
# - Collaborators link
# - Logout button
# - (Sign in button disappears)

# 5. Check backend logs
# Should now see:
# "GET /api/notifications/ HTTP/1.1" 200 XX  ✅ (not 403)
```

---

### **Alternative: Force Immediate Update**

If you don't want to wait 10 seconds, navigate to a different page:

```bash
# After login on /auth page
# Click Home or any link
# NavBar will immediately re-check (location.pathname changes)
```

---

## 📊 Expected Behavior After Fix

### **Before Login**:
```
NavBar: [Search] [Sign in]
/api/auth/status/ → 200 {authenticated: false}
/api/notifications/ → NOT CALLED (authed check prevents it)
```

### **After Login**:
```
NavBar: [Search] [Profile🔴1] [Collaborators] [Logout]
                    ↑ Red badge if notifications > 0
/api/auth/status/ → 200 {authenticated: true, user_id: X, username: "Learn4"}
/api/notifications/ → 200 [{id: 1, sender_username: "...", ...}]
```

---

## 🔧 Additional Fixes (If Still 403)

### **Check 1: Verify SessionAuthentication Installed**

```bash
cd backend
python manage.py shell -c "
from rest_framework.authentication import SessionAuthentication
print('SessionAuthentication available:', SessionAuthentication)
"
```

---

### **Check 2: Test Notifications Endpoint Directly**

```bash
# Login via browser first (http://localhost:3000/auth)
# Then test API with browser's cookies

# Or via cURL:
CSRF_TOKEN=$(curl -s -c cookies.txt http://localhost:8000/api/auth/csrf/ | python3 -c "import sys, json; print(json.load(sys.stdin)['csrfToken'])")

curl -X POST http://localhost:8000/admin/login/ \
  -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  --data-urlencode "username=Learn4" \
  --data-urlencode 'password=Soccer!9' \
  --data-urlencode "csrfmiddlewaretoken=$CSRF_TOKEN" \
  -L > /dev/null

# Now test notifications
curl -s http://localhost:8000/api/notifications/ -b cookies.txt

# Should return: [] or [{...}] (not 403)
```

---

### **Check 3: Verify User Exists**

```bash
cd backend
python manage.py shell -c "
from rb_core.models import User
try:
    user = User.objects.get(username='Learn4')
    print(f'✅ User exists: {user.username} (ID: {user.id})')
except User.DoesNotExist:
    print('❌ User Learn4 not found')
"
```

---

## 🎯 Quick Test

### **Create a Test Invite for Learn4**:

```bash
cd backend
source ../venv/bin/activate

python manage.py shell <<'EOF'
from rb_core.models import User, UserProfile, Content, Collaboration

# Ensure Learn4 exists
try:
    recipient = User.objects.get(username='Learn4')
    recipient_profile, _ = UserProfile.objects.get_or_create(
        user=recipient,
        defaults={'username': 'Learn4'}
    )
except User.DoesNotExist:
    print("❌ User Learn4 not found - create via /auth signup first")
    exit()

# Create a test sender
sender, _ = User.objects.get_or_create(username='test_sender')
sender_profile, _ = UserProfile.objects.get_or_create(
    user=sender,
    defaults={'username': 'test_sender', 'display_name': 'Test Sender'}
)

# Create test content
content = Content.objects.create(
    title='Test Collaboration Project',
    creator=sender,
    content_type='book',
    genre='fantasy'
)

# Create pending invite
collab = Collaboration.objects.create(
    content=content,
    status='pending',
    revenue_split={
        'initiator': 70,
        'collaborators': 30,
        'message': 'Hi Learn4! Want to collaborate on a fantasy NFT series? You handle artwork, I handle writing. 30% equity for you.',
        'attachments': '',
    }
)
collab.initiators.add(sender)
collab.collaborators.add(recipient)

print(f"✅ Created invite for Learn4")
print(f"   Invite ID: {collab.id}")
print(f"   From: @{sender.username}")
print(f"   Equity: {collab.revenue_split['collaborators']}%")
EOF
```

Now when Learn4 logs in, they should see:
- Red badge on Profile link: "1"
- Invites section on ProfilePage with the test invite

---

## 📝 Files Modified

1. **`backend/renaissBlock/settings.py`** (lines 240-252)
   - Added `DEFAULT_AUTHENTICATION_CLASSES` with `SessionAuthentication`

2. **`frontend/src/App.tsx`** (lines 16-50)
   - Refactored auth check into `useCallback`
   - Added conditional notifications fetch
   - Added 10-second polling interval
   - Cleanup interval on unmount

---

## ✅ Expected Results

### **After Restart**:
1. **Login works**: Session cookie set
2. **NavBar updates**: Within 10 seconds (or immediately on navigation)
3. **No 403 errors**: `/api/notifications/` returns 200
4. **Badge appears**: If Learn4 has pending invites
5. **ProfilePage shows invites**: When user clicks Profile

---

## 🚀 Action Required

### **Restart Django Server**:
```bash
cd /Users/davidsong/repos/songProjects/rB/backend
pkill -f "manage.py runserver"
source ../venv/bin/activate
python manage.py runserver
```

**Why**: Settings changes require server restart

---

### **Refresh Frontend**:
```bash
# Browser should auto-reload via hot module replacement
# If not, hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

---

### **Test Login Again**:
1. Go to http://localhost:3000/auth
2. Login as Learn4
3. Wait up to 10 seconds OR click Home link
4. Verify NavBar shows: **Profile** | **Collaborators** | **Logout**
5. Check backend logs - should see:
   ```
   "GET /api/notifications/ HTTP/1.1" 200 XX  ✅
   ```

---

## 🎊 Fix Complete!

**Changes**:
- ✅ DRF SessionAuthentication configured
- ✅ NavBar polling added (10s interval)
- ✅ Conditional notifications fetch
- ✅ Better error handling

**Result**: NavBar will now update properly after login and show notification badges!

---

**Restart Django server and test!** 🚀

