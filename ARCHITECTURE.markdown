# renaissBlock High-Level Architecture

## Overview
renaissBlock employs a hybrid web-blockchain architecture: React frontend for user interactions, Django backend for APIs and admin, PostgreSQL for off-chain data, and Rust/Anchor on Solana for NFT/smart contract logic. Content is stored decentrally (IPFS/Arweave), with NFTs as access keys. Fiat integrations (MoonPay/Ramp) handle conversions, and Web3Auth manages wallets keylessly.

## Core Layers Integration
- **Crypto Layer**: Seamless fiat-to-SOL conversions via on-ramps; Web3Auth hides wallet complexities; smart contracts enforce minting, splits, and royalties without user awareness of blockchain.
- **Consumer Layer**: React-driven feeds and previews mimic Netflix/YouTube; personalized follows/favorites stored in Postgres; teasers served directly, full access gated by NFT unlocks.
- **Creator Layer**: Django-powered dashboards for analytics (Coinbase-like); profile/search tools (LinkedIn-style) with in-house messaging; built-in editor (Substack-like) for content creation, integrated with minting flows.

## Diagram Description (Visualize in Draw.io)
- **Frontend (React)**: Handles UI flows (browsing, minting modals); connects to backend APIs and Solana via Web3.js.
- **Backend (Django)**: Manages user auth (with Web3Auth), content metadata, search/collaboration logic; triggers blockchain actions.
- **Database (Postgres)**: Stores profiles, collaborations, off-chain metadata (e.g., teaser links).
- **Blockchain Layer (Rust/Anchor)**: Deploys smart contracts for minting, revenue splits (including platform fee), royalties.
- **Storage Layer**: IPFS for full content; teasers served via backend.
- **Integrations**:
  - Fiat: Ramp APIs for conversions.
  - Auth: Web3Auth for seamless wallet creation.
- **Data Flow Example**: Consumer unlocks → Fiat API → SOL to wallet → Mint NFT (Anchor) → IPFS access.

## Key Interactions
- Public Teaser Browse: React fetches from Django (no blockchain).
- Full Unlock: React triggers Web3Auth → Fiat modal → Anchor mint → IPFS view.
- Collaboration Mechanics: Django search → Invite → Co-mint via Anchor (splits enforced).