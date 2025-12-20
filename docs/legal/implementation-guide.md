# renaissBlock Legal Implementation Guide

This document outlines how to implement legal agreements throughout the renaissBlock user experience.

---

## Document Inventory

| Document | Purpose | When Shown |
|----------|---------|------------|
| Terms of Service | Master agreement | Account creation |
| Privacy Policy | Data practices | Account creation + footer |
| Creator Agreement | Publishing terms | First publish |
| Content Policy | What's allowed | First publish + reporting |
| DMCA Policy | Copyright procedures | Footer + reporting |
| Cookie Policy | Cookie consent | First visit (EU) |

---

## Implementation by User Flow

### 1. First Visit (Pre-Registration)

**Cookie Banner (GDPR/CCPA)**
```
Location: Bottom of screen, overlay
Trigger: First visit from applicable regions
```

Content:
```
We use cookies to improve your experience. 
[Accept All] [Customize] [Reject Non-Essential]
Learn more in our [Cookie Policy]
```

**Footer Links (All Pages)**
```
LEGAL
├── Terms of Service
├── Privacy Policy  
├── Content Policy
├── DMCA / Copyright
└── Cookie Settings
```

---

### 2. Account Registration

**Sign-Up Form**
```
[Name field]
[Email field]
[Password field]

☐ I agree to the Terms of Service and Privacy Policy
   (Links open in modal or new tab)

[Create Account]
```

**Backend Requirements:**
- Store `tos_accepted_at` timestamp
- Store `tos_version` accepted
- Store `privacy_policy_version` accepted
- Log IP address for compliance

**Modal/Page for Terms:**
- Show full Terms of Service
- Scrollable with "I've read this" only enabled after scroll
- Clear "Accept" button at bottom

---

### 3. First Content Publish

**Creator Agreement Gate**
```
Trigger: First time user clicks "Publish" or "Create New Work"
Display: Full-screen modal or dedicated page
```

Content Structure:
```
┌─────────────────────────────────────────────────┐
│  CREATOR AGREEMENT                              │
│                                                 │
│  Before you publish, please review and accept   │
│  our Creator Agreement.                         │
│                                                 │
│  [Scrollable agreement text]                    │
│                                                 │
│  ☐ I own or have rights to content I publish   │
│  ☐ I understand the fee structure (15/12/10%)  │
│  ☐ I agree to the Content Policy               │
│  ☐ I accept collaboration terms                │
│                                                 │
│  [Cancel]              [Accept & Continue]      │
└─────────────────────────────────────────────────┘
```

**Backend Requirements:**
- Store `creator_agreement_accepted_at`
- Store `creator_agreement_version`
- Only needs to be accepted once (unless version updates)

---

### 4. Content Upload

**Copyright Attestation**
```
Location: Upload form, before submit
```

```
☐ I confirm this is my original work OR I have all necessary 
  rights and permissions to publish this content.
  
  Uploading copyrighted content without permission violates our
  Terms of Service and may result in account termination.
```

**Content Rating/Categorization**
```
Content Rating:
○ General Audience
○ Teen (13+)  
○ Mature (18+) - Requires additional acknowledgment

☐ This content complies with our Content Policy
```

**Mature Content Warning (if selected):**
```
You've marked this content as Mature (18+).

Please confirm:
☐ Content will be age-gated and excluded from general discovery
☐ I understand mature content restrictions
☐ Content does not violate prohibited content rules

[Continue]
```

---

### 5. Collaboration Flow

**Invitation Acceptance**
```
Trigger: When accepting a collaboration invitation
```

```
┌─────────────────────────────────────────────────┐
│  JOIN COLLABORATION                             │
│                                                 │
│  [Creator Name] has invited you to collaborate  │
│  on "[Project Title]"                           │
│                                                 │
│  Proposed Revenue Split:                        │
│  • [Creator Name]: 60%                          │
│  • You: 40%                                     │
│                                                 │
│  By joining, you agree:                         │
│  • Revenue splits are enforced automatically    │
│  • Changes require unanimous consent            │
│  • Published work requires all collaborators    │
│    to agree on removal                          │
│  • See full Collaboration Terms                 │
│                                                 │
│  ☐ I understand and accept these terms          │
│                                                 │
│  [Decline]              [Accept & Join]         │
└─────────────────────────────────────────────────┘
```

**Split Agreement (Before Publishing)**
```
Before publishing collaborative work:

REVENUE SPLIT AGREEMENT

This split will be permanently recorded and automatically 
enforced for all sales of this work.

Creator A (you): 60%
Creator B: 40%

Total: 100% ✓

⚠️ This cannot be changed after publishing without 
   unanimous consent from all collaborators.

☐ All collaborators have agreed to this split
☐ I understand this is binding

[All parties must confirm before publishing]
```

---

### 6. Purchase Flow

**Checkout Confirmation**
```
Location: Before payment processing
```

```
Order Summary
─────────────
"[Content Title]" by [Creator]
Price: $X.XX

By completing this purchase, you acknowledge:
• This is a digital product delivered electronically
• All sales are final (see refund policy)
• You receive a personal license, not ownership
• Redistribution is prohibited

[Terms of Purchase]

[Complete Purchase]
```

**Post-Purchase Confirmation:**
```
Purchase Complete! ✓

"[Content Title]" has been added to your library.

Your purchase grants you a personal license to access 
and enjoy this content. See our Terms of Service for 
full details on purchaser rights.

[Go to Library] [Continue Browsing]
```

---

### 7. Wallet Creation

**Wallet Setup Disclosure**
```
Trigger: When user first creates/connects wallet
```

```
┌─────────────────────────────────────────────────┐
│  PAYMENT WALLET SETUP                           │
│                                                 │
│  Your earnings will be sent to a digital wallet │
│  we create for you.                             │
│                                                 │
│  Important Information:                         │
│                                                 │
│  • Keep your recovery phrase safe and private   │
│  • Lost credentials may result in lost funds    │
│  • Transactions are generally irreversible      │
│  • You're responsible for wallet security       │
│                                                 │
│  ☐ I understand wallet security is my           │
│    responsibility                               │
│  ☐ I will securely store my recovery phrase     │
│                                                 │
│  [Learn More]           [Continue Setup]        │
└─────────────────────────────────────────────────┘
```

---

### 8. Reporting Flow

**Report Content**
```
Trigger: "Report" button on any content
```

```
Report This Content
───────────────────

Why are you reporting this?

○ Copyright infringement (my work was used without permission)
○ Plagiarism (this copies another creator's work)
○ Prohibited content (violates Content Policy)
○ Misleading/fraudulent
○ Other

[Description field]

For copyright claims, you'll be guided through our 
DMCA process. False reports may result in account action.

[Cancel] [Submit Report]
```

**DMCA Flow (if copyright selected):**
```
COPYRIGHT INFRINGEMENT REPORT
─────────────────────────────

This begins a formal DMCA takedown process. 
Please only continue if you are the copyright owner 
or authorized to act on their behalf.

False claims may result in legal liability.

Step 1: Your Information
[Name, Email, Address fields]

Step 2: Original Work
[Description of copyrighted work]

Step 3: Infringing Content  
[URL of content on renaissBlock]

Step 4: Declarations
☐ I have a good faith belief this use is not authorized
☐ The information is accurate, under penalty of perjury
☐ I am the copyright owner or authorized representative

[Electronic Signature field]

[Cancel] [Submit DMCA Notice]
```

---

### 9. Terms Updates

**When Terms Change**
```
Trigger: Login after terms update
Display: Modal, cannot be dismissed without action
```

```
┌─────────────────────────────────────────────────┐
│  UPDATED TERMS OF SERVICE                       │
│                                                 │
│  We've updated our Terms of Service.            │
│  Key changes:                                   │
│                                                 │
│  • [Summary of change 1]                        │
│  • [Summary of change 2]                        │
│  • [Summary of change 3]                        │
│                                                 │
│  [View Full Terms] [View Diff/Changes]          │
│                                                 │
│  By continuing to use renaissBlock, you agree   │
│  to the updated terms.                          │
│                                                 │
│  [I Accept]                                     │
│                                                 │
│  Questions? Contact support@renaissblock.com    │
└─────────────────────────────────────────────────┘
```

---

## Database Schema Requirements

```sql
-- User legal acceptance tracking
CREATE TABLE user_legal_acceptances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    document_type VARCHAR(50),  -- 'tos', 'privacy', 'creator_agreement', etc.
    document_version VARCHAR(20),
    accepted_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Document versions
CREATE TABLE legal_documents (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50),
    version VARCHAR(20),
    content TEXT,
    summary_of_changes TEXT,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Collaboration agreements (on-chain reference)
CREATE TABLE collaboration_agreements (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES content(id),
    agreement_hash VARCHAR(64),  -- Hash of terms stored on-chain
    all_parties_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

```
POST /api/legal/accept
Body: { document_type, version }
Response: { accepted: true, timestamp }

GET /api/legal/check-acceptance
Query: ?document_type=tos
Response: { accepted: true, version: "1.2", accepted_at: "..." }

GET /api/legal/documents/{type}
Response: { content, version, effective_date }

GET /api/legal/pending-acceptances
Response: [{ document_type, version, required: true }]
```

---

## Component Structure (React)

```
src/
├── components/
│   └── legal/
│       ├── LegalModal.tsx           # Reusable modal wrapper
│       ├── TermsAcceptance.tsx      # ToS + Privacy at signup
│       ├── CreatorAgreement.tsx     # First publish gate
│       ├── CollaborationTerms.tsx   # Collab acceptance
│       ├── CopyrightAttestation.tsx # Upload confirmation
│       ├── WalletDisclosure.tsx     # Wallet setup warning
│       ├── PurchaseTerms.tsx        # Checkout acknowledgment
│       ├── CookieBanner.tsx         # GDPR cookie consent
│       ├── DMCAReportForm.tsx       # Copyright reporting
│       └── TermsUpdateModal.tsx     # Version update notice
│
├── pages/
│   └── legal/
│       ├── TermsOfService.tsx
│       ├── PrivacyPolicy.tsx
│       ├── ContentPolicy.tsx
│       ├── DMCAPolicy.tsx
│       ├── CreatorAgreement.tsx
│       └── CookiePolicy.tsx
│
├── hooks/
│   ├── useLegalAcceptance.ts        # Check/record acceptance
│   └── useLegalGate.ts              # Block UI until accepted
│
└── contexts/
    └── LegalContext.tsx             # Track acceptance state
```

---

## Priority Implementation Order

1. **Immediate (Pre-Launch)**
   - Terms of Service page
   - Privacy Policy page
   - Sign-up acceptance checkbox
   - Footer links

2. **Before Beta Opens**
   - Creator Agreement modal
   - Copyright attestation on upload
   - Basic DMCA page
   - Cookie banner (if EU users)

3. **Before Collaborations Go Live**
   - Collaboration terms acceptance
   - Split agreement confirmation
   - Joint removal policies

4. **Before Payments Go Live**
   - Wallet disclosure
   - Purchase terms at checkout
   - Tax information collection

5. **Ongoing**
   - Terms update notification system
   - Version tracking
   - Acceptance audit logs

---

## Testing Checklist

- [ ] New user cannot proceed without accepting ToS
- [ ] ToS version is tracked per user
- [ ] Creator cannot publish without Creator Agreement
- [ ] Upload requires copyright attestation
- [ ] Collaborators must accept terms before joining
- [ ] Split agreement requires all-party confirmation
- [ ] Wallet setup shows risk disclosure
- [ ] Purchase shows terms before payment
- [ ] DMCA form collects required information
- [ ] Terms updates force re-acceptance
- [ ] All legal pages accessible from footer
- [ ] Cookie consent works for EU visitors
- [ ] Acceptance timestamps are logged
- [ ] Admin can view acceptance history
