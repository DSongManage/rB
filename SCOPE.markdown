# renaissBlock Project Scope

## 1. Project Overview
- **Project Name**: renaissBlock
- **Mission Statement**: To create a decentralized platform that enables users to mint NFTs from any digital content (e.g., books, art, videos), facilitating seamless publishing, fair revenue sharing via smart contracts, and accessible monetization. The app democratizes content creation by allowing public teaser access while gating full content behind NFT ownership, with a non-technical user experience that conceals blockchain complexities.
- **Objectives**:
  - Empower creators with tools for publishing, collaborating, and earning without traditional intermediaries.
  - Provide consumers with an engaging discovery experience for diverse media, using familiar payment methods.
  - Ensure sustainability through a tiered platform fee model that incentivizes growth based on sales volume.
- **Scope Boundaries**:
  - In Scope: NFT minting from uploads, collaboration search/invites for multiple contributors, teaser/full content access, fiat-to-crypto on-ramps, decentralized storage, and basic analytics.
  - Out of Scope (MVP): Advanced AI recommendations, multi-chain support, physical asset integrations, or multi-format previews.
- **Assumptions**: Users have basic internet access; fiat conversions comply with regional regulations; initial focus on Solana for low fees; limited to U.S. users initially.
- **Constraints**: Solo development; budget under $500/month for MVP (bootstrapped approach); MVP launch in 3-4 months.
- **Core Layers**:
  - **Crypto Layer**: Designed to be seamless and invisible to users unfamiliar with blockchain. Consumers can purchase NFTs using fiat methods (e.g., credit card or Apple Pay) via Ramp Network, without perceiving the underlying crypto transactions, similar to buying books or movies online.
  - **Consumer Layer**: Provides an immersive browsing and consumption experience akin to Netflix, Kindle, or YouTube, where users can follow creators, create favorite lists, and engage with content in a personalized, subscription-like manner.
  - **Creator Layer**: Offers a professional environment for profile creation and networking, resembling LinkedIn for collaboration outreach (e.g., invites and in-house messaging) and Substack for direct content authoring, allowing creators to build resumes, connect with multiple peers, and mint work efficiently.

## 2. User Personas and Journeys
- **Consumer Persona**: "Casual Explorer" (e.g., a 25-45-year-old U.S.-based enthusiast browsing for books/art). Goals: Discover content easily, access full versions without crypto hassle. Journey: Land on home → Browse teasers → Fiat Modal → View full content.
- **Creator Persona**: "Indie Collaborator" (e.g., a U.S.-based author/artist seeking partners). Goals: Publish work, find multiple collaborators, manage earnings. Journey: Login → Dashboard → Upload & Mint → Search collaborators → Co-mint with splits → View revenue.
- **High-Level Journeys**:
  - Consumer: Public browse (teasers) → Prompt for unlock → Fiat modal → NFT purchase → View full content.
  - Creator: Profile setup → Content creation (direct writing/uploads) → Mint solo/co-mint → Set splits (platform fee auto-deducted) → Payouts.

## 3. Features List (MVP and Future)
- **MVP Features**:
  - **Authentication & Onboarding**: Web3Auth for wallet creation (keyless, no private key storage); public teaser access; full unlock prompts fiat-to-SOL conversion via Ramp Network (seamless UI: "Pay with Card/Apple Pay").
  - **Content Upload & NFT Minting**: Upload diverse formats (e.g., PDF, images, MP4; initial size limit: 50MB); auto-generate teasers (customizable by creator, max 1,000 words for text, watermarked images, uploader-provided trailers for videos); mint NFT as access key using Rust/Anchor (Solana); store full content on IPFS. Creators can opt for free content access (e.g., PDF download/read-only) without NFT minting to avoid gas costs, with customizable settings guided by on-publish prompts.
  - **Browsing/Discovery (Consumer Side)**: Genre/medium feeds with teasers; search with filters; personalized follows/favorites (post-login).
  - **Creator Dashboard**: Analytics including tiered revenue visibility based on sales volume; payout requests (fiat/crypto).
  - **Collaboration Tools**: Profile-based search (skills/genres) for multiple collaborators (e.g., artist, director, editor); invites with proposed splits; co-mint workflow.
  - **Revenue & Monetization**: Smart contracts for splits (platform fee starts at 10%, dynamically reduced based on sales volume: 10% < $500/month, 8% $500-$5,000, 5% > $5,000); royalties on resales; transparent tracking.
  - **Payments & Access**: Fiat on-ramps via Ramp for SOL; NFT as decryption key for stored content (client-side).
- **Future Features**:
  - AI-enhanced search/recommendations; in-app messaging; advanced tiers (e.g., bonus features for top creators); multi-format previews.

## 4. Technical Architecture
- **Frontend (React)**: Dynamic components for feeds, modals (fiat/Web3Auth), and dashboards; integrate Solana Web3.js for transactions.
- **Backend (Django)**: APIs for user data, search, metadata; handle fiat callbacks via Ramp; moderation queue.
- **Blockchain (Rust/Anchor)**: Smart contracts for minting, splits (supporting multiple collaborators), royalties.
- **Database (Postgres)**: Store profiles, collaborations, off-chain metadata (e.g., teaser links).
- **Integrations**:
  - Auth: Web3Auth (keyless wallets).
  - Fiat: Ramp Network APIs for conversions.
  - Storage: IPFS for decentralized content; NFTs hold access URIs/keys.
- **Security**: No key storage; encrypt teasers; audit contracts.

## 5. Risks and Mitigations
- **Tech Risks**: Integration delays (e.g., fiat APIs)—mitigate with phased testing.
- **Product Risks**: Low adoption—validate with beta; crypto aversion—hide via seamless UI.
- **Legal**: IP disputes, regulatory changes—include terms of service; consult expert if needed.
- **Operational**: Storage costs—use free tiers initially; scalability—monitor Solana fees.

## 6. Timeline Blueprint
- **Week 1-2**: Refine scope (features, wireframes in Figma).
- **Week 3-4**: Set up repo, environments; prototype core (e.g., minting flow).
- **Month 2**: Build MVP features, test integrations.
- **Month 3**: Beta launch, iterate based on feedback.