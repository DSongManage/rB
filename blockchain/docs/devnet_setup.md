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

3) Build Anchor program (placeholder)
```
cd blockchain
anchor build
```

4) Test locally
```
cd blockchain/programs/renaissBlock
cargo test
```

5) Deploy (when ready)
```
anchor deploy
```

6) Configure renaissBlock backend
- Add the deployed program id to Django settings (e.g., PROGRAM_ID env var)
- Use Web3Auth-derived wallet for client-side signing

## Security Notes
- Never commit private keys
- Use devnet-only keys for testing
- Rotate keys and revoke test tokens regularly
