# renaissBlock - Feature Documentation

Complete feature documentation for the renaissBlock platform.

---

## 📚 Book Management

### Book Editor
- Rich text editing with chapter management
- Create, edit, and reorder chapters
- Auto-save functionality
- Draft and published states
- Word count tracking
- Chapter navigation

### Book Cover Art
- Upload custom cover images
- Image preview and cropping
- Supported formats: JPG, PNG, WebP
- Automatic optimization
- Fallback to generated covers

### Publishing Workflow
1. Create book with title and description
2. Add chapters with content
3. Upload cover art (optional)
4. Preview before publishing
5. Publish to make visible to readers
6. Unpublish to return to draft state

### Reading Interface
- Clean, distraction-free reading experience
- Text wrapping and formatting
- Chapter navigation
- Reading progress tracking
- Bookmark support
- Responsive design for all devices

### Library Management
- View all owned and published books
- Book cover thumbnails in grid view
- Filter by status (published/unpublished)
- Search by title or author
- Reading progress indicators

---

## 👥 Collaboration System

### Multi-Author Collaboration
- Invite co-authors to collaborate on books
- Role-based permissions (owner/collaborator)
- Owner controls publishing and major decisions
- Collaborators can edit content and participate

### Invite System
- Send invites by username or email
- Pending/accepted invite states
- Accept or decline invitations
- View all active collaborations

### Comments & Discussions
- Leave comments on collaboration projects
- React to comments with emoji reactions
- Attach files to comments (images, documents)
- Real-time comment updates
- Thread-based discussions

### Notifications
- Real-time notification system
- Notifications for:
  - New collaboration invites
  - Invite acceptance/rejection
  - New comments on your projects
  - Comment reactions
  - NFT minting completion
- Mark as read/unread
- In-app notification center

---

## 🎨 NFT Minting

### Individual NFT Minting
- Mint published books as Solana NFTs
- Cost: 100 credits per mint
- Platform takes 10% fee (10 credits to platform wallet)
- Author receives 90% (90 credits)
- Metadata stored on-chain using Metaplex standard
- NFT includes book title, author, cover art

### Collaborative NFT Minting
- Co-authors can collectively mint books as NFTs
- Cost split among collaborators
- Profits distributed based on contribution
- All co-authors must approve minting
- Transparent profit sharing model
- On-chain proof of collaboration

### Metadata Standard
```json
{
  "name": "Book Title",
  "symbol": "BOOK",
  "description": "Book description",
  "image": "https://...",
  "attributes": [
    {"trait_type": "Author", "value": "Author Name"},
    {"trait_type": "Chapters", "value": "10"},
    {"trait_type": "Published", "value": "2025-11-09"}
  ]
}
```

---

## 💳 Payment & Credits

### Credit System
- Platform currency for all transactions
- 1 credit = $0.10 USD
- Credits never expire
- View balance in user profile
- Transaction history available

### Purchasing Credits
- Buy credits with Stripe (credit card, debit card)
- Test mode for beta (use card 4242 4242 4242 4242)
- Instant credit delivery
- Secure payment processing
- No minimum purchase

### Spending Credits
- Buy books: Variable price set by author
- Mint NFTs: 100 credits per mint
- Future: Unlock premium features

### Platform Fees
- 10% platform fee on all NFT mints
- No fees on book purchases
- Transparent fee structure

---

## 🔐 Authentication & Security

### Web3Auth Integration
- Multiple login methods:
  - Google account
  - Email (passwordless)
  - Social accounts (Facebook, Twitter, etc.)
  - Wallet connection
- No seed phrases required
- User-friendly onboarding
- Secure key management

### Session Management
- HTTP-only secure cookies
- CSRF protection on all state-changing operations
- Automatic session refresh
- Secure logout
- No client-side token storage

### Data Security
- SQL injection protection via Django ORM
- XSS prevention with React and sanitization
- File upload validation
- Rate limiting on authentication
- HTTPS enforcement in production

---

## 🚀 Beta Access Management

### Beta Landing Page
- Feature showcase with animations
- Technology stack display
- Request beta access form
- FAQ section
- Social links

### Invite Code System
- Controlled beta access
- Admin approval workflow
- Unique invite codes per user
- Email invitations
- Code validation during registration

### Beta User Experience
- Beta badge in header
- Test mode warnings (Stripe test mode, Solana devnet)
- In-app feedback button
- Welcome onboarding for new users
- Beta testing guidelines

### Feedback Collection
- In-app feedback modal
- Anonymous or authenticated feedback
- Sent directly to admin email
- Bug reporting encouraged
- Feature request collection

---

## 🔍 Discovery & Search

### Search Functionality
- Search books by title
- Search books by author
- Filter by published status
- Real-time search results
- Responsive search UI

### Book Discovery
- Browse all published books
- View book details
- Preview book content
- See author information
- View NFT status

---

## 👤 User Profiles

### Profile Management
- Custom avatar upload
- Username and display name
- Bio and description
- Social links
- Wallet address display

### Public Profiles
- View other users' published books
- See collaboration projects
- View NFT collection (future)
- Follow/unfollow (future)

---

## 🌐 Blockchain Integration

### Solana Network
- Currently: Devnet (beta testing)
- Future: Mainnet for production
- Fast transaction finality
- Low transaction costs
- Scalable NFT minting

### Smart Contracts
- Metaplex Token Metadata Program
- SPL Token program
- Custom NFT minting logic
- Platform wallet for fee collection

### Wallet Integration
- Web3Auth for wallet creation
- No manual wallet setup required
- Automatic wallet assignment
- Secure key management
- Future: External wallet connection (Phantom, Solflare)

---

## 📱 Future Features (Roadmap)

### Phase 2 - Enhanced Discovery
- Recommendation engine
- Genre categorization
- Trending books
- Author rankings
- Review and rating system

### Phase 3 - Marketplace
- Secondary NFT marketplace
- Royalty distribution
- Bid and auction system
- Price history tracking

### Phase 4 - Mobile
- React Native mobile app
- Offline reading
- Push notifications
- Mobile-optimized editor

### Phase 5 - Advanced Features
- Author analytics dashboard
- Reader engagement metrics
- Revenue tracking
- Marketing tools
- A/B testing for book covers

---

## 🛠️ Technical Details

### Frontend
- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- React Router for navigation
- Real-time updates with WebSocket (future)

### Backend
- Django 5.2.6
- Django REST Framework
- PostgreSQL database
- Web3Auth JWT authentication
- Stripe payment integration

### Blockchain
- Solana blockchain
- Metaplex for NFT standards
- Anchor for smart contracts (future)
- IPFS for metadata storage (future)

---

**Last Updated:** 2025-11-10
**Version:** 1.0.0-beta
