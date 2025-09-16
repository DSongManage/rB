# renaissBlock Requirements Specification

## Functional Requirements
- **FR1**: System shall allow public users to browse teaser content without authentication.
- **FR2**: System shall prompt users for full access via a seamless fiat-to-crypto conversion process using Ramp Network, supporting methods like credit cards or Apple Pay, with minimal friction to ensure a smooth, non-crypto experience.
- **FR3**: System shall utilize Web3Auth for keyless wallet creation, ensuring no storage of private keys on the platform.
- **FR4**: System shall enable creators to upload content in various formats (e.g., PDF, images, MP4) and generate customizable teasers (e.g., percentage-based for text up to 1,000 words max, watermarked for images with removal post-purchase, uploader-provided trailers for videos). Creators shall have the option to post free content for direct access (e.g., PDF download or read-only view) without NFT minting to avoid gas costs, with customizable settings (e.g., optional watermarks) guided by on-publish prompts (e.g., dropdown options on "Publish" button).
- **FR5**: System shall mint NFTs as access keys using Rust/Anchor on Solana, with full content stored on IPFS.
- **FR6**: System shall support genre/medium-based browsing with search filters and personalized feeds for logged-in users. Consumers shall be able to provide feedback via a thumbs up/thumbs down system post-purchase to influence creator tiers and recommendations.
- **FR7**: System shall provide creator dashboards with analytics, including tiered revenue visibility based on sales volume (10% fee < $500/month, 8% $500-$5,000, 5% > $5,000) and payout requests in fiat or crypto, displayed in the profile with in-app notifications for tier upgrades.
- **FR8**: System shall facilitate creator collaboration through profile-based search (skills/genres) for multiple collaborators (e.g., artist, director, editor), invites with proposed generic contract templates (default 50/50 split, editable for multiple contributors), and co-minting with customizable revenue splits.
- **FR9**: System shall enforce revenue splits via smart contracts, deducting a platform fee dynamically adjusted based on sales volume (10% < $500/month, 8% $500-$5,000, 5% > $5,000) to sustain operations, with no charity allocation.
- **FR10**: System shall decrypt and display full content client-side using NFT keys (post-purchase).
- **FR11**: System shall provide a built-in editor for creators to write and save content directly on the platform, enabling direct minting of such work as NFTs. Alternatively, the system shall support uploading content from external sources (e.g., Word documents, Google Docs) for publishing and minting.
- **FR12**: System shall support serialized content publication, allowing authors to mint NFTs chapter by chapter, with collaborators able to release collaborative "episodes" on a weekly basis (post-MVP priority; initial release to support single NFT minting with optional chapter/series metadata).
- **FR13**: System shall allow creators to customize NFTs by setting limited edition quantities (e.g., up to 10,000 units) and an initial sale price (IPO-like), with smart contracts distributing a portion of secondary market sales as royalties to original creators, proportional to their contribution. Creators can manually set bundle prices without platform fee adjustments.
- **FR14**: System shall enforce Terms and Conditions, prohibiting content uploads that include pornography or are unsuitable for users under 18, with automated moderation and user flagging options. Access shall be limited to U.S.-based users initially.

## Non-Functional Requirements
- **NFR1**: Response time for NFT minting and content loading shall be under 5 seconds.
- **NFR2**: System shall support up to 1,000 concurrent users in MVP, with scalability provisions.
- **NFR3**: Interface shall be responsive across devices, with dark/light modes for accessibility.
- **NFR4**: Security: Compliance with relevant regulations (e.g., no key storage, encrypted transmissions); implement moderation for uploaded content.
- **NFR5**: Reliability: 99% uptime; error handling for failed fiat conversions or mints.
- **NFR6**: Usability: Non-technical UX, hiding blockchain elements (e.g., "Pay with Card" instead of "Connect Wallet").
- **NFR7**: Performance: Low transaction fees via Solana; optimize storage costs with free tiers initially.