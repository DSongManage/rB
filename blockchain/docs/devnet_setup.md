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

3) Build Anchor programs (rb_contracts and renaiss_block)
```
cd blockchain
anchor build
```

4) Test locally
```
cd blockchain/programs/renaissBlock
cargo test
```

5) Deploy renaiss_block (when ready)
```
# Generate a platform wallet and configure env
python3 blockchain/scripts/generate_wallet.py

# Ensure Anchor provider is using devnet
solana config set --url https://api.devnet.solana.com

# Build and deploy with devnet cluster
anchor build
ANCHOR_WALLET=blockchain/target/platform_wallet.json anchor deploy --provider.cluster devnet -p renaiss_block

If local build fails due to toolchain issues, use Docker for a reproducible build:

```
cd blockchain/rb_contracts
docker run --rm -v $PWD:/work -w /work -v $HOME/.config/solana:/root/.config/solana \
  -e ANCHOR_WALLET=/work/../target/platform_wallet.json \
  -e ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
  projectserum/build:v0.28.0 anchor build

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
- Use Web3Auth-derived wallet for client-side signing (frontend logs pubkey after signup)

## Security Notes
- Never commit private keys
- Use devnet-only keys for testing
- Rotate keys and revoke test tokens regularly
