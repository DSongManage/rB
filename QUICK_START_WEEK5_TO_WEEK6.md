# Quick Start: Week 5 → Week 6 Transition

**Status**: Week 5 Complete ✅ | Ready for Week 6 Testing 📋

---

## 🚀 Immediate Actions (Next 30 Minutes)

### 1. Verify Frontend is Running

```bash
# Check if dev server is up
curl -s http://localhost:3000 | head -5

# If not running or showing errors:
cd /Users/davidsong/repos/songProjects/rB/frontend
pkill -f "react-scripts"
npm start

# Verify compilation in terminal:
# Look for "Compiled successfully!"
```

---

### 2. Create & Push PR

```bash
cd /Users/davidsong/repos/songProjects/rB

# Add all changes
git add -A

# Commit
git commit -m "week5: complete integration and validation"

# Create branch and push
git checkout -b feat/week5-validation
git push -u origin feat/week5-validation

# Open GitHub to create PR
open https://github.com/YOUR_USERNAME/renaissBlock/compare/main...feat:week5-validation
```

**In GitHub UI**:
- Title: `Week 5: Complete Integration and Validation`
- Use description from `PR_AND_CI_COMMANDS.md`
- Click "Create Pull Request"

---

### 3. Monitor CI (5-15 min wait)

```bash
# Watch CI status
gh run watch  # or check GitHub Actions tab

# Expected: All 4 jobs pass ✅
# - Anchor Build
# - Rust Tests
# - Django Tests
# - Frontend Tests
```

---

## 🧪 Week 6 Testing (Next 5-7 Days)

### Day 1: Creator Flow Testing

```bash
# Start both servers
cd /Users/davidsong/repos/songProjects/rB/backend
source ../venv/bin/activate
python manage.py runserver &

cd ../frontend
npm start &

# Open browser and test:
# 1. Sign up new user
# 2. Create text content (book)
# 3. Customize (price, editions, teaser)
# 4. Preview
# 5. Mint
# 6. Verify in profile

# Fill out WEEK6_TESTING_TEMPLATE.md for this session
```

---

### Day 2: Collector Flow Testing

```bash
# Test as different user
# 1. Browse /search
# 2. Find content
# 3. View preview
# 4. (Future) Purchase

# Document observations
```

---

### Day 3-4: Edge Cases & Performance

```bash
# Test scenarios:
# - Large file upload (49MB)
# - Invalid inputs (negative sale_amount, empty title)
# - Concurrent minting
# - Error handling

# Run performance tests:
cd /Users/davidsong/repos/songProjects/rB/backend
python manage.py shell -c "
import time
from rb_core.models import Content
start = time.time()
# Create 10 content items rapidly
for i in range(10):
    Content.objects.create(title=f'Test {i}', content_type='book', creator_id=1)
print(f'Created 10 items in {time.time() - start:.2f}s')
"
```

---

### Day 5: Analysis & Report

```bash
# Compile results
# - Count bugs by severity
# - Calculate average times
# - Aggregate ratings
# - Prioritize improvements

# Create WEEK6_TESTING_REPORT.md
```

---

## 📊 Quick Metrics Dashboard

### Check Fee Analytics

```bash
cd /Users/davidsong/repos/songProjects/rB/backend
source ../venv/bin/activate

python manage.py shell -c "
from rb_core.models import TestFeeLog
from django.db.models import Sum, Count, Avg

stats = TestFeeLog.objects.aggregate(
    total_sales=Sum('sale_amount_lamports'),
    total_fees=Sum('platform_fee_lamports'),
    count=Count('id'),
    avg_sale=Avg('sale_amount_lamports')
)

print('=' * 50)
print('PLATFORM FEE ANALYTICS')
print('=' * 50)
print(f'Total Transactions: {stats[\"count\"]}')
print(f'Total Sales:        {stats[\"total_sales\"]:,} lamports')
print(f'Total Platform Fees: {stats[\"total_fees\"]:,} lamports')
print(f'Average Sale:       {stats[\"avg_sale\"]:,.0f} lamports')
print(f'Fee Rate:           10% (1000 BPS)')
print('=' * 50)
"

# Or via API
curl -s http://localhost:8000/api/analytics/fees/ | python3 -m json.tool
```

---

### Check Content Stats

```bash
python manage.py shell -c "
from rb_core.models import Content

total = Content.objects.count()
minted = Content.objects.filter(inventory_status='minted').count()
draft = Content.objects.filter(inventory_status='draft').count()

print(f'Total Content: {total}')
print(f'Minted: {minted}')
print(f'Draft: {draft}')
print(f'Mint Rate: {minted/total*100 if total else 0:.1f}%')
"
```

---

## 🎯 Success Criteria Quick Check

### Week 5 ✅
- [x] On-chain fee collection working
- [x] Backend `/api/mint/` with sale_amount
- [x] Frontend Web3Auth v9 integration
- [x] All dependency conflicts resolved
- [x] CI/CD pipeline configured
- [x] Devnet validation complete

### Week 6 Targets 🎯
- [ ] 5+ user testing sessions completed
- [ ] <10 bugs total (none critical)
- [ ] Average rating >4.0/5.0
- [ ] Task completion rate >80%
- [ ] Average create→mint time <10 min

---

## 📞 Quick Troubleshooting

### Frontend Won't Start:
```bash
cd frontend
pkill -f "react-scripts"
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm start
```

### Backend API Errors:
```bash
cd backend
source ../venv/bin/activate
python manage.py migrate
python manage.py runserver
```

### Database Reset (If Needed):
```bash
cd backend
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
# Username: songmanage
# Password: Soccer!944
```

---

## 📁 Key Files Reference

### Documentation:
- `WEEK5_FINALIZATION.md` - Week 5 wrap-up + Week 6 detailed plan
- `PR_AND_CI_COMMANDS.md` - Complete PR creation and CI monitoring guide
- `WEEK6_TESTING_TEMPLATE.md` - Copy for each test session
- `FINAL_WEB3AUTH_SOLUTION.md` - Web3Auth v9 integration details
- `blockchain/docs/devnet_setup.md` - Devnet validation + Week 6 notes

### Code:
- Backend: `backend/rb_core/views.py` (MintView, ContentListView, TeaserContentView)
- Frontend: `frontend/src/components/CreateWizard/`, `frontend/src/pages/ProfilePage.tsx`
- Blockchain: `blockchain/rb_contracts/programs/renaiss_block/src/lib.rs`
- Tests: `blockchain/scripts/mint_test.ts`, `frontend/src/tests/`

---

## ✅ Today's Checklist

- [ ] Frontend compiling without errors
- [ ] Backend running on :8000
- [ ] Created PR for feat/week5-validation
- [ ] CI jobs triggered and monitored
- [ ] Reviewed WEEK5_FINALIZATION.md
- [ ] Prepared WEEK6_TESTING_TEMPLATE.md
- [ ] Ready to begin user testing

---

**You're all set! Week 5 complete, Week 6 ready to launch.** 🎉

Next: Create the PR and start testing!

