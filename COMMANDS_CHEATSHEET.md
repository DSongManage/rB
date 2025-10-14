# renaissBlock Command Cheatsheet - Week 5/6

Quick reference for common operations

---

## 🚀 Start Servers

### Frontend:
```bash
cd /Users/davidsong/repos/songProjects/rB/frontend
pkill -f "react-scripts"  # Kill old process
npm start                  # Start dev server on :3000
```

### Backend:
```bash
cd /Users/davidsong/repos/songProjects/rB/backend
source ../venv/bin/activate
python manage.py runserver  # Start on :8000
```

---

## 🧪 Run Tests

### All Tests (Quick Check):
```bash
# Rust
cd blockchain/rb_contracts && cargo test --manifest-path programs/renaiss_block/Cargo.toml

# Django
cd backend && python manage.py test rb_core

# Jest
cd frontend && npm test -- --watchAll=false
```

### Specific Tests:
```bash
# CollaboratorsPage backend
python backend/manage.py test rb_core.tests.ProfileTests.test_user_search_returns_accomplishments_and_stats

# CollaboratorsPage frontend
npm test --prefix frontend -- CollaboratorsPage.test.tsx --watchAll=false

# CreateWizard
npm test --prefix frontend -- CreateWizard.test.tsx --watchAll=false
```

---

## 📦 Dependency Management

### Clean Reinstall (Frontend):
```bash
cd frontend
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Update Single Package:
```bash
npm install <package>@<version> --legacy-peer-deps
```

---

## 🔍 Check Status

### Fee Analytics:
```bash
curl -s http://localhost:8000/api/analytics/fees/ | python3 -m json.tool
```

### Fee Logs (Django Shell):
```bash
cd backend && source ../venv/bin/activate
python manage.py shell -c "
from rb_core.models import TestFeeLog
logs = TestFeeLog.objects.all().order_by('-created_at')[:5]
for log in logs:
    print(f'Sale: {log.sale_amount_lamports:,}, Fee: {log.platform_fee_lamports:,}, BPS: {log.fee_bps}')
"
```

### Content Stats:
```bash
python manage.py shell -c "
from rb_core.models import Content
print(f'Total: {Content.objects.count()}')
print(f'Minted: {Content.objects.filter(inventory_status=\"minted\").count()}')
"
```

---

## 🔗 Create Test Data

### Test User with Profile:
```bash
cd backend && source ../venv/bin/activate
python manage.py shell <<'EOF'
from rb_core.models import User, UserProfile

user = User.objects.create_user(username='test_creator_pro', password='testpass123')
UserProfile.objects.create(
    user=user,
    username='test_creator_pro',
    display_name='Professional Test Creator',
    roles=['author', 'artist'],
    genres=['fantasy', 'scifi'],
    content_count=20,
    total_sales_usd=3500.00,
    status='Mint-Ready Partner',
    location='San Francisco, CA',
    tier='Pro'
)
print("✅ Created: @test_creator_pro")
EOF
```

### Test Content:
```bash
curl -X POST http://localhost:8000/api/content/ \
  -b cookies.txt \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -F "title=Test NFT" \
  -F "text=<h1>Test</h1><p>Content for testing</p>" \
  -F "content_type=book" \
  -F "genre=other"
```

---

## 🎯 Week 5 PR Creation

```bash
cd /Users/davidsong/repos/songProjects/rB

git add -A
git commit -m "week5: complete integration and validation"
git checkout -b feat/week5-validation
git push -u origin feat/week5-validation

# Then create PR via GitHub UI
```

---

## 🔐 Login for API Testing

```bash
# Get CSRF token
CSRF_TOKEN=$(curl -s -c cookies.txt http://localhost:8000/api/auth/csrf/ | python3 -c "import sys, json; print(json.load(sys.stdin)['csrfToken'])")

# Login
curl -X POST http://localhost:8000/admin/login/ \
  -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  --data-urlencode "username=songmanage" \
  --data-urlencode 'password=Soccer!944' \
  --data-urlencode "csrfmiddlewaretoken=$CSRF_TOKEN" \
  -L

# Verify session
cat cookies.txt | grep sessionid
```

---

## 🛠️ Common Fixes

### Frontend Won't Compile:
```bash
cd frontend
pkill -f "react-scripts"
npm cache clean --force  
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm start
```

### Backend Migration Issues:
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Database Reset:
```bash
cd backend
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

---

## 📊 Week 6 Testing Commands

### Create Testing Session:
```bash
cp WEEK6_TESTING_TEMPLATE.md testing_session_1.md
# Fill out during testing
```

### Quick Performance Test:
```bash
# Time content creation
time curl -X POST http://localhost:8000/api/content/ \
  -b cookies.txt \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -F "title=Perf Test" \
  -F "text=<h1>Test</h1>" \
  -F "content_type=book" \
  -F "genre=other"
```

---

## 🔍 Debugging

### Check Frontend Logs:
```bash
# Browser console (Cmd+Option+J in Chrome)
# Look for errors or warnings
```

### Check Backend Logs:
```bash
# Terminal running manage.py runserver
# Look for 500 errors or exceptions
```

### Check Database:
```bash
cd backend
python manage.py dbshell
# Then: SELECT * FROM rb_core_testfeelog ORDER BY created_at DESC LIMIT 5;
```

---

## 📚 Documentation Quick Links

- **Week 5 Summary**: `README_WEEK5_COMPLETE.md`
- **Quick Start**: `QUICK_START_WEEK5_TO_WEEK6.md`
- **PR Guide**: `PR_AND_CI_COMMANDS.md`
- **Week 6 Plan**: `WEEK5_FINALIZATION.md`
- **Testing Template**: `WEEK6_TESTING_TEMPLATE.md`
- **Web3Auth**: `FINAL_WEB3AUTH_SOLUTION.md`
- **Collaborators**: `COLLABORATORS_PAGE_ENHANCEMENT.md`

---

**Keep this cheatsheet handy during Week 6 testing!** 📌

