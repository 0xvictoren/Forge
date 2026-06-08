# Forge

Forge is a Web3 creator platform built on Aptos ShelbyNet, combining creator discovery, gated media sharing, wallet-native payments, messaging, and invoices.

The app is designed for creators and clients to connect without traditional signups: wallets authenticate users, Shelby blobs store files and media, and MongoDB stores profiles, posts, invoices, chats, and analytics.

---

## What Forge Currently Includes

### Public experience
- **Landing page** at `/` with wallet connect and discovery.
- **Creator discovery** at `/hire` and `/lobby`.
- **Creator profiles** via `/[handle]`.
- **BurnLinks** at `/b/[slug]` for paid or free gated downloads.
- **Invoice payment pages** at `/pay/invoice/[token]`.

### Wallet-enabled creator experience
- **Dashboard** at `/home` for creator analytics and BurnLink management.
- **Upload** page at `/upload` for BurnLinks and public posts.
- **Wallet overview** at `/wallet` with earnings, spend, invoices, and transaction history.
- **Chat** at `/chat` for direct messaging and invoice sharing.
- **Optional onboarding** at `/onboarding` for profile setup, skills, and socials.

### Payments and asset flow
- **Native APT payments** for unlocks, tips, invoices, and verification.
- **Unlock payments** are attributed to creators on-chain.
- **Platform fee tracking** is recorded in MongoDB for reporting.
- Shelby blob owners can access their own uploads without paying.

---

## Key Features

### BurnLinks
- Upload private files to Shelby blob storage.
- Create a BurnLink with a unique slug.
- Configure unlock settings and paid access.
- Unlock flow verifies on-chain APT payments and grants secure access.

### Public posts
- Compose posts with optional media.
- Publish images, video, or audio to feeds and profiles.
- Store media in Shelby and metadata in MongoDB.

### Creator profiles
- Profile pages show avatar, banner, bio, skills, and wallet address.
- Follow, tip, message, and subscribe actions are supported.
- Verified creators can display a badge.
- Work and BurnLink listings are exposed on profile pages.

### Direct messaging
- Real-time chat powered by Pusher.
- New DM creation with user search.
- Invoices and BurnLinks can be shared in conversations.

### Invoicing
- Create invoices with client details, amount, and notes.
- Share invoice links publicly or via DM.
- Pay invoices through Aptos wallet transactions.
- Generate invoice PDFs and store them in Shelby.

### Wallet and creator analytics
- Track earnings, spend, and net position.
- Monitor invoice status, payouts, and transaction history.
- Dashboard analytics surface creator performance and revenue.

---

## Architecture

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **Auth**: Wallet-based authentication with Petra-compatible wallets and JWT session sync
- **Database**: MongoDB with Prisma for users, posts, burnlinks, chats, invoices, and analytics
- **Storage**: Shelby blob storage for uploaded files, avatars, banners, and invoice assets
- **Blockchain**: Aptos ShelbyNet for native APT payments and contract verification
- **Realtime**: Pusher for chat and notification updates

---

## Technology Stack

- `next` 15
- `react` 19
- `tailwindcss` 4
- `prisma` / `@prisma/client`
- `mongodb`
- `@aptos-labs/wallet-adapter`
- `@shelby-protocol/sdk`
- `pusher` / `pusher-js`
- `zod`, `react-hook-form`, `framer-motion`, `recharts`

---

## Local Development

Requirements:
- Node.js 20+ (or compatible with Next 15)
- MongoDB connection
- Aptos wallet / ShelbyNet endpoint for on-chain flows

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Generate Prisma client after schema changes:

```bash
npm run db:generate
```

Seed the database:

```bash
npm run db:seed
```

Compile the Move contract:

```bash
npm run contract:compile
```

---

## Repository

Forge source and documentation are available at:

https://github.com/0xvictoren/Forge

---

## Project structure

- `app/` – Next.js app routes, landing, onboarding, chat, wallet, upload, hire, creator pages
- `components/` – shared UI, layout, forms, chat, feed, and profile components
- `lib/` – business logic, API helpers, auth, Aptos integration, Shelby integration, notifications
- `prisma/` – schema and database models
- `move/` – Aptos Move contract sources and configuration
- `public/` – static assets
- `scripts/` – seed and deployment scripts

---

## Notes

Forge is built as a Web3-native creator marketplace that combines secure file sharing, creator discovery, and native Aptos payments with a modern discovery feed and messaging system.


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
