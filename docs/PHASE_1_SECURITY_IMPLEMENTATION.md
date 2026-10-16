# Phase 1 security implementation

Date: 2026-09-28  
Repository baseline: `main` at `5506d64`

## Implemented

- Replaced address-only wallet sessions with a five-minute Aptos sign-message challenge.
- Bound the signed message to the normalized address, nonce, Forge origin, public key, and onchain authentication key.
- Invalidated the client-controlled BurnLink owner bypass and derived all access identities from the verified server session.
- Bound BurnLink grants and protected media URLs to the authenticated user; reduced signed media lifetime to five minutes.
- Restricted the legacy development-blob endpoint to authenticated owners, removing its arbitrary upstream-fetch behavior, and enforced purchase checks on paid published vaults.
- Made limited-view consumption atomic to prevent concurrent requests exceeding a grant's limit.
- Added recursive redaction for encryption secrets and protected storage references in general/public API payloads.
- Changed Pusher user and conversation traffic to authenticated private channels.
- Added ten-minute payment intents for asset, product, and BurnLink testnet purchases. Intents bind buyer, seller, target, recipient, exact atomic amount, creation time, expiry, and transaction hash.
- Disabled legacy non-intent APT tips, subscriptions, invoice payments, paid streams, and profile verification by default during the USDC migration.
- Enforced seller ownership for every asset added to a product bundle.
- Scoped multipart upload keys to the authenticated user's prefix and validated upload inputs.
- Added per-instance login/payment/upload abuse limits, upload size limits, CSP/HSTS and browser hardening headers.
- Encrypted OAuth access/refresh-token cookies with JWE and narrowed their cookie path.
- Set the intended platform fee to 500 basis points and the default Shelby retention period to 30 days.
- Updated Next.js to 15.5.26, pinned audited transitive dependencies, and reduced `npm audit --omit=dev` to zero findings.
- Added an ESLint configuration and security regression tests.

## Deployment requirements

1. Back up the staging database.
2. Run `npx prisma db push` against staging to create the `PaymentIntent` collection indexes. Do not skip the unique `nonce` and `txHash` indexes.
3. Rotate `JWT_SECRET` during deployment. This invalidates every session created before signed-wallet authentication was introduced.
4. Set `PLATFORM_FEE_BPS=500`.
5. Keep `ENABLE_LEGACY_APT_PAYMENTS=false` and `NEXT_PUBLIC_ENABLE_LEGACY_APT_PAYMENTS=false`.
6. Verify Pusher credentials and confirm `/api/pusher/auth` is reachable from the deployed application.
7. Complete a staging smoke test with a funded Ed25519 Aptos wallet before allowing pilot users.

Do not run `prisma db push` against production until the staging smoke test succeeds.

## Current payment boundary

Asset, product, and BurnLink purchases remain an intent-protected `APT_TESTNET` compatibility flow on Shelbynet. This is not the final settlement design. Phase 2 must replace the price and ledger fields with USDC atomic units and implement the actual 5% split. The current direct transfer sends the payment to the seller; therefore the database fee is accounting-only until USDC settlement is implemented.

## Remaining Phase 1 work

- Add integration tests backed by an isolated MongoDB instance for intent race conditions and access-grant concurrency.
- Add a shared/distributed rate-limit store before multi-instance production deployment.
- Add automated endpoint tests proving every public DTO remains free of key/storage fields.
- Exercise signed authentication with each wallet selected for the pilot; the current proof parser accepts standard Ed25519 account signatures.
- Perform a manual browser CSP and private-Pusher smoke test in staging.
- Rotate any encryption material already returned by a public API before these fixes.

## Verification completed

- `npm test`: 7 passing tests.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 17 pre-existing warnings and no errors.
- `npm run build`: passed on Next.js 15.5.26; 84 static/dynamic routes generated.
- `npm audit --omit=dev`: zero vulnerabilities.
