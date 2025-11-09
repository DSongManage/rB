# CSRF Cookie Cross-Origin Issue - Full Assessment Report

**Date**: October 14, 2025  
**Status**: 🔴 CRITICAL - Login completely broken  
**Impact**: All authentication (Learn4, superuser, songmanage) fails with `403 Forbidden (CSRF cookie not set.)`

---

## 🔍 ROOT CAUSE ANALYSIS

### **The Core Problem: SameSite Cookie Policy**

The issue is a **fundamental browser security restriction** regarding cross-origin cookies:

#### **Current Architecture**:
- **Frontend**: `http://localhost:3000` (React dev server)
- **Backend**: `http://localhost:8000` (Django runserver)
- **Request Flow**: JavaScript `fetch()` from `:3000` → `:8000` (different ports = cross-origin)

#### **Browser Cookie Behavior with `SameSite=Lax`**:

| Request Type | From | To | Cookies Sent? |
|-------------|------|----|--------------| 
| Top-level navigation (link click, form submit) | `:3000` | `:8000` | ✅ YES |
| JavaScript fetch() | `:3000` | `:8000` | ❌ NO |
| iframe | `:3000` → `:8000` | `:8000` | ❌ NO |
| Image/script tag | `:3000` | `:8000` | ❌ NO |

**Current Settings** (`backend/renaissBlock/settings.py:229-233`):
```python
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
```

---

## 📊 WHAT'S HAPPENING IN THE LOGS

### **Backend Error Pattern**:
```
[14/Oct/2025 05:15:30] "POST /accounts/login/ HTTP/1.1" 403 2855
Forbidden (CSRF cookie not set.): /accounts/login/
```

**Translation**:
1. Frontend calls `/api/auth/csrf/` → Django sets `csrftoken` cookie in browser (✅ works)
2. Frontend extracts CSRF token from JSON response (✅ works)
3. Frontend calls `POST /accounts/login/` with `X-CSRFToken` header (✅ header present)
4. **Browser blocks `csrftoken` cookie** from being sent (❌ `SameSite=Lax` blocks cross-origin fetch)
5. Django sees POST with `X-CSRFToken` header but **no matching cookie** → 403 Forbidden

---

## 🧩 WHY EACH ATTEMPTED FIX FAILED

### **Attempt 1: `SameSite='None'` (Broken - Caused Current Issue)**

**What we tried** (previous version):
```python
SESSION_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
```

**Why it failed**:
- Modern browsers (Chrome 80+, Firefox 69+) **require `Secure=True` when `SameSite='None'`**
- `Secure=True` requires **HTTPS**, but we're using **HTTP** in development
- Browser silently **rejects the cookie** (doesn't set it at all)
- Result: **No cookies → no authentication**

---

### **Attempt 2: Back to `SameSite='Lax'` (Current State - Still Broken)**

**Current settings**:
```python
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
```

**Why it's failing**:
- `Lax` allows cookies on **top-level navigation** (e.g., `<form action="...">` submit)
- `Lax` **blocks cookies** on **JavaScript fetch()** from different origin
- Our login uses **fetch POST** → cookies blocked → 403

**What would work with `Lax`**:
```html
<!-- This would work because it's top-level navigation -->
<form action="http://localhost:8000/accounts/login/" method="POST">
  <input name="csrfmiddlewaretoken" value="...">
  <input name="username" value="Learn4">
  <input name="password" value="Soccer!9">
  <button type="submit">Login</button>
</form>
```

**What doesn't work with `Lax`** (current implementation):
```javascript
// This FAILS because it's a cross-origin fetch
fetch('http://localhost:8000/accounts/login/', {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-CSRFToken': token },
  body: formData
})
```

---

## 🔧 CODE INVENTORY

### **1. Backend Configuration**

**File**: `backend/renaissBlock/settings.py`

**CORS Setup** (lines 216-224):
```python
CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
```
✅ **Status**: Correct - allows credentials

**Cookie Settings** (lines 229-233):
```python
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
```
❌ **Status**: Problematic for cross-origin fetch

**Middleware** (lines 76-87):
```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # First - correct
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # CSRF enforcement
    # ... rest
]
```
✅ **Status**: Correct order

**DRF Authentication** (lines 241-243):
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    # ...
}
```
✅ **Status**: Correct

---

### **2. Frontend Configuration**

**Proxy Setup** (`frontend/src/setupProxy.js`):
```javascript
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    ['/api', '/accounts', '/admin'],
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      credentials: 'include',
    })
  );
};
```
✅ **Status**: File exists and configured correctly
❌ **Problem**: `http-proxy-middleware` **NOT INSTALLED** in `package.json`!

**Check** (`frontend/package.json`):
```json
{
  "dependencies": { /* ... no http-proxy-middleware ... */ },
  "devDependencies": {
    "ajv": "^8.17.1",
    "ajv-keywords": "^5.1.0",
    "typescript": "^4.9.5"
    // ❌ NO http-proxy-middleware
  }
}
```

**Result**: The `setupProxy.js` file exists but **is not being used** because:
1. The dependency is not installed
2. React dev server can't load the middleware
3. All requests still go directly `:3000` → `:8000` (cross-origin)

---

**Frontend Code** (`frontend/src/pages/AuthPage.tsx:49-51`):
```typescript
const res = await fetch(`${BACKEND}/accounts/login/`, {
  method:'POST', 
  credentials:'include', 
  headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': csrf }, 
  body:String(form)
});
```

Where `BACKEND = 'http://localhost:8000'` (line 7)

✅ **Status**: Code is correct for cross-origin
❌ **Problem**: Browser blocks `csrftoken` cookie with `SameSite=Lax`

---

### **3. Enhanced CSRF View**

**File**: `backend/rb_core/views.py:681-695`

```python
class CsrfTokenView(APIView):
    def get(self, request):
        token = get_token(request)
        response = Response({'csrfToken': token})
        # Explicitly set the CSRF cookie for cross-origin requests
        response.set_cookie(
            'csrftoken',
            token,
            max_age=31449600,
            secure=False,
            httponly=False,  # JS can read it
            samesite='Lax'
        )
        return response
```

✅ **Status**: Cookie IS being set
❌ **Problem**: Cookie set with `SameSite=Lax` → browser blocks it on subsequent cross-origin POST

---

## 🎯 THE FUNDAMENTAL ISSUE

**We have a chicken-and-egg problem**:

1. **Option A: `SameSite='None'` + `Secure=True`**
   - Requires: HTTPS
   - Problem: Development uses HTTP
   - Result: Browser rejects cookies

2. **Option B: `SameSite='Lax'` + `Secure=False`**
   - Works with: HTTP
   - Problem: Browser blocks cookies on cross-origin fetch
   - Result: CSRF validation fails

3. **Option C: Same-origin requests (proxy)**
   - Would work: Requests from `:3000/api` → `:3000` (proxied to `:8000`)
   - Problem: `http-proxy-middleware` not installed
   - Result: Proxy not active, still cross-origin

---

## 📋 CURRENT STATE SUMMARY

### **What's Working**:
- ✅ Django backend runs on `:8000`
- ✅ React frontend runs on `:3000`
- ✅ CORS headers configured correctly
- ✅ CSRF token endpoint returns token in JSON
- ✅ Cookie is set in browser (visible in DevTools)
- ✅ Frontend sends `X-CSRFToken` header

### **What's Broken**:
- ❌ Browser blocks `csrftoken` cookie from being sent on POST (SameSite=Lax)
- ❌ Django sees no cookie → rejects request with 403
- ❌ All logins fail (Learn4, superuser, songmanage)
- ❌ Cannot authenticate to test any features
- ❌ Proxy setup exists but middleware not installed

---

## 💡 VIABLE SOLUTIONS (Ranked)

### **Solution 1: Install and Use Proxy (RECOMMENDED for Dev)** ⭐

**What it does**:
- All requests from `:3000` go to `:3000` (same-origin)
- React dev server proxies to `:8000` behind the scenes
- Browser sees same-origin → sends cookies → authentication works

**Requires**:
1. Install `http-proxy-middleware`: `npm install --save-dev http-proxy-middleware`
2. Keep `setupProxy.js` as-is (already configured)
3. Change frontend to use **relative URLs** instead of `http://localhost:8000`
   - Change: `http://localhost:8000/api/content/` → `/api/content/`
   - Change: `http://localhost:8000/accounts/login/` → `/accounts/login/`
4. Keep `SameSite='Lax'` in Django (works for same-origin)

**Pros**:
- ✅ No HTTPS needed
- ✅ No browser security workarounds
- ✅ Works exactly like production (single domain)
- ✅ Standard CRA (Create React App) pattern

**Cons**:
- Requires code changes in ~13 frontend files
- Requires npm install (failed earlier due to permission issue)

---

### **Solution 2: Development HTTPS with self-signed cert**

**What it does**:
- Run both frontend and backend with HTTPS
- Set `SameSite='None'` + `Secure=True`
- Browser allows cross-origin cookies with HTTPS

**Requires**:
1. Generate self-signed SSL cert
2. Configure Django to use HTTPS (runserver_plus or nginx)
3. Configure React with HTTPS (`HTTPS=true` in `.env`)
4. Accept browser security warnings for self-signed cert
5. Change settings to `SameSite='None'` + `Secure=True`

**Pros**:
- ✅ Tests production-like HTTPS setup
- ✅ No code changes needed

**Cons**:
- ❌ Complex setup
- ❌ Browser security warnings
- ❌ Slower dev experience
- ❌ Overkill for MVP

---

### **Solution 3: Serve React build from Django (Same Domain)**

**What it does**:
- Build React app: `npm run build`
- Serve from Django as static files
- Everything on `:8000` → same-origin

**Requires**:
1. Build React app after every frontend change
2. Configure Django to serve React static files
3. Update `STATICFILES_DIRS` and `STATIC_URL`

**Pros**:
- ✅ True same-origin (production-like)
- ✅ No proxy needed

**Cons**:
- ❌ No hot module reload (slow dev cycle)
- ❌ Must rebuild after every frontend change
- ❌ Terrible developer experience

---

### **Solution 4: Disable CSRF (NOT RECOMMENDED)**

**What it does**:
- Exempt `/accounts/login/` from CSRF check
- Set `@csrf_exempt` decorator

**Pros**:
- ✅ Quick fix

**Cons**:
- ❌ **SECURITY RISK**: Removes CSRF protection
- ❌ Bad practice
- ❌ Won't work in production
- ❌ Other endpoints still broken

---

## 🚨 WHY THIS BROKE

**Timeline**:
1. **Initially**: NavBar wasn't updating after login
2. **Diagnosis**: DRF views didn't have `SessionAuthentication` → Fixed ✅
3. **Second issue**: Cookies not working cross-origin
4. **First attempt**: Changed to `SameSite='None'` (required by some docs)
5. **Browser rejected**: `SameSite='None'` requires `Secure=True` (HTTPS)
6. **Rollback**: Changed back to `SameSite='Lax'`
7. **Current state**: Cookies blocked on cross-origin fetch → **Complete login failure**

---

## 🎯 RECOMMENDED PATH FORWARD

### **Immediate Fix (Solution 1 - Proxy)**:

This is the **standard Create React App pattern** and matches how production will work (single domain).

**Steps**:
1. Fix npm permission issue (user needs to run suggested command)
2. Install proxy middleware
3. Update all frontend files to use relative URLs
4. Keep Django settings as-is (`SameSite='Lax'`)
5. Restart React dev server

**Files to update** (13 total - found via grep):
- `frontend/src/App.tsx`
- `frontend/src/pages/AuthPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/CollaboratorsPage.tsx`
- `frontend/src/pages/ContentDetail.tsx`
- `frontend/src/components/InviteModal.tsx`
- `frontend/src/components/SignupForm.tsx`
- `frontend/src/components/CreateWizard/CreateWizard.tsx`
- `frontend/src/components/CreateWizard/MintStep.tsx`
- `frontend/src/components/CreateWizard/ShareStep.tsx`
- `frontend/src/components/ProfileEditForm.tsx`
- `frontend/src/components/StatusEditForm.tsx`
- `frontend/src/setupProxy.js` (already correct)

**Change pattern**:
```typescript
// BEFORE
const BACKEND = 'http://localhost:8000';
fetch(`${BACKEND}/api/content/`, ...)

// AFTER
// Remove BACKEND constant
fetch('/api/content/', ...)  // Proxy handles routing to :8000
```

---

## 📊 COMPARISON MATRIX

| Solution | Setup Time | Dev Experience | Production-Like | Works Now? |
|----------|-----------|----------------|-----------------|------------|
| **Proxy (Recommended)** | 1-2 hours | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | After install |
| HTTPS Self-Signed | 2-3 hours | ⭐⭐ | ⭐⭐⭐⭐ | Yes |
| Django Static Serve | 1 hour | ⭐ | ⭐⭐⭐⭐⭐ | Yes |
| Disable CSRF | 5 minutes | ⭐⭐⭐⭐ | ❌ | Yes |

---

## 🔥 CRITICAL BLOCKER

**Immediate Issue**: User attempted to install `http-proxy-middleware` but got npm permission error:

```
npm error code EPERM
npm error errno EPERM
npm error Your cache folder contains root-owned files
npm error To permanently fix: sudo chown -R 501:20 "/Users/davidsong/.npm"
```

**This must be resolved before any solution can work.**

---

## 📝 FINAL SUMMARY

### **Problem**: 
Cross-origin cookie blocking due to `SameSite=Lax` policy preventing CSRF cookies from being sent on `fetch()` POST requests.

### **Root Cause**: 
Architectural decision to run frontend (`:3000`) and backend (`:8000`) on different ports creates cross-origin requests, incompatible with modern browser security policies for HTTP development.

### **Best Solution**: 
Use CRA's built-in proxy to make requests same-origin, which is the standard pattern for React + Django development and matches production architecture.

### **Blocker**: 
npm permission issue must be fixed before installing `http-proxy-middleware`.

### **Impact**: 
🔴 **CRITICAL** - Complete authentication failure, project cannot be tested.

---

## 🚀 NEXT STEPS

**User must choose**:
1. **Fix npm permissions and use proxy** (recommended, 1-2 hours)
2. **Set up HTTPS for dev** (complex, 2-3 hours)
3. **Use Django to serve frontend** (slow dev cycle)
4. **Temporarily disable CSRF** (security risk, quick fix for testing only)

**No code changes will be made until user decides on approach.**

---

**END OF ASSESSMENT**

