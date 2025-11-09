# renaissBlock (rB)

**The Future of Creative Collaboration**

A decentralized platform for collaborative content creation with trustless revenue splits on the Solana blockchain.

---

## 🚀 Quick Start

### Development Setup

1. **Backend (Django + Solana)**
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

2. **Frontend (React + Vite)**
```bash
cd frontend
npm install
npm run dev
```

3. **Environment Configuration**
   - Copy `backend/.env.example` to `backend/.env`
   - Set required environment variables (see Security section)

---

## 🔒 Security Status

✅ **READY FOR BETA LAUNCH**

All security vulnerabilities have been resolved:
- 5/5 CRITICAL issues fixed
- 8/8 HIGH severity issues fixed
- 6/6 MEDIUM severity issues fixed
- 3/3 LOW severity issues fixed

See [`docs/SECURITY_AUDIT_REPORT.md`](docs/SECURITY_AUDIT_REPORT.md) for full audit details.

---

## 📁 Project Structure

```
rB/
├── backend/          # Django REST API + Solana integration
│   ├── rb_core/      # Core app (models, views, utils)
│   ├── renaissBlock/ # Django settings
│   └── media/        # User uploads
├── frontend/         # React SPA with Vite
│   └── src/
│       ├── pages/    # Page components
│       ├── services/ # API clients
│       └── App.tsx   # Main app
├── docs/             # 📚 All documentation (organized)
└── README.md         # You are here
```

---

## 📚 Documentation

All documentation has been organized in the [`docs/`](docs/) folder:

- **[Security Reports](docs/)** - Security audit and fixes
- **[Features](docs/features/)** - Feature implementations
- **[Bug Fixes](docs/fixes/)** - Bug fix documentation
- **[Guides](docs/guides/)** - Setup and usage guides
- **[Development Logs](docs/dev-logs/)** - Weekly progress logs

See [`docs/README.md`](docs/README.md) for full documentation index.

---

## 🎯 Core Features

### ✅ Completed
- 📚 **Book Creation & Editing** - Rich text editor with chapter management
- 🎨 **Cover Art Generation** - AI-powered book covers
- 🔐 **Web3Auth Integration** - Keyless wallet authentication
- 💰 **Fiat Payments** - Stripe integration for purchases
- 👥 **Collaboration System** - Multi-author projects with revenue splits
- 🔔 **Real-time Notifications** - WebSocket-based updates
- 🔍 **Search & Discovery** - Content search and filtering
- 📖 **Reading Experience** - Progress tracking and bookmarks
- 🚀 **Beta Landing Page** - Public-facing marketing site

### 🔮 Planned
- ⛓️ **NFT Minting** - Mint books as Solana NFTs (Metaplex)
- 💎 **Secondary Sales** - Creator royalties on resales
- 🏆 **Creator Analytics** - Earnings and engagement metrics
- 🌐 **IPFS Storage** - Decentralized content storage

---

## 🛠️ Technology Stack

### Backend
- **Framework:** Django 5.2 + Django REST Framework
- **Database:** SQLite (dev), PostgreSQL (production)
- **Blockchain:** Solana (devnet) via solana-py
- **Authentication:** Web3Auth + Django Allauth
- **Payments:** Stripe
- **Security:** CSP, rate limiting, input validation

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Inline styles (dark theme)
- **Security:** DOMPurify for XSS prevention

### Infrastructure
- **Version Control:** Git
- **Deployment:** TBD (Vercel/Railway recommended)

---

## 🔐 Security

### Pre-Production Checklist

Before deploying to production, ensure:

1. **Environment Variables Set:**
   ```bash
   DEBUG=False
   DJANGO_SECRET_KEY=<generate-new-key>
   ALLOWED_HOSTS=<your-domain.com>
   CORS_ORIGINS=https://<your-domain.com>
   STRIPE_SECRET_KEY=<live-key>
   WEB3AUTH_CLIENT_ID=<production-client-id>
   ```

2. **Web3Auth Configuration:**
   - Add production domain to allowed origins
   - Rotate Client ID for production use

3. **Infrastructure:**
   - Enable HTTPS/TLS 1.3
   - Configure firewall
   - Set up monitoring and logging

See [`docs/SECURITY_FIXES_SUMMARY.md`](docs/SECURITY_FIXES_SUMMARY.md) for complete security hardening details.

---

## 📝 License

Proprietary - All rights reserved

---

## 🤝 Contributing

This is a private project. Contributions are by invitation only.

---

## 📧 Contact

For questions or support, contact the development team.

---

**Last Updated:** November 8, 2025
**Status:** Beta Ready ✅
