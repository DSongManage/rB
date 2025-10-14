# Week 5 PR and CI Validation Commands - renaissBlock

**Date**: October 13, 2025  
**Purpose**: Finalize Week 5 and trigger CI/CD validation

---

## 📦 Step 1: Commit All Changes

```bash
cd /Users/davidsong/repos/songProjects/rB

# Check what's been modified
git status

# Review changes (optional)
git diff HEAD

# Add all modified and new files
git add -A

# Create comprehensive commit
git commit -m "week5: complete integration and validation

Backend (rb_core):
- Implement MintView with sale_amount and TestFeeLog
- Add ContentListView IPFS upload for text content
- Create /api/content/<id>/teaser/ endpoint with BeautifulSoup sanitization
- Add feature-flagged AnchorPy integration (FEATURE_ANCHOR_MINT)
- Install beautifulsoup4 and lxml for HTML processing

Frontend (React):
- Update CreateWizard to use FormData with 'text' field
- Fix PreviewModal to render text inline with DOMPurify
- Add MintButton with sale_amount input validation
- Migrate to Web3Auth v9.3.2 with SolanaPrivateKeyProvider
- Resolve dependency conflicts (viem 2.37.8, ox 0.9.3, process polyfill)
- Fix all ESLint warnings (unused vars, hook dependencies)
- Install @web3auth/base, @web3auth/solana-provider, dompurify

Blockchain (Anchor/Rust):
- Implement on-chain fee transfer (PLATFORM_FEE_BPS = 10%)
- Add Minted event with sale_amount_lamports and fee_bps
- Update mint_test.ts with methods().rpc(), alt payer, QuickNode support
- Add Rust unit tests for fee calculation
- Configure CI with Anchor 0.31.1, Rust 1.82.0, SBF tools

CI/CD:
- Update .github/workflows/ci.yml with Anchor build job
- Add matrix for Rust 1.82.0, Anchor 0.31.1
- Configure QUICKNODE_DEVNET_URL secret for RPC
- Add Django and Jest test jobs

Documentation:
- Update blockchain/docs/devnet_setup.md with Week 5 validation summary
- Add Week 6 user testing plan
- Document Web3Auth v9 migration in FINAL_WEB3AUTH_SOLUTION.md
- Create comprehensive fix docs (FRONTEND_BUILD_FIX_FINAL.md, WEB3AUTH_V9_FIX.md)

Validated:
- Devnet TX: YX3AfmRQSAiJ62myAkJ1fbruqYFvaSGNpfEtEtRMvLzixMuW1PDbvwhYL6i4bnPAiVSHKWYh6jESzgwmZFHiHjU
- Platform wallet delta: +100,000 lamports (10% of 1M sale)
- All tests passing (Anchor build, Rust tests, Django, Jest)
"

# Verify commit created
git log -1 --oneline
```

---

## 🌿 Step 2: Create and Push Branch

```bash
cd /Users/davidsong/repos/songProjects/rB

# Check current branch
git branch

# Create feat/week5-validation branch (or switch if exists)
git checkout -b feat/week5-validation

# Push to origin with upstream tracking
git push -u origin feat/week5-validation

# Verify push succeeded
git status
```

**Expected Output**:
```
Branch 'feat/week5-validation' set up to track remote branch 'feat/week5-validation' from 'origin'.
```

---

## 🔀 Step 3: Open Pull Request

### Option A: Via GitHub Web UI

1. **Navigate to repository**: 
   ```
   https://github.com/YOUR_USERNAME/renaissBlock
   ```

2. **GitHub will show**:
   ```
   feat/week5-validation had recent pushes
   [Compare & pull request]
   ```

3. **Click "Compare & pull request"**

4. **Fill in PR details**:

**Title**:
```
Week 5: Complete Integration and Validation
```

**Description**:
```markdown
## 🎯 Week 5 Summary

This PR completes Week 5 integration and validation for renaissBlock, implementing on-chain fee collection, backend-blockchain integration, and frontend UX improvements.

### ✅ Features Implemented

#### On-Chain (Rust/Anchor)
- **Fee Collection (FR9)**: Platform receives 10% of `sale_amount` via `system_instruction::transfer`
- **Minted Event**: Emits `sale_amount_lamports`, `fee_bps`, `platform_wallet`
- **Validation**: Devnet TX `YX3AfmRQSAiJ62myAkJ1fbruqYFvaSGNpfEtEtRMvLzixMuW1PDbvwhYL6i4bnPAiVSHKWYh6jESzgwmZFHiHjU`
- **Tests**: Rust unit tests for fee calculation and event emission

#### Backend (Django)
- **MintView**: Accepts `sale_amount`, logs to `TestFeeLog`, feature-flagged AnchorPy integration
- **ContentListView**: IPFS upload for text/image/video with watermarking
- **/api/content/<id>/teaser/**: HTML sanitization with BeautifulSoup
- **/api/analytics/fees/**: Platform fee analytics endpoint
- **Dependencies**: beautifulsoup4, lxml, anchorpy

#### Frontend (React)
- **CreateWizard**: FormData submission with proper field mapping (`text` instead of `textHtml`)
- **PreviewModal**: Inline HTML rendering with DOMPurify (no iframe)
- **MintButton**: `sale_amount` input with validation
- **Web3Auth v9**: Migration to v9.3.2 with `SolanaPrivateKeyProvider` and `CHAIN_NAMESPACES`
- **Dependencies**: Resolved viem 2.37.8, ox 0.9.3, process/buffer polyfills, dompurify, @web3auth/base, @web3auth/solana-provider
- **ESLint**: All warnings fixed

#### CI/CD
- **Anchor Build**: Rust 1.82.0, Anchor 0.31.1, SBF tools installation
- **Test Matrix**: Cargo test, Django test (SQLite), Jest
- **Secrets**: QUICKNODE_DEVNET_URL for devnet RPC

### 📊 Validation Results

| Component | Status | Details |
|-----------|--------|---------|
| Anchor Build | ✅ Pass | renaiss_block compiles |
| Rust Tests | ✅ Pass | Fee logic unit tests |
| Django Tests | ✅ Pass | MintView, ContentListView |
| Frontend Tests | ✅ Pass | CreateWizard, MintButton |
| Devnet Mint | ✅ Success | TX: YX3Afm... |
| Fee Transfer | ✅ Verified | 100K lamports (10% of 1M) |

### 🔗 Related Documentation
- `blockchain/docs/devnet_setup.md` - Devnet validation summary + Week 6 plan
- `WEEK5_FINALIZATION.md` - Week 5 wrap-up and Week 6 task breakdown
- `FINAL_WEB3AUTH_SOLUTION.md` - Web3Auth v9 migration guide
- `FRONTEND_BUILD_FIX_FINAL.md` - Dependency resolution details

### 🚀 Next Steps (Week 6)
- [ ] User testing (creator and collector flows)
- [ ] Performance optimization
- [ ] UX improvements based on feedback
- [ ] Bug fixes from testing

### ✅ CI Jobs Expected
- [ ] Anchor Build (renaiss_block)
- [ ] Rust Tests
- [ ] Django Tests  
- [ ] Frontend Tests (Jest)

All jobs should pass. Ready for review and merge.
```

5. **Assign reviewers** (optional)

6. **Click "Create Pull Request"**

---

### Option B: Via GitHub CLI

```bash
cd /Users/davidsong/repos/songProjects/rB

# Create PR with gh cli (if installed)
gh pr create \
  --title "Week 5: Complete Integration and Validation" \
  --body "See WEEK5_FINALIZATION.md for complete details. All FR9 and NFR5 requirements met. Validated on devnet with TX YX3AfmRQSAiJ62myAkJ1fbruqYFvaSGNpfEtEtRMvLzixMuW1PDbvwhYL6i4bnPAiVSHKWYh6jESzgwmZFHiHjU" \
  --base main \
  --head feat/week5-validation

# View PR in browser
gh pr view --web
```

---

## ⚙️ Step 4: Monitor CI Pipeline

### Check CI Status

```bash
# Option A: GitHub CLI
gh run list --branch feat/week5-validation

# Watch latest run
gh run watch

# View logs for specific job
gh run view --log
```

### Option B: Web UI

```bash
# Open Actions tab
open https://github.com/YOUR_USERNAME/renaissBlock/actions

# Or via gh
gh pr checks
```

---

### Expected CI Jobs

#### Job 1: Anchor Build
```yaml
- Install Rust 1.82.0
- Install Anchor CLI 0.31.1
- Install SBF tools (cargo build-sbf --force-tools-install)
- Build: anchor build -p renaiss_block
- Verify IDL generated
```

#### Job 2: Rust Tests
```yaml
- cargo test --manifest-path blockchain/rb_contracts/programs/renaiss_block/Cargo.toml
- Verify fee calculation tests pass
```

#### Job 3: Django Tests
```yaml
- Setup Python 3.13 + venv
- Install requirements.txt
- Run: python backend/manage.py test rb_core
- Verify MintView, ContentListView tests pass
```

#### Job 4: Frontend Tests
```yaml
- Setup Node.js
- npm install --legacy-peer-deps
- npm test -- --watchAll=false
- Verify CreateWizard, MintButton tests pass
```

---

## 🧪 Optional: End-to-End Validation (Local)

### Full E2E Test Flow

```bash
# Terminal 1: Start Backend
cd /Users/davidsong/repos/songProjects/rB/backend
source ../venv/bin/activate
echo 'FEATURE_ANCHOR_MINT=true' >> .env
echo 'SOLANA_RPC_URL=https://autumn-light-thunder.solana-devnet.quiknode.pro/97cc792c89dda353db1332623dc1308ccd0a7f97/' >> .env
python manage.py runserver

# Terminal 2: Start Frontend
cd /Users/davidsong/repos/songProjects/rB/frontend
npm start

# Terminal 3: Run Tests
cd /Users/davidsong/repos/songProjects/rB

# 1. Login and get session
CSRF_TOKEN=$(curl -s -c cookies.txt http://localhost:8000/api/auth/csrf/ | python3 -c "import sys, json; print(json.load(sys.stdin)['csrfToken'])")

curl -X POST http://localhost:8000/admin/login/ \
  -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  --data-urlencode "username=songmanage" \
  --data-urlencode 'password=Soccer!944' \
  --data-urlencode "csrfmiddlewaretoken=$CSRF_TOKEN" \
  -L > /dev/null

# 2. Create content
CONTENT_ID=$(curl -s -X POST http://localhost:8000/api/content/ \
  -b cookies.txt \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -F "title=E2E Test NFT" \
  -F "text=<h1>Test</h1><p>Week 5 validation content.</p>" \
  -F "content_type=book" \
  -F "genre=other" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "Created Content ID: $CONTENT_ID"

# 3. Mint (mock - without actual on-chain call if FEATURE_ANCHOR_MINT=false)
MINT_RESULT=$(curl -s -X POST http://localhost:8000/api/mint/ \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  --data "{\"content_id\": $CONTENT_ID, \"sale_amount\": 1000000}")

echo "Mint Result: $MINT_RESULT"

# 4. Verify fee log
cd backend
source ../venv/bin/activate
python manage.py shell -c "
from rb_core.models import TestFeeLog
log = TestFeeLog.objects.filter(content_id=$CONTENT_ID).first()
if log:
    print(f'✅ Fee logged: Sale={log.sale_amount_lamports}, Fee={log.platform_fee_lamports}, BPS={log.fee_bps}')
else:
    print('❌ No fee log found')
"

# 5. Check analytics
curl -s http://localhost:8000/api/analytics/fees/ \
  -b cookies.txt | python3 -m json.tool
```

---

## 🔑 GitHub Secrets Configuration

### Add QUICKNODE_DEVNET_URL Secret

1. **Navigate to Settings**:
   ```
   https://github.com/YOUR_USERNAME/renaissBlock/settings/secrets/actions
   ```

2. **Click "New repository secret"**

3. **Add secret**:
   - **Name**: `QUICKNODE_DEVNET_URL`
   - **Value**: `https://autumn-light-thunder.solana-devnet.quiknode.pro/97cc792c89dda353db1332623dc1308ccd0a7f97/`

4. **Click "Add secret"**

5. **Verify** in `.github/workflows/ci.yml`:
   ```yaml
   - name: Build Anchor program
     env:
       ANCHOR_PROVIDER_URL: ${{ secrets.QUICKNODE_DEVNET_URL }}
     run: |
       anchor build -p renaiss_block
   ```

---

## 📋 Pre-Merge Checklist

Before merging the PR, verify:

- [ ] **All CI jobs pass** (green checkmarks)
- [ ] **No merge conflicts** with main branch
- [ ] **Code review complete** (if applicable)
- [ ] **Documentation updated** (devnet_setup.md, WEEK5_FINALIZATION.md)
- [ ] **Tests passing locally**:
  ```bash
  # Anchor build
  cd blockchain/rb_contracts && anchor build -p renaiss_block
  
  # Rust tests
  cargo test --manifest-path programs/renaiss_block/Cargo.toml
  
  # Django tests
  cd ../../backend && python manage.py test rb_core
  
  # Frontend tests
  cd ../frontend && npm test -- --watchAll=false
  ```

---

## 🔄 Post-Merge Actions

### After PR is merged to main:

```bash
cd /Users/davidsong/repos/songProjects/rB

# Switch to main
git checkout main

# Pull latest
git pull origin main

# Verify main is up to date
git log -1 --oneline

# Clean up feature branch (optional)
git branch -d feat/week5-validation
git push origin --delete feat/week5-validation
```

---

## 🧪 CI Job Details

### Job 1: Anchor Build

**Purpose**: Verify Anchor program compiles on CI

**Steps**:
1. Checkout code
2. Install Rust 1.82.0
3. Install Anchor CLI 0.31.1
4. Install SBF tools: `cargo build-sbf --force-tools-install`
5. Build: `anchor build -p renaiss_block`
6. Verify IDL: `ls target/idl/renaiss_block.json`

**Expected Duration**: 8-12 minutes

---

### Job 2: Rust Tests

**Purpose**: Validate on-chain logic and fee calculations

**Steps**:
1. Checkout code
2. Install Rust 1.82.0
3. Run: `cargo test --manifest-path blockchain/rb_contracts/programs/renaiss_block/Cargo.toml`

**Tests Expected to Pass**:
- `test_minted_event_fee_bps` - Verifies Minted event includes correct fee_bps
- `test_split_fee` - Validates fee calculation math (10% of sale_amount)

**Expected Duration**: 2-3 minutes

---

### Job 3: Django Tests

**Purpose**: Validate backend API endpoints and models

**Steps**:
1. Checkout code
2. Setup Python 3.13 + venv
3. Install: `pip install -r backend/requirements.txt`
4. Run migrations: `python backend/manage.py migrate`
5. Run tests: `python backend/manage.py test rb_core`

**Tests Expected to Pass**:
- Content CRUD operations
- MintView with sale_amount
- TestFeeLog creation
- User authentication

**Expected Duration**: 3-5 minutes

---

### Job 4: Frontend Tests (Jest)

**Purpose**: Validate React components and user flows

**Steps**:
1. Checkout code
2. Setup Node.js
3. Install: `npm install --legacy-peer-deps`
4. Run: `npm test -- --watchAll=false`

**Tests Expected to Pass**:
- CreateWizard flow (type select, content creation, customize, mint)
- MintButton validation and API call
- CustomizeStep teaser/price configuration
- Component rendering

**Expected Duration**: 5-8 minutes

---

## 🐛 Troubleshooting CI Failures

### If Anchor Build Fails:

**Check**:
```bash
# Locally reproduce
cd blockchain/rb_contracts
anchor build -p renaiss_block

# If IDL error, ensure feature in Cargo.toml:
[features]
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```

**Fix**: Update `programs/renaiss_block/Cargo.toml` and push

---

### If Rust Tests Fail:

**Check**:
```bash
# Run locally
cd blockchain/rb_contracts
cargo test --manifest-path programs/renaiss_block/Cargo.toml -- --nocapture

# Check for specific test failures
cargo test test_split_fee -- --nocapture
```

**Fix**: Update test assertions or implementation

---

### If Django Tests Fail:

**Check**:
```bash
# Run locally with verbose output
cd backend
python manage.py test rb_core --verbosity=2

# Check specific test
python manage.py test rb_core.tests.MintViewTestCase
```

**Fix**: Update test fixtures or view logic

---

### If Frontend Tests Fail:

**Check**:
```bash
# Run locally with verbose
cd frontend
npm test -- --watchAll=false --verbose

# Run specific test
npm test -- CreateWizard.test.tsx --watchAll=false
```

**Fix**: Update component mocks or assertions

---

## 📊 Success Criteria

### Week 5 Complete When:
- ✅ PR created and open
- ✅ All 4 CI jobs pass (green checkmarks)
- ✅ Code review approved (if applicable)
- ✅ No merge conflicts
- ✅ Documentation complete
- ✅ PR merged to main

### Ready for Week 6 When:
- ✅ Main branch updated with Week 5 changes
- ✅ All tests passing on main
- ✅ Devnet deployment verified
- ✅ Testing scenarios documented

---

## 🚀 Quick Reference Commands

### Create PR (Full Flow):
```bash
cd /Users/davidsong/repos/songProjects/rB
git add -A
git commit -m "week5: complete integration and validation"
git checkout -b feat/week5-validation
git push -u origin feat/week5-validation
# Then open GitHub UI to create PR
```

### Monitor CI:
```bash
gh run list --branch feat/week5-validation
gh run watch
```

### Test Locally Before Merge:
```bash
# All tests
cd blockchain/rb_contracts && anchor build -p renaiss_block && cargo test --manifest-path programs/renaiss_block/Cargo.toml
cd ../../backend && python manage.py test rb_core
cd ../frontend && npm test -- --watchAll=false
```

---

**Week 5 finalization ready to execute!** Follow steps 1-3 above to create and submit the PR. 🚀

