## Web3Auth client setup (dev)

- Obtain a Web3Auth Client ID (Sapphire) and add your local dev origin to the allowlist:
  - Allowed domains: `http://127.0.0.1:3000`, `http://localhost:3000`
  - For the dev proxy approach, the browser origin is `:3000`.
- Frontend env:
  - Create `frontend/.env` with:
    - `REACT_APP_WEB3AUTH_CLIENT_ID=YOUR_CLIENT_ID`
- Backend env (already defaulted in settings):
  - `WEB3AUTH_CLIENT_ID` and `WEB3AUTH_JWKS_URL` can be left as defaults for dev or set explicitly.
- Test flow:
  - Start Django at `127.0.0.1:8000`.
  - Start the React dev server or the static proxy at `127.0.0.1:3000`.
  - Use “Continue with Web3Auth” on `/auth`.

# renaissBlock Devnet Setup (Placeholder)

This document outlines a minimal, safe path to compile and deploy the Anchor program on Solana devnet.

## Prerequisites
- Rust stable + Cargo
- Solana CLI (devnet)
- Anchor CLI
- Node.js (for Anchor workspace tooling)

## Steps
1) Install toolchains
```
cargo --version
solana --version
anchor --version
```

2) Configure Solana for devnet
```
solana config set --url https://api.devnet.solana.com
solana-keygen new --outfile ~/.config/solana/id.json
solana airdrop 2
solana balance
```

3) Build Anchor program (renaiss_block only)
```
cd blockchain/rb_contracts
anchor build -p renaiss_block
```

4) Test locally
```
cd blockchain/rb_contracts/programs/renaiss_block
cargo test
```

5) Deploy renaiss_block (when ready)
```
# Generate a platform wallet and configure env
python3 blockchain/scripts/generate_wallet.py

# Ensure Anchor provider is using devnet
solana config set --url https://api.devnet.solana.com

# Build and deploy with devnet cluster
anchor build -p renaiss_block
ANCHOR_WALLET=blockchain/target/platform_wallet.json anchor deploy --provider.cluster devnet -p renaiss_block

If local build fails due to toolchain issues, use Docker for a reproducible build:

```
cd blockchain/rb_contracts
docker run --rm -v $PWD:/work -w /work -v $HOME/.config/solana:/root/.config/solana \
  -e ANCHOR_WALLET=/work/../target/platform_wallet.json \
  -e ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
  projectserum/build:v0.28.0 anchor build -p renaiss_block

docker run --rm -v $PWD:/work -w /work -v $HOME/.config/solana:/root/.config/solana \
  -e ANCHOR_WALLET=/work/../target/platform_wallet.json \
  -e ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
  projectserum/build:v0.28.0 anchor deploy -p renaiss_block --provider.cluster devnet
```
```

6) Configure renaissBlock backend
- Add the deployed renaiss_block program id to Django settings as `ANCHOR_PROGRAM_ID` (or `RENAISS_BLOCK_PROGRAM_ID`)
- Ensure `FEATURE_ANCHOR_MINT=true` in `backend/.env`
- Confirm `PLATFORM_WALLET_PUBKEY` is set (script writes it)

---

## Working toolchain matrix and commands (confirmed)

Anchor 0.31.1 with Agave/Solana 2.1.x and host Rust 1.82.0, using a QuickNode devnet RPC.

Versions
- Anchor CLI: 0.31.1
- anchor-lang / anchor-spl crates: 0.31.1 (pinned in each `Cargo.toml`)
- Solana CLI: 2.1.0 (Agave)
- Solana SBF Rust: installed via `cargo build-sbf --force-tools-install`
- Host Rust (for IDL/build scripts): 1.82.0 (pinned via `rust-toolchain.toml`)

One-time setup
```bash
# Anchor CLI
cargo install anchor-cli --version 0.31.1 --locked --force

# Agave / Solana 2.1.0
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
solana --version  # expect 2.1.0

# Host Rust for IDL and build scripts
rustup toolchain install 1.82.0
echo '[toolchain]\nchannel = "1.82.0"\ncomponents = ["rustfmt", "clippy"]' > blockchain/rb_contracts/rust-toolchain.toml

# Ensure Node deps match CLI (JS side)
cd blockchain/rb_contracts
yarn upgrade @coral-xyz/anchor@0.31.1
```

Per-build (first build or after Agave updates)
```bash
cd blockchain/rb_contracts
# Install/refresh Solana SBF toolchain (provides a new rustc for SBF)
cargo build-sbf --force-tools-install

# Build programs and generate IDLs
anchor clean && anchor build -p renaiss_block
```

Notes
- If you must force the Solana toolchain for the build: `RUSTUP_TOOLCHAIN=solana anchor build`.
- If you see IDL errors about `idl-build`, add to each program `Cargo.toml`:
  ```toml
  [features]
  idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
  ```
- Use a valid `declare_id!("...")` in each program; localnet example: `4znujrwLsjKTNQxLRncUYdGLAHnqsVLQarNP9jVEA57n`.

### Legacy toolchain (historical, only if needed)

Anchor 0.28.0 with Solana 1.16.25 and Rust 1.68.0 (older matrix that may be referenced in past notes). Prefer the newer matrix above; use this only if reproducing legacy builds.

Versions
- Anchor CLI: 0.28.0 (install from Git tag if crates.io is unavailable)
- anchor-lang / anchor-spl: 0.28.0
- Solana CLI: 1.16.25
- Rust: 1.68.0

Commands
```bash
# Anchor CLI 0.28.0 (tag)
cargo install --git https://github.com/coral-xyz/anchor --tag v0.28.0 anchor-cli

# Solana CLI 1.16.25
sh -c "$(curl -sSfL https://release.solana.com/v1.16.25/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Rust 1.68.0
rustup toolchain install 1.68.0
rustup default 1.68.0

# Build and deploy (devnet)
cd blockchain/rb_contracts
anchor build -p renaiss_block
anchor deploy -p renaiss_block --provider.cluster devnet
```
- Use Web3Auth-derived wallet for client-side signing (frontend logs pubkey after signup)

## Security Notes
- Never commit private keys
- Use devnet-only keys for testing
- Rotate keys and revoke test tokens regularly

---

## Fee Collection Process
The `mint_nft` instruction in `programs/renaiss_block` accepts a `sale_amount` in lamports and transfers a platform fee equal to `PLATFORM_FEE_BPS` (e.g., 1000 = 10%) of `sale_amount` to `PLATFORM_WALLET_PUBKEY` during the mint. A `Minted` event includes `sale_amount` and `platform_fee_amount` for indexing.

Accounts (current):
- `payer: Signer`
- `mint: Mint`
- `recipient_token: TokenAccount`
- `platform_wallet: SystemAccount`
- `token_program: Program<Token>`
- `system_program: Program<System>`

Parameters:
- `metadata_uri: string`
- `royalties_bps: u16`
- `sale_amount: u64` (lamports)

---

## Quick run: devnet mint test
Use a reliable RPC (QuickNode recommended) and the repository’s platform wallet for testing.

```bash
# From repo root
export ANCHOR_WALLET="/Users/davidsong/repos/songProjects/rB/blockchain/target/platform_wallet.json"
export ANCHOR_PROVIDER_URL="https://autumn-light-thunder.solana-devnet.quiknode.pro/97cc792c89dda353db1332623dc1308ccd0a7f97/"
export PLATFORM_WALLET_PUBKEY="8h3ZjWbGATW9qRzbMm45Zd1jA6dR4G8FCjdckpeWubhV"
export ANCHOR_PROGRAM_ID="9ZACvfz6GNqa7fvtXTbsWUKjgzHUeJwxg4qiG8oRB7eH"
export USE_ALT_PAYER=1
export SKIP_AIRDROP=1
# optional fund amount for alt payer
export FUND_LAMPORTS=300000000
# optional for backend sync
export CONTENT_ID="<content_id_if_available>"
export BACKEND_DIR="/Users/davidsong/repos/songProjects/rB/backend"

npx ts-node --transpile-only blockchain/scripts/mint_test.ts
```

Example successful mint (devnet)

- Transaction signature: YX3AfmRQSAiJ62myAkJ1fbruqYFvaSGNpfEtETRMvLzixMuW1PDbvwhYL6i4bnPAiVSHKWYh6jESzgwmZFHiHjU
- Observed platform wallet balance delta reflects fee transfer as per on-chain logic (PLATFORM_FEE_BPS).

---

## Week 5 Validation Summary

What we validated
- On-chain IDL was upgraded and fetchable; Anchor methods are callable.
- Program now transfers PLATFORM_FEE_BPS (default 1000 = 10%) of `sale_amount` lamports to `PLATFORM_WALLET_PUBKEY` and emits `Minted`.
- Devnet mint succeeded via QuickNode; example tx:
  - YX3AfmRQSAiJ62myAkJ1fbruqYFvaSGNpfEtETRMvLzixMuW1PDbvwhYL6i4bnPAiVSHKWYh6jESzgwmZFHiHjU
- Positive platform delta can be demonstrated by using an alternate payer (set `USE_ALT_PAYER=1` and fund it).

CI setup
- GitHub Actions builds Anchor with Rust 1.82.0 + Anchor 0.31.1, installs SBF tools, runs cargo tests, Django (SQLite) tests, and React Jest tests.
- Optional: set `QUICKNODE_DEVNET_URL` secret if future CI steps need RPC (not required for build-only jobs).

Backend integration
- Feature-flagged path (`FEATURE_ANCHOR_MINT=true`) in Django can call the on-chain method, passing `sale_amount` and returning `tx_sig` when provided `mint` and `recipient_token` accounts.

Next steps
- Add/iterate Rust tests around `Minted` event details as the program evolves.
- Extend on-chain logic to support collaborator splits (post-Week 5 scope).

---

## Week 6: User Testing & Feedback (Planned)

### Objectives
1. **End-to-End Flow Validation** - Test complete creator and collector journeys
2. **UX Feedback Collection** - Identify pain points and improvement opportunities
3. **Performance Testing** - Measure upload times, mint latency, preview rendering
4. **Bug Discovery** - Find edge cases and error scenarios

### Test Scenarios

#### Scenario 1: Creator Happy Path
```bash
# 1. Signup via Web3Auth or manual wallet
# 2. Create content (text/image/video) via /studio
# 3. Customize: price $5, 10 editions, 20% teaser
# 4. Preview with watermark
# 5. Mint with sale_amount=5000000 lamports
# 6. Verify tx_sig and TestFeeLog entry
# 7. Check /api/analytics/fees/ for total
```

**Success Criteria**:
- Time to complete: <10 minutes
- No errors encountered
- Fee accurately calculated (10% of sale_amount)
- Transaction confirmed on-chain

#### Scenario 2: Collector Discovery
```bash
# 1. Browse /search for content
# 2. Filter by genre/type
# 3. View content preview
# 4. Verify teaser shows correctly (limited %)
# 5. (Future) Purchase NFT
```

**Success Criteria**:
- Content discoverable via search
- Preview loads within 2 seconds
- Watermark visible on teaser

#### Scenario 3: Edge Cases
- Large file upload (49MB video)
- Invalid sale_amount (negative, zero, huge)
- Unauthorized mint attempt
- Concurrent minting (race conditions)

### Feedback Collection

**Quantitative Metrics**:
- Task completion rate (%)
- Average time per flow (minutes)
- Error rate (failures per attempt)
- Performance (upload time, mint time)

**Qualitative Feedback**:
- User satisfaction (1-5 stars)
- UX clarity (confusing steps?)
- Feature requests
- Bug reports (severity: critical/high/medium/low)

### Commands for Testing

**Run mint test with fee logging**:
```bash
cd /Users/davidsong/repos/songProjects/rB
export ANCHOR_WALLET="blockchain/target/platform_wallet.json"
export ANCHOR_PROVIDER_URL="https://autumn-light-thunder.solana-devnet.quiknode.pro/97cc792c89dda353db1332623dc1308ccd0a7f97/"
export USE_ALT_PAYER=1
export SKIP_AIRDROP=1
npx ts-node --transpile-only blockchain/scripts/mint_test.ts
```

**Check fee logs**:
```bash
cd backend
source ../venv/bin/activate
python manage.py shell -c "
from rb_core.models import TestFeeLog
logs = TestFeeLog.objects.all().order_by('-created_at')[:10]
for log in logs:
    print(f'Sale: {log.sale_amount_lamports}, Fee: {log.platform_fee_lamports}, BPS: {log.fee_bps}')
"
```

### Deliverables (Week 6)
1. **Testing Report** (`WEEK6_TESTING_REPORT.md`) - User sessions, bugs, metrics
2. **Bug Fixes** - Address critical issues found during testing
3. **UX Improvements** - Low-hanging fruit based on feedback
4. **Updated Documentation** - User guide, FAQ, known limitations

See `WEEK5_FINALIZATION.md` for complete Week 6 task breakdown and timeline.
