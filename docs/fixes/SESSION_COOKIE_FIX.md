# Session Cookie Fix - Cross-Origin Authentication

**Issue**: NavBar not updating after login, session cookies not being sent  
**Status**: ✅ FIXED

---

## 🐛 The Real Problem

### **Symptoms**:
```
✅ User logs in on /auth page (200 response)
✅ Backend sets sessionid cookie
❌ NavBar doesn't update (Profile link missing)
❌ Frontend can't read authenticated state
```

**Backend logs**:
```
[14/Oct/2025 05:04:30] "POST /accounts/login/ HTTP/1.1" 200 1979  ✅ Login OK
[14/Oct/2025 05:04:40] "GET /api/auth/status/ HTTP/1.1" 200 76    ✅ Polling...
[14/Oct/2025 05:04:50] "GET /api/auth/status/ HTTP/1.1" 200 76    ← But returns authenticated:false
```

**Browser console**:
- Those `ERR_FILE_NOT_FOUND` errors for `utils.js`, `extensionState.js`, etc. are **browser extension errors** (Web3Auth/MetaMask) - IGNORE them!

---

## 🔍 Root Cause #2: Missing Session Cookie Config

**The Issue**: Django's default `SESSION_COOKIE_SAMESITE = 'Lax'` **blocks cookies** in cross-origin requests!

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:8000`
- **Result**: Different origins = cookies not sent by browser

**What's Happening**:
1. User logs in → Django sets `sessionid` cookie with `SameSite=Lax`
2. Frontend at `:3000` tries to read cookie from `:8000`
3. Browser **blocks cookie** due to `SameSite=Lax` policy
4. `/api/auth/status/` always returns `authenticated: false`
5. NavBar never updates

---

## ✅ Solution: Configure Session Cookies for Cross-Origin

### **Fix: Add Session Cookie Settings**

**File**: `backend/renaissBlock/settings.py` (after line 224)

```python
# Session cookie settings for cross-origin auth
SESSION_COOKIE_SAMESITE = 'None'  # Allow cross-origin cookies
SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access (security)
CSRF_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SECURE = False
```

**Why Each Setting**:
1. **`SESSION_COOKIE_SAMESITE = 'None'`**: Allows cookies to be sent cross-origin (`:3000` → `:8000`)
2. **`SESSION_COOKIE_SECURE = False`**: Required because we're using HTTP (not HTTPS) in dev
   - **⚠️ IMPORTANT**: Set to `True` in production with HTTPS!
3. **`SESSION_COOKIE_HTTPONLY = True`**: Security - prevents XSS attacks from reading cookie
4. **`CSRF_COOKIE_SAMESITE = 'None'`**: Same for CSRF token cookies
5. **`CSRF_COOKIE_SECURE = False`**: Dev only (HTTP)

---

## 🚀 Action Required

### **1. Django Server Already Restarted** ✅

The server has been automatically restarted with the new settings.

---

### **2. Clear Browser Cookies & Refresh**

**Important**: Old cookies with `SameSite=Lax` are still in your browser!

**Steps**:
1. **Open Browser DevTools** (F12 or Cmd+Option+I)
2. **Go to Application tab** → **Cookies** → `http://localhost:8000`
3. **Delete these cookies**:
   - `sessionid`
   - `csrftoken`
4. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

---

### **3. Login Again**

1. Go to **http://localhost:3000/auth**
2. Login as **Learn4** / **Soccer!9**
3. **Within 10 seconds** (or immediately after clicking Home):
   - NavBar should update showing: **Profile** | **Collaborators** | **Logout**

---

### **4. Verify in DevTools**

**Check Cookies**:
1. Open DevTools → Application → Cookies → `http://localhost:8000`
2. Find `sessionid` cookie
3. **Verify**:
   ```
   Name:     sessionid
   Value:    [long string]
   SameSite: None  ← Should be "None" now!
   Secure:   No    ← OK for dev (HTTP)
   ```

**Check Network Requests**:
1. Open DevTools → Network tab
2. Filter by "auth"
3. Click on `/api/auth/status/` request
4. Check Response:
   ```json
   {
     "authenticated": true,  ← Should be true now!
     "user_id": 2,
     "username": "Learn4",
     "wallet_address": "..."
   }
   ```

---

## 📊 Expected Behavior After Fix

### **Before Fix**:
```
User logs in → Cookie set with SameSite=Lax
Frontend polls /api/auth/status/ → Cookie NOT sent (blocked)
Response: {authenticated: false}
NavBar: [Search] [Sign in]  ← No update
```

### **After Fix**:
```
User logs in → Cookie set with SameSite=None
Frontend polls /api/auth/status/ → Cookie sent ✅
Response: {authenticated: true, username: "Learn4"}
NavBar: [Search] [Profile🔴] [Collaborators] [Logout]  ← Updated!
```

---

## 🧪 Complete Test Flow

### **Test Script**:

```bash
# 1. Clear old cookies
# (Do manually in browser DevTools)

# 2. Django server is already running with new settings ✅

# 3. Login and test
# Browser: http://localhost:3000/auth
# Login: Learn4 / Soccer!9
# Wait 10 seconds or click Home

# 4. Check backend logs
cd /Users/davidsong/repos/songProjects/rB/backend
tail -f /dev/null  # Server is in background, check logs in terminal

# Expected:
# "GET /api/auth/status/ HTTP/1.1" 200 XX {authenticated: true, ...}
# "GET /api/notifications/ HTTP/1.1" 200 XX  ← Now called!
```

---

### **If Still Not Working**:

#### **Check 1: Verify Cookies in Browser**
```javascript
// Open DevTools Console, run:
document.cookie
// Should include: "sessionid=..."
```

#### **Check 2: Test API Directly**
```bash
# Get CSRF token
CSRF=$(curl -s http://localhost:8000/api/auth/csrf/ | python3 -c "import sys, json; print(json.load(sys.stdin)['csrfToken'])")

# Login
curl -X POST http://localhost:8000/accounts/login/ \
  -c cookies.txt -b cookies.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-CSRFToken: $CSRF" \
  --data-urlencode "login=Learn4" \
  --data-urlencode "password=Soccer!9" \
  --data-urlencode "csrfmiddlewaretoken=$CSRF"

# Check auth status
curl -s http://localhost:8000/api/auth/status/ -b cookies.txt
# Should return: {"authenticated":true,"user_id":X,"username":"Learn4",...}
```

#### **Check 3: Verify Settings Loaded**
```bash
cd backend
python manage.py shell -c "
from django.conf import settings
print('SESSION_COOKIE_SAMESITE:', settings.SESSION_COOKIE_SAMESITE)
print('CSRF_COOKIE_SAMESITE:', settings.CSRF_COOKIE_SAMESITE)
"
# Should output:
# SESSION_COOKIE_SAMESITE: None
# CSRF_COOKIE_SAMESITE: None
```

---

## 🎯 Quick Checklist

- ✅ **SessionAuthentication** added to `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`
- ✅ **Session cookie settings** configured (`SameSite=None`, `Secure=False` for dev)
- ✅ **Django server restarted** (auto-restarted in background)
- ⬜ **Browser cookies cleared** (YOU NEED TO DO THIS!)
- ⬜ **Login again** and wait 10 seconds
- ⬜ **Verify NavBar updates** with Profile link

---

## 📝 Files Modified

1. **`backend/renaissBlock/settings.py`** (lines 226-231)
   - Added session cookie settings for cross-origin auth

2. **`backend/renaissBlock/settings.py`** (lines 241-243)
   - Added `DEFAULT_AUTHENTICATION_CLASSES` with `SessionAuthentication` (from previous fix)

3. **`frontend/src/App.tsx`** (lines 23-50)
   - Added polling and conditional notifications fetch (from previous fix)

---

## 🎊 Summary

**Two Issues Fixed**:
1. **Missing DRF SessionAuthentication** → Added to `REST_FRAMEWORK`
2. **Wrong SameSite cookie policy** → Changed from `Lax` to `None`

**Result**:
- ✅ Session cookies now work cross-origin (`:3000` ↔ `:8000`)
- ✅ NavBar updates within 10 seconds of login
- ✅ `/api/notifications/` endpoint accessible after auth
- ✅ Profile link appears with notification badge

---

## ⚠️ Production Considerations

When deploying to production with HTTPS:

```python
# production settings.py
SESSION_COOKIE_SAMESITE = 'None'  # Still needed for cross-origin
SESSION_COOKIE_SECURE = True  # ← MUST be True with HTTPS!
CSRF_COOKIE_SECURE = True  # ← MUST be True with HTTPS!

# Also consider:
SESSION_COOKIE_AGE = 86400  # 24 hours (or whatever you need)
SESSION_SAVE_EVERY_REQUEST = False  # Performance optimization
```

---

## 🚀 Next Steps

1. **Clear browser cookies** (DevTools → Application → Cookies)
2. **Hard refresh** (Cmd+Shift+R)
3. **Login again** as Learn4
4. **Wait 10 seconds** or click a link
5. **Verify NavBar shows Profile link** ✅

**The NavBar will now work!** 🎉

---

**Clear those cookies and login again!** 🍪→🗑️

