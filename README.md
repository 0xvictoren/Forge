# Forge

Forge is a Web3 creator platform on **Aptos ShelbyNet** — gated media sharing, wallet-native payments, a digital asset marketplace, and creator tools without traditional signups.

Wallets authenticate users, **Shelby** stores files and media, and **MongoDB** (via Prisma) stores profiles, assets, chats, invoices, and analytics.

**Repository:** https://github.com/0xvictoren/Forge

---

## Features

### Marketplace & content
- **Explore** (`/explore`) — discover listed assets, bundles, and vaults with search and filters
- **Assets & bundles** — upload to Shelby, set price, list on Explore (user-controlled `isListed`)
- **Vaults** — curated collections with optional paywalls
- **Library** — purchased assets, certificates, and downloads
- **BurnLinks** — gated file sharing with paid/free unlock flows
- **Certificates** — proof of ownership for purchases

### Creator tools
- **Upload studio** (`/upload`) — Asset, BurnLink, and Bundle tabs; local upload or **Google Drive import**
- **Creator dashboard** (`/home`) — analytics, recent activity, sales
- **Profile** — Shelby-backed avatar & banner (upload locally or pick from existing Shelby files)
- **Onboarding** (`/onboarding`) — handle, bio, skills, social links
- **Workspaces** — collaboration and project organization
- **Wallet insights** — revenue, conversion, referrals

### Social & payments
- **Chat** — direct messaging with Pusher; share invoices and BurnLinks
- **Invoicing** — create, share, and pay invoices in APT
- **Tips & subscriptions** — fan monetization on creator profiles
- **Verification** — one-time APT payment for verified badge
- **Follow system** — following feed and notifications

### UX & design
- **Orange / cream / charcoal** brand palette with **light & dark mode** toggle
- **Fixed shell layout** — navbar, footer, and profile sidebar stay in place; only page content scrolls
- **Primary nav:** Home → Upload → Library → Vault → Chat → Explore (header + mobile bottom nav)
- **Branding:** `logo.webp` (light mode), `logo-light.webp` (dark mode), `favicon.webp`, tab title **Forge**

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS v4 |
| Auth | Aptos Wallet Adapter + JWT session cookie |
| Database | MongoDB Atlas + Prisma 5 |
| Storage | `@shelby-protocol/sdk` (ShelbyNet blobs) |
| Chain | Aptos ShelbyNet — native APT payments |
| Realtime | Pusher (chat + notifications) |
| Forms / validation | react-hook-form, zod |

---

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB Atlas database
- Aptos wallet (e.g. Petra) on ShelbyNet with test APT
- Shelby signer key funded with APT for server uploads
- [Geomi](https://geomi.dev) API keys (Aptos + Shelby) — optional but recommended
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

   `{NEXT_PUBLIC_APP_URL}/api/import/google/callback`

   e.g. `http://localhost:3000/api/import/google/callback`

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=                # Optional override
```

`JWT_SECRET` is required for OAuth state and token cookies.

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
| `/` | Public | Landing — connect wallet |
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
| `/home` | Auth | Creator home / dashboard |
| `/upload` | Auth | Upload studio (Asset / BurnLink / Bundle) |
| `/library` | Auth | Purchases & downloads |
| `/vaults` | Auth | Vault management |
| `/bundles` | Auth | Bundle management |
| `/chat` | Auth | Direct messages |
| `/wallet` | Auth | Wallet overview |
| `/wallet/invoices` | Auth | Invoice management |
| `/wallet/insights` | Auth | Creator analytics |
| `/profile` | Auth | Your profile |
| `/onboarding` | Auth | Profile setup / edit |
| `/workspaces` | Auth | Collaboration spaces |
| `/dashboard` | Auth | Creator dashboard |

---

## Storage architecture

All user-generated media uses **Shelby blob storage** on ShelbyNet:

| Media | Storage |
|-------|---------|
| Profile avatar / banner | Shelby blob ref `shelby:{address}::{path}` |
| Assets, thumbnails | Shelby |
| BurnLink files | Shelby |
| Post / message media | Shelby |
| Invoice PDFs | Shelby |

**Upload:** File → Shelby SDK → blob ref saved in MongoDB → served via `/api/media/shelby?ref=...`

**Profile media:** Upload locally or select from existing Shelby files (`/api/media/shelby-library`).

**Off-chain (MongoDB):** profiles, assets, purchases, invoices, chat, notifications, analytics.

---

## Authentication

- Wallet connect via Aptos Wallet Adapter (Petra, etc.)
- Session created at `/api/auth/session` with HTTP-only JWT cookie
- Wallet address linked to `User` in MongoDB
- Protected routes under `app/(app)/` require session; auth redirect notices guide wallet connection

---

## API reference (summary)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | POST | Wallet login |
| `/api/auth/me` | GET | Current user |
| `/api/profile/[handle]` | GET | Public profile |
| `/api/users/me` | PUT | Update profile (avatar/banner refs) |
| `/api/onboarding` | POST | Profile setup |
| `/api/assets` | GET/POST | List / create assets |
| `/api/products` | GET/POST | Bundles |
| `/api/vaults` | GET/POST | Vaults |
| `/api/library` | GET | Purchases & library |
| `/api/burnlinks` | POST | Create BurnLink |
| `/api/burnlinks/[slug]/unlock` | POST | Unlock + payment |
| `/api/explore/assets` | GET | Marketplace listings |
| `/api/media/upload` | POST | Shelby upload (avatar, banner, assets) |
| `/api/media/shelby` | GET | Stream / download blob |
| `/api/media/shelby-library` | GET | User's Shelby images (profile picker) |
| `/api/import/google/auth` | GET | Google OAuth start |
| `/api/import/google/files` | GET | List Drive files |
| `/api/import/google/import` | POST | Import file to Shelby |
| `/api/import/status` | GET | OAuth connection status |
| `/api/invoices` | GET/POST | Invoice CRUD |
| `/api/invoices/pay/[token]` | GET/POST | Pay invoice |
| `/api/conversations` | GET/POST | Chat threads |
| `/api/notifications` | GET/PATCH | Notifications |
| `/api/verify` | GET/POST | Verification payment |
| `/api/wallet/summary` | GET | Wallet stats |

---

## On-chain (CULT Move module)

Deployed on **Aptos ShelbyNet**:

| | |
|---|---|
| **Address** | `0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6` |
| **Module** | `cult::cult` |

Entry functions: `register_creator`, `publish_content`, `subscribe`, `tip_creator`, `purchase_content`, `follow_creator`, and more.

Source: `move/sources/cult.move` — redeploy with `bash scripts/deploy-contract.sh`

---

## Project structure

```
Forge/
├── app/
│   ├── (app)/          # Auth-required pages (home, upload, chat, wallet, …)
│   ├── (public)/       # Landing page
│   ├── api/            # REST API routes
│   ├── explore/        # Marketplace
│   ├── assets/         # Asset product pages
│   ├── b/[slug]/       # BurnLink unlock
│   └── [handle]/       # Creator profiles
├── components/
│   ├── layout/         # Shell, header, footer, nav, logo
│   ├── profile/        # Profile media picker, verification
│   ├── upload/         # Shelby uploader, Google Drive import
│   ├── v2/             # Explore, assets, library, vaults
│   ├── chat/           # Messaging
│   └── wallet/         # Wallet dashboard
├── lib/
│   ├── shelby-server.ts    # Shelby SDK upload/download
│   ├── shelby-public.ts    # Blob ref helpers + URLs
│   ├── import-oauth.ts     # Google Drive OAuth
│   ├── profile-media.ts    # Avatar/banner resolution
│   └── nav-config.ts       # Navbar order & routes
├── prisma/schema.prisma
├── move/sources/
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

## V2 marketplace rules

- Assets and bundles default to **unlisted** — creators explicitly enable listing for Explore
- All media uploads go through **Shelby**; MongoDB stores blob refs only
- Profile avatar/banner persisted with long-lived Shelby expiration (365 days)
- Handle changes limited to once per month
- Explore returns only `isListed=true` public content

---

## License

Private project — All rights reserved.