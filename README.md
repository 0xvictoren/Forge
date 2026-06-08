# Forge

**Forge** is a Web3 creator platform on **Aptos ShelbyNet** with **Shelby** blob storage for files and **MongoDB** for profiles, messages, invoices, and analytics.

Think of it as: **Behance + WeTransfer + wallet-native payments** — upload gated files as **BurnLinks**, discover creators, message clients, and get paid in APT.

---

## What Forge Does (current)

### For anyone (wallet optional)

- **Landing** at `/` — connect wallet when ready
- **Creators** at `/hire` — discover talent by skill or name
- **BurnLinks** at `/b/[slug]` — pay APT to unlock a file (no Forge account required)
- **Public profiles** at `/[handle]`

### After connecting wallet

- **Home** (`/home`) — your BurnLinks dashboard and stats
- **Upload** (`/upload`) — create BurnLinks or public posts (files → Shelby, metadata → MongoDB)
- **Wallet** (`/wallet`) — earned/spent/net/fees, invoices, transaction history
- **Messages** (`/chat`) — DMs with Pusher realtime (stored in MongoDB)
- **Profile setup** (`/onboarding`) — optional; handle, bio, skills, social links (no tiers required)

### Payments model

- **Unlock payments** go **100% to the creator** on-chain
- **5% platform fee** is tracked in the database for reporting (not deducted on-chain from unlocks)
- **Verification badge** — one-time 10 APT to platform treasury
- **Blob owners** unlock their own files for free

### Data storage split

| Data | Where |
|------|--------|
| Profile text, skills, socials, messages, invoices, transactions | **MongoDB** (Prisma) |
| Files, avatars, banners, invoice PDFs | **Shelby blobs** |

---

## Navigation

Top navbar (desktop + mobile): **Home · Wallet · Messages · Creators**

- **Home** → `/` when logged out, `/home` when session exists
- **Wallet / Messages** → require wallet session (auto-synced on connect)
- **Creators** → `/hire` (public)
- **Share Work** → `/upload` (visible when wallet connected)

Profile appears in the **right sidebar** on authenticated pages — not a separate profile route.

---

## Auth

- **Wallet-only** — no email/Gmail registration
- Connect Petra (or compatible wallet) on ShelbyNet
- `POST /api/auth/session` creates a JWT cookie (`forge_session`)
- `WalletSessionSync` keeps the backend session aligned with auto-connected wallets

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js 15 App                           │
│  (React 19 · Tailwind v4 · Wallet Adapter · Pusher client)      │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
    ┌────────▼────────┐             ┌────────▼────────┐
    │  MongoDB Atlas  │             │  Aptos ShelbyNet  │
    │  (Prisma ORM)   │             │  Native APT txs   │
    │                 │             │  CULT Move module │
    │  Users, posts,  │             └────────┬──────────┘
    │  burnlinks,     │                      │
    │  invoices,      │             ┌────────▼──────────┐
    │  social graph,  │             │  Shelby Blob      │
    │  notifications  │             │  Storage (SDK)    │
    └─────────────────┘             │  All media/files  │
                                    └───────────────────┘
```

| Layer | Technology | Stores |
|-------|------------|--------|
| **Frontend** | Next.js 15, React 19, Tailwind v4 | UI, wallet signing |
| **Backend** | Next.js API routes, JWT auth | Business logic |
| **Database** | MongoDB + Prisma | Profiles, posts, social graph, invoices, analytics |
| **On-chain** | Aptos ShelbyNet, CULT Move module | Creator registry, subscriptions, tips (ShelbyUSD in contract) |
| **Payments** | Native APT transfers + tx verification | Tips, unlocks, subscriptions, invoices, verification |
| **Storage** | `@shelby-protocol/sdk` on ShelbyNet | Avatars, banners, uploads, post media, invoice PDFs |
| **Realtime** | Pusher | Chat messages, notifications, invoice payment events |

---

## Design System

Forge uses a warm, professional palette inspired by Behance but branded for Web3:

| Token | Value | Usage |
|-------|-------|-------|
| Brand orange | `#dc5429` | Buttons, accents, labels |
| Text dark | `#313131` | Headings, body text |
| Background | `#d4d4d4` | Page background (no pure white) |
| Elevated surfaces | `#ebebeb` | Cards, modals, navbar |

Typography: **Playfair Display** for display headings, **DM Sans** for UI and body.

---

## Core Features (Detailed)

### 1. Home Feed (`/`)

The main discovery experience:

- **Recommended tab** — public posts and creator content from all users
- **Following tab** — content only from creators you follow
- **Category filter** — Graphic Design, 3D Art, UI/UX, Photography, Motion Design, Illustration, Audio
- **Infinite scroll** with pagination via `/api/feed`
- Behance-style project grid with creator info, engagement stats, and APT pricing

All feed data comes from MongoDB — no mock or placeholder content.

---

### 2. Lobby — Creator Discovery (`/lobby`)

A dedicated hub to find creators:

- Profile picture, username, bio, skill tags
- **Follow / Unfollow** button
- **Search** by name, bio, or handle
- **Skill filter** dropdown
- Pagination / load more
- Accessible from navbar and global search

---

### 3. Hire Page (`/hire`)

Web3 freelancer marketplace landing:

- Orange hero banner with creator search
- Search redirects to Lobby with skill/creator filters
- “Why hire on Forge” and hiring steps sections
- Browse Creators CTA → Lobby

---

### 4. Creator Profiles (`/@handle`)

Behance-style two-column profile layout:

**Header**
- Banner and avatar (always from Shelby when uploaded)
- Display name, verified badge, bio, wallet address
- Follow button (visitors) or Edit Profile (owner)
- Subscribe / Tip / Message actions

**Stats (real data)**
- Posts · Uploads · Followers · Following · Revenue

**Tabs**

| Tab | Contents |
|-----|----------|
| **Work** | Sent invoices, received invoices (owner only), copy payment links |
| **BurnLinks** | Private uploaded files only — thumbnail, type, date, downloads, share |
| **Services** | Skill tags — add, edit, remove, reorder (owner) |

**Posting**
- Inline post composer on own profile (text + media)
- Posts appear on profile, Recommended feed, and Following feed

**Verification**
- “Verify Now” — 10 APT on-chain payment to platform treasury
- Verified badge shown on profile, lobby cards, and invoices

---

### 5. Onboarding (`/onboarding`) — optional

Two-step wizard:

1. **Create your profile** — avatar/banner (Shelby), handle, display name, bio
2. **Skills & social links** — comma-separated skills; optional X, Instagram, Behance, Dribbble, ArtStation

Profile fields save to MongoDB via `POST /api/onboarding`. Skip anytime — you can upload BurnLinks without a profile.

---

### 6. BurnLink — Programmable File Sharing

**Upload** (`/upload?mode=file`) — private files, not shown in public feeds.

**Flow**
1. User selects file (drag-and-drop supported)
2. File uploaded to Shelby Blob Storage via `@shelby-protocol/sdk`
3. BurnLink record created with unique slug
4. Optional: price in APT, max views, burn-after-read, screenshot protection

**Unlock** (`/b/[slug]`)
- Free: instant access token
- Paid: wallet connects → APT transfer to **creator** → tx verified on ShelbyNet → `AccessGrant` in MongoDB
- **Owner** of the blob unlocks for free (no payment)
- API: `POST /api/burnlinks/[slug]/unlock` — always returns JSON `{ success, viewToken, redirect }`

**Secure viewer** (`/view/[slug]?token=...`)
- Streams file from Shelby via `/api/media/shelby` (downloads preserve original file extension)
- Download count and analytics recorded

---

### 7. Public Posts (`/upload?mode=post`)

Twitter/X-style composer:

- Optional text + image, video, or audio
- Category tag for feed filtering
- Upload progress indicator
- Media previews (no filenames shown)
- Stored on Shelby; metadata in MongoDB `Post` model
- Appears in feeds and on creator profile

---

### 8. Subscriptions & Tips

**Subscriptions**
- Creators define up to 3 tiers during onboarding
- Fans subscribe via wallet modal → APT payment → `/api/subscriptions/subscribe`
- On-chain tx verified with retry logic for ShelbyNet indexing delays
- 30-day subscription grants stored in DB

**Tips**
- Preset or custom APT amounts with optional message
- Payment verified on-chain; creator notified

**Note:** The deployed CULT Move module uses **ShelbyUSD** for on-chain subscribe/tip functions. The app currently processes **native APT** transfers with backend verification. Contract is deployed and initialised; full wallet → contract wiring for ShelbyUSD flows can be added incrementally.

---

### 9. Direct Messaging (`/chat`)

- Conversation list and threaded chat UI
- **New DM modal** — following list + username search
- Send text messages and BurnLink attachments
- **Invoice messages** — send invoices through DMs
- Real-time delivery via **Pusher** (`conversation-{id}` channels)
- Message notifications pushed to recipients

---

### 10. Invoicing (`/wallet/invoices`)

Full invoice lifecycle:

**Create**
- Client name, email, description, amount (APT), notes
- Unique invoice ID and payment token generated automatically

**Share**
- **Copy Link** — `/pay/invoice/{token}`
- **Send via DM** — opens conversation with invoice message
- **Download PDF/HTML** — generated with Forge branding, stored on Shelby

**Pay** (`/pay/invoice/[token]`)
- Public payment page with invoice details
- Wallet payment → Aptos tx verification
- Status updates **Pending → Paid** via Pusher (no manual refresh)
- Transaction hash, amount, and payment date recorded

**Profile Work tab**
- Sent and received invoices with status for the profile owner

---

### 11. Wallet Dashboard (`/wallet`)

| Section | Description |
|---------|-------------|
| **Overview** | Total earned, spent, net position, platform fees |
| **Invoices** | Create, list, copy link, send via DM, download |
| **Payouts** | Payout configuration |
| **Transactions** | Full ledger from `/api/wallet/transactions` |

All figures from real `Transaction` records in MongoDB.

---

### 12. Creator Dashboard (`/dashboard`)

**Insights** (moved from Wallet — real analytics only):

- Post views, engagement, downloads, revenue, paid unlocks
- Daily activity chart
- Earnings over time
- Content performance per item

Data sourced from `AnalyticsEvent`, transactions, posts, and creator content — no mock data.

---

### 13. Notifications

Notification center (bell icon in navbar):

| Event | Trigger |
|-------|---------|
| New follower | Someone follows you |
| Direct message | New chat message |
| Invoice paid | Client pays invoice |
| Content purchase | BurnLink unlock / content buy |
| Tip received | Fan sends tip |
| Subscription | New subscriber |
| Post published | Your post goes live |
| Verification complete | Profile verified |

- Unread count badge
- Real-time updates via Pusher (`user-{id}` channel)
- Stored in MongoDB `Notification` model

---

### 14. Follow System

- Follow / unfollow from Lobby, profiles, creator cards
- Follower and following counts on profiles
- Powers **Following feed** tab and DM following list
- Follow events trigger notifications

---

### 15. Global Search

Navbar search with categories:

- **Skills** · **Creators** · **BurnLinks** · **Assets**

Results routed to Lobby with query parameters. Hire page and landing search use the same creator/skill matching.

---

### 16. Verification

- One-time **10 APT** payment to `NEXT_PUBLIC_PLATFORM_ADDRESS`
- Wallet signs transfer → backend verifies tx on ShelbyNet
- `verified` flag persisted with `verificationTxHash` and `verifiedAt`
- Badge displayed on username, profile, posts, lobby cards, invoices

---

## Storage Architecture

All user-generated media uses **Shelby Blob Storage** on ShelbyNet:

| Media type | Storage |
|------------|---------|
| Profile avatar / banner | Shelby blob ref → `shelby:{address}::{path}` |
| BurnLink files | Shelby |
| Post media | Shelby |
| Invoice PDFs | Shelby |
| Message attachments | Shelby |

**Upload flow:** File → `@shelby-protocol/sdk` upload → blob ref saved in MongoDB → served via `/api/media/shelby?ref=...`

**Download flow:** Permission check → Shelby SDK download → stream to client

Off-chain in MongoDB: profiles, invoices, analytics, social graph, notifications, messages.

---

## On-Chain (CULT Move Module)

Deployed on **Aptos ShelbyNet**:

| | |
|---|---|
| **Address** | `0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6` |
| **Module** | `cult::cult` |
| **Publish tx** | [View on Explorer](https://explorer.aptoslabs.com/txn/0xf19ea7c6e4864ba60add5ed86ba3ee197ad9cf887efa90d052c7d715cc6db286?network=shelbynet) |

**Initialised:** `initialize_platform`, `init_user_registry`

**Entry functions available:**
- `register_creator`, `update_profile`, `update_tiers`
- `publish_content`, `edit_content`, `toggle_content`
- `subscribe`, `renew_subscription`, `tip_creator`, `purchase_content`
- `follow_creator`, `unfollow_creator`
- View functions: `has_active_subscription`, `can_access_content`, `get_all_creators`, etc.

Source: `move/sources/cult.move` (from [CULT reference](https://github.com/frianowzki/cult))

Redeploy: `bash scripts/deploy-contract.sh`

---

## Authentication

- **Wallet connect** via Aptos Wallet Adapter (Petra, etc.)
- Session created via `/api/auth/session` with JWT cookie
- Wallet address linked to `User` record in MongoDB
- Protected routes under `app/(app)/` require session

---

## API Reference (Summary)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | POST | Wallet login |
| `/api/feed` | GET | Home feed (recommended/following) |
| `/api/lobby/creators` | GET | Creator discovery |
| `/api/follow` | GET/POST/DELETE | Follow system |
| `/api/burnlinks` | POST | Create BurnLink |
| `/api/burnlinks/[slug]/unlock` | POST | Unlock + payment verify |
| `/api/posts` | POST | Create public post |
| `/api/profile/[handle]` | GET | Full profile data |
| `/api/invoices` | GET/POST | Invoice CRUD |
| `/api/invoices/pay/[token]` | GET/POST | Pay invoice |
| `/api/invoices/[id]/send` | POST | Send invoice via DM |
| `/api/subscriptions/subscribe` | POST | Subscribe to creator |
| `/api/tips` | POST | Send tip |
| `/api/verify` | GET/POST | Verification payment |
| `/api/analytics` | GET | Dashboard insights |
| `/api/notifications` | GET/PATCH | Notifications |
| `/api/conversations` | GET/POST | Chat threads |
| `/api/search` | GET | Global search |
| `/api/media/shelby` | GET | Shelby blob download |
| `/api/media/upload` | POST | Avatar/banner upload |

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing — connect wallet |
| `/home` | Auth | Creator dashboard (BurnLinks, stats) |
| `/hire` | Public | Creators discovery (navbar: Creators) |
| `/lobby` | Public | Redirects to `/hire` |
| `/[handle]` | Public | Creator profile |
| `/b/[slug]` | Public | BurnLink unlock page |
| `/view/[slug]` | Token | Secure file viewer |
| `/pay/invoice/[token]` | Public | Invoice payment |
| `/upload` | Auth | Upload file or create post |
| `/onboarding` | Auth | Optional profile setup |
| `/wallet` | Auth | Wallet overview + invoices |
| `/wallet/invoices` | Auth | Invoice management |
| `/chat` | Auth | Messages |
| `/dashboard` | Auth | Redirects to `/home` |
| `/profile` | Auth | Redirects to `/home` |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS v4, CSS custom properties
- **Database:** MongoDB Atlas + Prisma 5
- **Blockchain:** Aptos ShelbyNet, `@aptos-labs/ts-sdk`, Wallet Adapter
- **Storage:** `@shelby-protocol/sdk` (ShelbyNet)
- **Realtime:** Pusher (chat + notifications)
- **Charts:** Recharts (dashboard analytics)
- **Auth:** JWT session cookie + Aptos wallet (auto-sync via `WalletSessionSync`)

### Shelby SDK note

Pin `got` for Shelby SDK compatibility in `package.json`:

```json
"overrides": { "got": "11.8.6" }
```

Run `npm install` after changing overrides.

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas database
- Aptos wallet (Petra) on ShelbyNet with test APT
- API keys from [Geomi](https://geomi.dev) (Aptos + Shelby)
- Pusher app (optional, for realtime)
- `SHELBY_SIGNER_PRIVATE_KEY` — server account funded with APT for blob uploads

### Install

```bash
npm install
cp .env.example .env   # fill in values
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment variables

```env
# Database
MONGODB_URI=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Aptos ShelbyNet
NEXT_PUBLIC_APTOS_NETWORK=shelbynet
NEXT_PUBLIC_APTOS_NODE_URL=https://api.shelbynet.shelby.xyz/v1
NEXT_PUBLIC_APTOS_API_KEY=aptoslabs_...

# Contract (deployed)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6
NEXT_PUBLIC_MODULE_ADDRESS=0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6
NEXT_PUBLIC_PLATFORM_ADDRESS=0xYOUR_TREASURY_WALLET

# Shelby storage
SHELBY_API_KEY=aptoslabs_...
SHELBY_SIGNER_PRIVATE_KEY=0x...
NEXT_PUBLIC_SHELBY_GATEWAY=https://gateway.shelby.network

# Realtime
PUSHER_APP_ID=
NEXT_PUBLIC_PUSHER_KEY=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_CLUSTER=us3

# Platform
PLATFORM_FEE_BPS=500
VERIFICATION_COST_APT=10
```

### Seed demo data (optional)

```bash
npm run db:seed
```

---

## Project Structure

```
Forge/
├── app/
│   ├── (app)/          # Auth-required pages (upload, chat, wallet, dashboard)
│   ├── (public)/       # Home feed
│   ├── api/            # REST API routes
│   ├── [handle]/       # Creator profiles
│   ├── b/[slug]/       # BurnLink unlock
│   ├── lobby/          # Creator discovery
│   ├── hire/           # Hire marketplace
│   └── pay/invoice/    # Invoice payment
├── components/
│   ├── profile/        # Behance profile, post composer, verify
│   ├── feed/           # Home feed
│   ├── lobby/          # Creator cards
│   ├── chat/           # Messaging
│   ├── wallet/         # Wallet dashboard
│   ├── dashboard/      # Analytics insights
│   └── notifications/  # Notification dropdown
├── lib/
│   ├── shelby-server.ts   # Shelby SDK upload/download
│   ├── shelby-public.ts   # Client-safe URL helpers
│   ├── payments.ts        # APT tx verification
│   ├── analytics.ts       # Event recording
│   └── notifications.ts   # Notification + Pusher push
├── move/
│   └── sources/cult.move  # On-chain CULT module
├── prisma/
│   └── schema.prisma      # MongoDB schema
└── scripts/
    ├── seed.ts
    └── deploy-contract.sh
```

---

## Payment Flow Summary

```
User action          → Wallet signs APT transfer
                    → Tx hash sent to API
                    → verifyAptPayment() on ShelbyNet (with retries)
                    → Record in Transaction + update grants/status
                    → Notify via Pusher
```

Platform fee (default 5%) calculated in `lib/payments.ts` via `PLATFORM_FEE_BPS`.

---

## What Is NOT Mock Data

Every user-facing surface reads from real sources:

- Feeds, Lobby, profiles → Prisma / MongoDB
- Wallet balances and transactions → `Transaction` model
- Analytics dashboard → `AnalyticsEvent` + aggregated counts
- Notifications → `Notification` model + live Pusher events
- Follow counts, post counts, revenue → live DB queries
- Media URLs → Shelby blob references

---

## License

Private project — All rights reserved.
