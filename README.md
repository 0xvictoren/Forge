# Forge

Forge is a Web3 creator platform on **Aptos ShelbyNet** — gated media sharing, wallet-native payments, a digital asset marketplace, and creator tools without traditional signups.

Wallets authenticate users, **Shelby** stores files and media, and **MongoDB** (via Prisma) stores profiles, assets, chats, invoices, and analytics.

**Repository:** https://github.com/0xvictoren/Forge

---

## Features

### Marketplace & content
- **Explore** (`/explore`) — discover listed assets, bundles, and vaults with search and filters
- **Assets & bundles** — upload to Shelby, set price, list on Explore (user-controlled `isListed`)
- **Vaults** — curated collections with optional paywalls and per-vault detail pages
- **Library** — purchased assets, certificates, and downloads
- **BurnLinks** — gated file sharing with paid/free unlock flows
- **Certificates** — proof of ownership for purchases
- **Stream** (`/stream`) — short-form video feed with Shelby player, likes, comments, and optional paid unlock

### Creator tools
- **Upload studio** (`/upload`) — Asset, BurnLink, and Bundle tabs; local upload or **Google Drive import**
- **Creator home** (`/home`) — revenue, storage, subscriptions, recent purchases, and activity
- **Creator dashboard** (`/dashboard`) — asset performance, sales, and listing stats
- **Profile** — Shelby-backed avatar & banner (upload locally or pick from existing Shelby files)
- **Onboarding** (`/onboarding`) — handle, bio, skills, social links
- **Workspaces** — collaboration and project organization
- **Wallet insights** (`/wallet/insights`) — views, unlocks, revenue, conversion, and referral stats

### Social & payments
- **Hire** (`/hire`) — discover creators by name, skill, or category
- **Chat** — direct messaging with Pusher; share invoices and BurnLinks
- **Invoicing** — create, share, and pay invoices in APT
- **Tips & subscriptions** — fan monetization on creator profiles
- **Verification** — one-time APT payment for verified badge
- **Follow system** — follow creators from profiles and hire discovery
- **Referrals** — trackable referral codes with visit and purchase stats

### UX & design
- **Orange / cream / charcoal** brand palette with **light & dark mode** toggle
- **i18n** — English, Korean, Chinese, and French (header language switcher)
- **Fixed shell layout** — navbar, footer, and profile sidebar stay in place; only page content scrolls
- **Primary nav:** Home → Upload → Library → Vault → Chat → Explore (header + mobile bottom nav)
- **Sidebar nav:** Wallet, Profile
- **Landing waitlist** — email signup on the public home page
- **Branding:** `logo.webp` (light mode), `logo-light.webp` (dark mode), `favicon.webp`, tab title **Forge**

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS v4 |
| Auth | Aptos Wallet Adapter + JWT session cookie |
| Database | MongoDB Atlas + Prisma 5 |
| Storage | `@shelby-protocol/sdk` (ShelbyNet blobs) |
| Media | `@shelby-protocol/player`, `@shelby-protocol/media-prepare`, `@shelby-protocol/react` |
| Chain | Aptos ShelbyNet — native APT payments |
| Realtime | Pusher (chat + notifications) |
| Forms / validation | react-hook-form, zod |
| Charts / motion | recharts, framer-motion |

---

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB Atlas database
- Aptos wallet (e.g. Petra) on ShelbyNet with test APT
- Shelby signer key funded with APT for server uploads
- Aptos / Shelby API keys (ShelbyNet dashboard) — optional but recommended
- Pusher app — optional, for realtime chat/notifications
- Google Cloud OAuth — optional, for Drive import

### Install & run

```bash
npm install
cp .env.example .env   # fill in values
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm start
```

### Seed demo data (optional)

```bash
npm run db:seed
```

### Compile Move contract

```bash
npm run contract:compile
```

Deploy to ShelbyNet:

```bash
bash scripts/deploy-contract.sh
```

---

## Environment variables

Copy `.env.example` to `.env`. Key groups:

### Core

```env
MONGODB_URI=                        # mongodb+srv://.../forge?...
JWT_SECRET=                         # Required for sessions + OAuth cookies
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Aptos ShelbyNet

```env
NEXT_PUBLIC_APTOS_NETWORK=shelbynet
NEXT_PUBLIC_APTOS_NODE_URL=https://api.shelbynet.shelby.xyz/v1
NEXT_PUBLIC_APTOS_API_KEY=
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_MODULE_ADDRESS=
NEXT_PUBLIC_PLATFORM_ADDRESS=       # Treasury — verification fees + fee tracking
```

### Shelby storage

```env
SHELBY_API_KEY=
SHELBY_SIGNER_PRIVATE_KEY=          # REQUIRED for server uploads (ed25519-priv-... or 0x...)
NEXT_PUBLIC_SHELBY_GATEWAY=https://gateway.shelby.network
NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY=
NEXT_PUBLIC_APTOS_SHELBYNET_API_KEY=
NEXT_PUBLIC_APTOS_SHELBYNET_GAS_STATION_API_KEY=
```

### Platform & realtime

```env
PLATFORM_FEE_BPS=200                # 2% platform fee
VERIFICATION_COST_APT=10
PUSHER_APP_ID=
PUSHER_KEY=
NEXT_PUBLIC_PUSHER_KEY=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_CLUSTER=us3
```

### Google Drive import

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — create OAuth 2.0 Web client
2. Enable **Google Drive API**
3. Add authorized redirect URI (must match exactly):

   `https://forge-alpha-blush.vercel.app/api/import/google/callback`

   (local dev: `http://localhost:3000/api/import/google/callback`)

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://forge-alpha-blush.vercel.app/api/import/google/callback
```

`JWT_SECRET` is required for OAuth state and token cookies.

### Optional: Dropbox import (API)

Dropbox OAuth routes exist for backend/cloud import. Configure if enabling:

```env
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
```

### Optional: legacy S3 gateway (Stream fallback)

Stream uploads prefer the Shelby SDK (`/api/upload/stream`). S3-compatible vars are kept for legacy multipart/presign paths:

```env
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
```

### Shelby SDK note

Pin `got` for Shelby SDK compatibility in `package.json`:

```json
"overrides": { "got": "11.8.6" }
```

Run `npm install` after changing overrides.

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing — connect wallet, waitlist |
| `/explore` | Public | Marketplace — assets, bundles, vaults |
| `/hire` | Public | Creator discovery |
| `/how-it-works` | Public | Product guide |
| `/faq` | Public | FAQ |
| `/[handle]` | Public | Creator profile |
| `/assets/[id]` | Public | Asset product page |
| `/products/[id]` | Public | Bundle product page |
| `/b/[slug]` | Public | BurnLink unlock |
| `/view/[slug]` | Token | Secure file viewer |
| `/pay/invoice/[token]` | Public | Invoice payment |
| `/cert/[slug]` | Public | Certificate view |
| `/home` | Auth | Creator home |
| `/dashboard` | Auth | Creator dashboard (sales & asset stats) |
| `/upload` | Auth | Upload studio (Asset / BurnLink / Bundle) |
| `/library` | Auth | Purchases & downloads |
| `/vaults` | Auth | Vault management |
| `/vaults/[id]` | Auth | Vault detail |
| `/bundles` | Auth | Bundle management |
| `/stream` | Auth | Video stream feed |
| `/chat` | Auth | Direct messages |
| `/chat/[id]` | Auth | Conversation thread |
| `/wallet` | Auth | Wallet overview |
| `/wallet/invoices` | Auth | Invoice management |
| `/wallet/payouts` | Auth | Payout history |
| `/wallet/insights` | Auth | Creator analytics |
| `/profile` | Auth | Your profile |
| `/onboarding` | Auth | Profile setup / edit |
| `/workspaces` | Auth | Collaboration spaces |
| `/workspaces/[id]` | Auth | Workspace detail |
| `/lobby` | Public | Redirects to `/hire` |

---

## Storage architecture

All user-generated media uses **Shelby blob storage** on ShelbyNet:

| Media | Storage |
|-------|---------|
| Profile avatar / banner | Shelby blob ref `shelby:{address}::{path}` |
| Assets, thumbnails | Shelby |
| BurnLink files | Shelby |
| Stream videos | Shelby (via SDK upload path) |
| Post / message media | Shelby |
| Invoice PDFs | Shelby |

**Upload:** File → Shelby SDK → blob ref saved in MongoDB → served via `/api/media/shelby?ref=...`

**Stream upload:** Video → `/api/upload/stream` (Shelby SDK resumable path) → asset flagged `isStream`

**Profile media:** Upload locally or select from existing Shelby files (`/api/media/shelby-library`).

**Off-chain (MongoDB):** profiles, assets, purchases, invoices, chat, notifications, analytics, referrals, stream likes/comments.

---

## Authentication

- Wallet connect via Aptos Wallet Adapter (Petra, etc.)
- Session created at `/api/auth/session` with HTTP-only JWT cookie
- Wallet address linked to `User` in MongoDB
- Protected routes require session; middleware redirects unauthenticated users to `/` with a return URL

---

## API reference (summary)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | POST | Wallet login |
| `/api/auth/me` | GET | Current user |
| `/api/auth/logout` | POST | End session |
| `/api/profile/[handle]` | GET/POST | Public profile / subscription tiers |
| `/api/users/me` | PUT | Update profile (avatar/banner refs) |
| `/api/onboarding` | POST | Profile setup |
| `/api/assets` | GET/POST | List / create assets |
| `/api/assets/[id]` | GET/PATCH/DELETE | Asset detail |
| `/api/products` | GET/POST | Bundles |
| `/api/vaults` | GET/POST | Vaults |
| `/api/library` | GET | Purchases & library |
| `/api/burnlinks` | POST | Create BurnLink |
| `/api/burnlinks/[slug]/unlock` | POST | Unlock + payment |
| `/api/explore/assets` | GET | Marketplace listings |
| `/api/stream` | GET/POST | Stream feed & upload metadata |
| `/api/stream/[id]/like` | POST | Like / unlike |
| `/api/stream/[id]/comments` | GET/POST | Stream comments |
| `/api/stream/[id]/unlock` | POST | Paid stream unlock |
| `/api/upload/stream` | POST | Shelby stream video upload |
| `/api/media/upload` | POST | Shelby upload (avatar, banner, assets) |
| `/api/media/shelby` | GET | Stream / download blob |
| `/api/media/shelby-library` | GET | User's Shelby images (profile picker) |
| `/api/import/google/auth` | GET | Google OAuth start |
| `/api/import/google/files` | GET | List Drive files |
| `/api/import/google/import` | POST | Import file to Shelby |
| `/api/import/dropbox/*` | GET/POST | Dropbox OAuth & import (optional) |
| `/api/import/status` | GET | OAuth connection status |
| `/api/invoices` | GET/POST | Invoice CRUD |
| `/api/invoices/pay/[token]` | GET/POST | Pay invoice |
| `/api/conversations` | GET/POST | Chat threads |
| `/api/notifications` | GET/PATCH | Notifications |
| `/api/verify` | GET/POST | Verification payment |
| `/api/tips` | POST | Send tip |
| `/api/subscriptions/subscribe` | POST | Subscribe to creator tier |
| `/api/follow` | POST/DELETE | Follow / unfollow |
| `/api/referrals` | GET/POST | Referral codes & stats |
| `/api/waitlist` | POST | Landing waitlist signup |
| `/api/analytics/dashboard` | GET | Creator analytics |
| `/api/wallet/summary` | GET | Wallet stats |
| `/api/wallet/transactions` | GET | Transaction history |
| `/api/workspaces` | GET/POST | Workspaces |
| `/api/search` | GET | Global search |
| `/api/creators/explore` | GET | Hire / creator discovery |

---

## On-chain (Forge Move module)

Deployed on **Aptos ShelbyNet**:

| | |
|---|---|
| **Address** | `0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6` |
| **Module** | `forge::forge` |

Entry functions: `initialize_platform`, `verify_creator`, `tip_creator`, `subscribe`, `purchase_burnlink`, and more.

Source: `move/sources/forge.move` — redeploy with `bash scripts/deploy-contract.sh`

---

## Project structure

```
Forge/
├── app/
│   ├── (app)/          # Auth-required pages (home, upload, chat, wallet, stream, …)
│   ├── (public)/       # Landing page
│   ├── api/            # REST API routes
│   ├── explore/        # Marketplace
│   ├── hire/           # Creator discovery
│   ├── assets/         # Asset product pages
│   ├── b/[slug]/       # BurnLink unlock
│   └── [handle]/       # Creator profiles
├── components/
│   ├── layout/         # Shell, header, footer, nav, logo, i18n
│   ├── profile/        # Profile media picker, verification, storefront
│   ├── upload/         # Shelby uploader, Google Drive import
│   ├── v2/             # Explore, assets, library, vaults, dashboard
│   ├── chat/           # Messaging
│   ├── wallet/         # Wallet dashboard, invoices
│   ├── creator/        # Tips, subscriptions, storefront actions
│   ├── hire/           # Creator discovery UI
│   └── landing/        # Hero, waitlist
├── lib/
│   ├── shelby-server.ts    # Shelby SDK upload/download
│   ├── shelby-public.ts    # Blob ref helpers + URLs
│   ├── import-oauth.ts     # Google Drive + Dropbox OAuth
│   ├── profile-media.ts    # Avatar/banner resolution
│   ├── i18n/translations.ts
│   └── nav-config.ts       # Navbar order & routes
├── prisma/schema.prisma
├── move/sources/forge.move
├── public/             # logo.webp, logo-light.webp, favicon.webp, banners
└── scripts/            # seed, deploy
```

---

## Payment flow

```
User action  →  Wallet signs APT transfer
            →  Tx hash sent to API
            →  verifyAptPayment() on ShelbyNet
            →  Record in Transaction + update grants/status
            →  Notify via Pusher
```

Platform fee: **2%** (`PLATFORM_FEE_BPS=200`). Unlock payments go to creators; verification fees go to `NEXT_PUBLIC_PLATFORM_ADDRESS`.

---

## Marketplace rules

- Assets and bundles default to **unlisted** — creators explicitly enable listing for Explore
- All media uploads go through **Shelby**; MongoDB stores blob refs only
- Profile avatar/banner persisted with long-lived Shelby expiration (365 days)
- Handle changes limited to once per month
- Explore returns only `isListed=true` public content
- Stream assets use `isStream=true` and appear on `/stream`

---

## License

Private project — All rights reserved.
