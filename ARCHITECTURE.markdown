# renaissBlock High-Level Architecture

## Overview
renaissBlock employs a hybrid web-blockchain architecture: React frontend for user interactions, Django backend for APIs and admin, PostgreSQL for off-chain data, and Rust/Anchor on Solana for NFT/smart contract logic. Content is stored decentrally (IPFS/Arweave), with NFTs as access keys. Fiat integrations (MoonPay/Ramp) handle conversions, and Web3Auth manages wallets keylessly.

## Core Layers Integration
- **Crypto Layer**: Seamless fiat-to-SOL conversions via on-ramps; Web3Auth hides wallet complexities; smart contracts enforce minting, splits, and royalties without user awareness of blockchain.
- **Consumer Layer**: React-driven feeds and previews mimic Netflix/YouTube; personalized follows/favorites stored in Postgres; teasers served directly, full access gated by NFT unlocks.
- **Creator Layer**: Django-powered dashboards for analytics (Coinbase-like); profile/search tools (LinkedIn-style) with in-house messaging; built-in editor (Substack-like) for content creation, integrated with minting flows.

## Diagram Description (Visualize in Draw.io)
- **Frontend (React + Vite)**: Handles UI flows (browsing, minting modals); connects to backend APIs and Solana via Web3.js. Uses Vite for fast development and optimized production builds. Build output: `dist/` directory.
- **Backend (Django)**: Manages user auth (with Web3Auth), content metadata, search/collaboration logic; triggers blockchain actions. Serves React SPA in production from `frontend/dist/`.
- **Database (Postgres)**: Stores profiles, collaborations, off-chain metadata (e.g., teaser links).
- **Blockchain Layer (Rust/Anchor)**: Deploys smart contracts for minting, revenue splits (including platform fee), royalties.
- **Storage Layer**: IPFS for full content; teasers served via backend.
- **Integrations**:
  - Fiat: Ramp APIs for conversions.
  - Auth: Web3Auth Modal SDK on the frontend; verify ID token with JWKS on backend; use Sapphire Devnet during development.
  - Platform Wallet: All mints allocate a platform fee (bps-configurable) to `settings.PLATFORM_WALLET_ADDRESS`.
- **Data Flow Example**: Consumer unlocks → Fiat API → SOL to wallet → Mint NFT (Anchor) → IPFS access.

## Key Interactions
- Public Teaser Browse: React fetches from Django (no blockchain).
- Full Unlock: React triggers Web3Auth → Fiat modal → Anchor mint → IPFS view.
- Collaboration Mechanics: Django search → Invite → Co-mint via Anchor (splits enforced).

## Mobile Expansion Strategy (Future)
The web app is built with mobile-first responsive design. For native mobile experiences:

### Progressive Web App (PWA)
- Install `vite-plugin-pwa` to generate service workers and manifest
- Enable offline caching for teasers and UI assets
- Add to home screen functionality for iOS/Android
- Setup commands:
  ```bash
  cd frontend
  npm install vite-plugin-pwa -D
  # Update vite.config.ts to include PWA plugin
  ```

### Native App with Capacitor
For full native features (push notifications, biometrics, etc.):
- Use Capacitor to wrap the React app as iOS/Android native apps
- Reuse 100% of the existing React codebase
- Setup commands:
  ```bash
  cd frontend
  npm install @capacitor/core @capacitor/cli
  npx cap init renaissBlock com.renaissblock.app
  npx cap add ios
  npx cap add android
  npm run build && npx cap sync
  npx cap open ios  # or android
  ```
- Capacitor plugins available for:
  - Web3Auth integration (existing modal works in WebView)
  - Solana wallet adapters
  - Push notifications via Firebase
  - Biometric authentication
  - Camera for profile/content uploads

**Recommendation**: Start with PWA for quick mobile iteration, then add Capacitor when native features are required.