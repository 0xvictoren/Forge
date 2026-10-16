# Forge security audit

Audit date: 2026-09-28  
Repository reviewed: `main` at `5506d64`  

> Phase 1 remediation has begun. The implementation status and deployment requirements are tracked in `docs/PHASE_1_SECURITY_IMPLEMENTATION.md`; findings below describe the reviewed baseline and should not be interpreted as the post-remediation state.
Method: source review, route/auth/data-flow mapping, production build, dependency audit, public deployment availability check, Shelbynet REST verification, and Move contract review. This is not a formal third-party audit or exhaustive penetration test.

## Executive summary

Forge must not handle paid or confidential data in its current state. The review found three critical application vulnerabilities, multiple high-severity authorization/payment/realtime issues, a critical vulnerable runtime dependency, missing data-retention controls, and no automated tests. The AES implementation is not the principal problem: access checks and API serialization expose or release the keys.

Immediate action:

1. Disable new paid/encrypted listings and BurnLink unlocks.
2. Remove all public serialization of encryption fields.
3. Replace address-only login with nonce-based Aptos signature verification.
4. Remove the client-controlled `ownerBypass` path.
5. Rotate exposed content share keys/re-encrypt affected blobs where any encrypted records have been returned by vulnerable endpoints.
6. Upgrade Next.js to a non-vulnerable release and triage the remaining dependency advisories.

## Validation results

| Check | Result |
|---|---|
| `git pull --ff-only origin main` | Already current at `5506d64` |
| `npm run build` | Pass; 81 application/API routes generated |
| Type checking | Pass as part of Next production build |
| `npm run lint` | Not usable non-interactively; prompts to create ESLint configuration |
| Automated tests | None found; no test script |
| `npm audit --omit=dev` | 16 vulnerable packages: 1 critical, 8 high, 7 moderate |
| Secret scan of tracked files | No populated secrets found; `.env` is ignored |
| Live app | Home and public API responded during review |
| Configured Move module | Not found on current Shelbynet ledger |
| Configured `ForgePlatform` resource | Not found on current Shelbynet ledger |
| Clean Move compile | Source has previous build artifacts; fresh compiler bootstrap was unreliable and no contract tests exist |

## Findings summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| C-01 | Critical | Wallet authentication requires no signature | Open |
| C-02 | Critical | Public/catalog APIs serialize decryption secrets | Open |
| C-03 | Critical | Client-controlled BurnLink `ownerBypass` grants access | Open |
| H-01 | High | Wallet gates and BurnLink access do not prove wallet control | Open |
| H-02 | High | Realtime chat/user channels are public Pusher channels | Open |
| H-03 | High | Payments are weakly bound to products and fees are not collected consistently | Open |
| H-04 | High | Current Next.js runtime has critical RCE advisories | Open |
| H-05 | High | Shelby assets expire in seven days without renewal | Open |
| H-06 | High | Legacy multipart endpoints authorize arbitrary bucket keys/upload IDs | Open |
| H-07 | High | Whole-file buffering and missing rate/size controls enable resource exhaustion | Open |
| H-08 | High | Product creation can bundle assets the seller does not own | Open |
| M-01 | Medium | One-time/max-view enforcement is race-prone | Open |
| M-02 | Medium | Money and prices use floating point and accept weakly validated input | Open |
| M-03 | Medium | OAuth refresh/access tokens are signed, not encrypted, in broad-path cookies | Open |
| M-04 | Medium | Missing security headers, centralized key custody, and open proxy behavior | Open |
| M-05 | Medium | Public read endpoints mutate analytics and are easy to manipulate | Open |
| M-06 | Medium | Repository/CI hygiene prevents reliable security regression checks | Open |
| SC-01 | High | Configured contract deployment is absent on current network | Open |
| SC-02 | High | Onchain subscription flow is unusable | Open |
| SC-03 | Medium | Contract/app fee and payment semantics disagree | Open |
| SC-04 | Medium | Contract lacks product-bound payment intents and useful identifiers | Open |

## Detailed findings

### C-01 — Address-only wallet login

**Evidence:** `app/api/auth/session/route.ts:5-22`

The login route accepts `walletAddress` or `address`, lowercases it, finds/creates the user, and issues a seven-day JWT. It does not issue a nonce, request a wallet signature, validate a public key/authenticator, bind the challenge to the domain/chain, or prevent replay.

**Impact:** An attacker can authenticate as any known creator/buyer address. This exposes private library data, encrypted key packages, OAuth-backed imports, chat, invoices, wallet analytics, seller controls, and upload/storage spend. Almost every route-level ownership check becomes ineffective.

**Fix:** Implement a two-step SIWA-style flow:

1. `POST /auth/challenge` creates a random, single-use, short-lived nonce stored server-side with requested address, domain, chain ID, and issued time.
2. Wallet signs the canonical challenge with address/application/chain binding.
3. `POST /auth/verify` verifies the Aptos authenticator and exact message, consumes the nonce atomically, then issues a session.
4. Rotate sessions on wallet change; include `jti`, audience, issuer, and session version; support revocation.

Add tests for wrong address, altered message, replay, expired nonce, wrong domain/network, multi-key/keyless accounts, and concurrent consumption.

### C-02 — Encryption secrets exposed by API serialization

**Evidence:**

- `prisma/schema.prisma:401-433` places `wrappedKeyOwner`, `wrappedKeyShare`, and `encryptionShareKey` on every Asset record.
- `app/api/explore/assets/route.ts:65-146` is public and returns full Asset scalar fields in four collections.
- `app/api/products/route.ts:25-35` publicly includes `items.asset: true` and returns it directly.
- `app/api/stream/route.ts:28-54` spreads full Asset records into the response.
- `app/api/vaults/[id]/route.ts:6-41` embeds full assets in published vault responses.

Prisma returns all scalar fields unless `select` is used. A buyer needs `wrappedKeyShare` plus `encryptionShareKey` to unwrap the content key, so these fields are equivalent to plaintext access for anyone who can fetch the ciphertext.

**Impact:** Paid encrypted assets can be decrypted without purchase. This is silent data exfiltration and invalidates the core marketplace promise.

**Fix:**

- Introduce explicit public DTO/select objects; never serialize ORM records directly.
- Remove encryption/key columns from general Asset/File models returned by repositories, or isolate them in a dedicated secret table/service inaccessible to catalog queries.
- Add response-schema tests that recursively reject secret field names from every unauthenticated and non-entitled route.
- Rotate all share keys that may have been returned. Because the current key encrypts a reusable content key, rotate/re-wrap or re-encrypt; merely hiding the endpoint does not revoke copied secrets.

### C-03 — Client-controlled BurnLink owner bypass

**Evidence:** `app/api/burnlinks/[slug]/unlock/route.ts:42-66`

The request body controls `ownerBypass`. The endpoint treats any request with that boolean as the owner, skips wallet gating and payment, then creates an AccessGrant and returns a view token.

**Impact:** Anyone knowing a BurnLink slug can request free access, including encrypted paid/wallet-gated content.

**Fix:** Delete `ownerBypass` from the API contract. Determine ownership solely from a signature-verified session whose wallet equals the owner. Owner preview should be a separate authenticated operation. Add negative tests proving body fields cannot influence authorization.

### H-01 — No proof of wallet control in BurnLink flows

**Evidence:**

- `app/api/burnlinks/[slug]/unlock/route.ts:25-40` trusts a body wallet address.
- `app/api/burnlinks/[slug]/access/route.ts:28-45` trusts a query-string wallet address.
- `lib/burnlink-access.ts` compares strings but does not verify signatures/sessions.

Even after removing `ownerBypass`, an attacker can claim a whitelisted wallet address for a free gated link. Query-string wallet binding adds no security when the caller chooses both values.

**Fix:** Require a verified session or a one-time signed BurnLink challenge. Bind grants to a stable verified account and token `jti`, not a caller-provided wallet string.

### H-02 — Public Pusher channels leak realtime data

**Evidence:** `lib/pusher.ts:15-25`

Channels are named `conversation-{id}` and `user-{id}`, not `private-*` or `presence-*`, and the client has no Pusher authorization endpoint. Anyone with the public Pusher app key and a channel identifier can subscribe. Events contain messages, notifications, and invoice-payment metadata.

**Impact:** Confidential messages and user activity can be observed in real time. User IDs are returned by public APIs, making user-channel discovery practical.

**Fix:** Use private/presence channels, implement a Pusher auth endpoint backed by the verified Forge session, and authorize conversation participation/user ownership. Minimize event payloads and fetch sensitive bodies over authenticated APIs.

### H-03 — Payment verification is not product-intent verification

**Evidence:**

- `lib/payments.ts:104-177` verifies a successful transaction, sender, recipient, and minimum transfer.
- Purchase routes accept a transaction hash after the fact.
- Most payment calls accept 99% of the configured amount.
- `lib/v2/purchase.ts` records a calculated platform fee after a direct creator transfer.

The transaction contains no Forge purchase ID, asset/version ID, quote nonce, quote expiry, or terms digest. A payer can submit an unrelated historical transfer to the same creator as the first claim for an equal-or-cheaper product. The 1% tolerance undercharges systematically. Direct transfers send the full amount to the creator while the database reports a platform fee/net amount that never occurred onchain.

**Impact:** False entitlements, incorrect accounting/tax records, revenue leakage, and disputes where the chain cannot prove what was purchased.

**Fix:** Create a server-signed, expiring payment intent with buyer, seller, exact integer amount, asset/version, terms hash, nonce, network, and treasury split. Settle through a reviewed contract or a verifiable multi-transfer/payment protocol. Atomically consume the intent and tx hash. Use integer octas/stablecoin base units; require exact amounts unless the intent explicitly permits otherwise.

### H-04 — Vulnerable production dependencies

`npm audit --omit=dev` reported 16 affected packages (1 critical, 8 high, 7 moderate). The direct `next@15.5.18` dependency is below patched versions for critical unauthenticated RCE advisories affecting Windows-hosted servers and AVIF image optimization, plus multiple high/moderate advisories. Other affected paths include `axios`, `form-data`, `nanoid`, `postcss`, `uuid`, `valibot`, Aptos wallet-adapter dependencies, and Telegram bridge dependencies.

**Fix:** Upgrade Next.js to a patched supported release immediately. Run `npm audit` again, examine reachability, remove unused `@telegram-apps/bridge` if it is not required, and update/transitively override other packages only after compatibility tests. Add Dependabot/Renovate and a CI policy that fails on reachable critical/high vulnerabilities.

Relevant Next advisory: https://github.com/advisories/GHSA-p293-qw3h-jr36

### H-05 — Active listings can lose their underlying Shelby blobs

**Evidence:** `lib/shelby-wallet-upload.ts:33-35,112-157`

All wallet upload kinds except avatar/banner default to 168 hours. No storage renewal/reconciliation path exists. Database listings have independent expiry semantics and can remain purchasable after the blob expires.

**Impact:** Buyers can pay for unavailable assets after seven days. This is a direct integrity and financial-loss issue.

**Fix:** Store Shelby expiry/owner/transaction state per blob, confirm committed availability before listing, run a renewal worker with alerts and idempotency, prevent purchase inside a renewal safety window, and automatically unlist on failed renewal. Make seller-funded vs platform-funded renewal explicit.

### H-06 — Multipart operations are not scoped to the user

**Evidence:**

- `app/api/stream/multipart/part/route.ts:9-16`
- `app/api/stream/multipart/complete/route.ts:9-27`

These routes accept arbitrary `key` and `uploadId` values and send privileged S3 commands. They do not enforce the `streams/{user.id}/` prefix or store ownership of initiated uploads. `partNumber`, part count, ETags, content type, and sizes also lack bounds/schema validation.

**Impact:** An authenticated attacker can operate on another upload if identifiers leak, write to unauthorized bucket keys, incur storage costs, or disrupt uploads. C-01 makes authentication trivial.

**Fix:** Store an upload session with owner, exact key, type, size, part bounds, expiry, and status. Look it up by an opaque ID; never accept a raw key/upload ID as authority. Remove legacy endpoints if Shelby has replaced this path.

### H-07 — Resource exhaustion and cost abuse

**Evidence:** `app/api/upload/stream/route.ts` permits 500 MB and calls `formData()`/`arrayBuffer()`, while `lib/shelby-media-upload.ts` buffers the full video again. Client encryption also buffers entire plaintext and ciphertext. No application-wide rate limiter, quota, request budget, or malware/content scanning was found. Zod is installed but unused in API routes.

**Impact:** Memory exhaustion, serverless timeouts, storage-spend abuse, database spam, and denial of service.

**Fix:** Direct resumable uploads to storage, stream encryption in chunks, enforce trusted upload sessions, quotas and rate limits by account/IP, cap metadata/body/list lengths, validate MIME by content, and scan/quarantine before publishing.

### H-08 — Sellers can bundle other users’ assets

**Evidence:** `app/api/products/route.ts:47-64,103-120`

Product creation and updates accept arbitrary asset IDs without checking `asset.userId === session.user.id`. The vault route correctly performs this check, but products do not.

**Impact:** A seller can list another creator’s paid assets inside their own bundle, receive payment, and create bundle-based entitlement to those assets through `canUserAccessAsset`.

**Fix:** In one database transaction, verify every asset is owned/licensed by the seller and eligible for bundling before creating ProductItems. Add a unique product/asset constraint and rights model for authorized resellers.

### M-01 — View-limit race conditions

**Evidence:** `app/api/burnlinks/[slug]/access/route.ts:77-98`

The route reads `viewsUsed`, checks limits, then increments in a separate query. Concurrent requests using the same token can all pass the check. Signed media URLs can remain valid after the access response increments the final allowed view.

**Fix:** Use an atomic conditional update (`viewsUsed < limit` and active/expiry constraints), treat successful update count as authorization, and issue a single-use/short-lived stream capability. Decide whether a “view” means authorization, first byte, or completed delivery.

### M-02 — Weak input and monetary validation

No API route uses the installed Zod package. Prices are Prisma `Float`, arithmetic uses JavaScript numbers, and many endpoints accept arbitrary strings, arrays, negative values, NaN-like conversions, dates, lengths, and enum values. Search pagination is unbounded below, messages have no size cap, and counters can be spammed.

**Fix:** Define request/response schemas for every route. Store monetary amounts as integer octas/stablecoin units or Decimal, reject negative/non-finite values, bound strings/arrays/pages, and allowlist enums/MIME types.

### M-03 — OAuth tokens are readable JWT payloads in broad cookies

**Evidence:** `lib/import-oauth.ts:67-89`

Google/Dropbox access and refresh tokens are placed in signed (JWS), not encrypted, JWTs. HttpOnly prevents JavaScript access, but signing does not provide confidentiality. Cookies use path `/` and accompany every same-site request for seven days.

**Impact:** Tokens may appear in browser cookie inspection, server/platform diagnostics, backups, or any cookie-capture incident; compromise grants cloud-drive read access.

**Fix:** Store encrypted tokens server-side keyed to the verified user/session, use a narrow opaque cookie, encrypt refresh tokens with a managed/rotatable key, minimize scopes and lifetime, and provide disconnect/revocation.

### M-04 — Missing browser hardening and overly broad media proxy

No CSP, HSTS, frame-ancestor/X-Frame-Options, Permissions-Policy, or Referrer-Policy configuration was found. The Shelby proxy streams any syntactically valid ref that is not found in the Asset/File tables, making the deployment a public Shelby egress proxy. Inline serving allows user-controlled HTML content types, although `nosniff` is present.

**Fix:** Add a nonce-based CSP and standard security headers, serve active content as attachment or from an isolated cookieless origin, require known catalog/upload records for proxy reads, rate-limit, and set safe caching rules.

### M-05 — Public reads mutate state

Asset GET and public view endpoints increment counters without authentication, idempotency, or rate limiting. Attackers can inflate reputation/trending analytics and generate database write load.

**Fix:** Queue deduplicated analytics keyed to privacy-preserving session/IP windows, rate-limit, and keep catalog reads side-effect free.

### M-06 — Missing security regression infrastructure

There are no tests, the lint script is interactive, generated build directories and terminal logs are committed, and TypeScript contains broad `any` usage in security-sensitive paths. The Move package has no tests or formal invariants.

**Fix:**

- configure ESLint CLI and CI;
- add authorization matrix tests for all 81 API routes;
- add property/unit tests for encryption and payment parsing;
- add Playwright purchase/BurnLink tests;
- add Move unit tests and invariants;
- remove generated builds/logs from version control and reproduce artifacts in CI;
- add secret scanning, SAST, dependency scanning, and protected-branch checks.

## Move contract findings

### SC-01 — Configured deployment is not present

The configured module address `0x8e99…642b6` returned `module_not_found`, and the configured platform address `0x3b89…ae6c` returned `resource_not_found` for `ForgePlatform` on the active `https://api.shelbynet.shelby.xyz/v1` ledger. Both accounts returned empty module/resource lists.

This may be a network reset or stale environment. Re-deploy, record package metadata/transaction hash/network chain ID, and verify bytecode/source before presenting the contract as deployed.

### SC-02 — Subscription entry point cannot be used

**Evidence:** `move/sources/forge.move:66-70,97-105,147-169`

`CreatorProfile.tiers` is initialized empty, but no function adds/updates/removes a Tier. `subscribe` requires an index within that vector, so it always aborts for profiles produced by `verify_creator`.

### SC-03 — Fee settings disagree and accounting is false

**Evidence:**

- Move: `move/sources/forge.move:80-84` sets 500 bps.
- App: `lib/constants.ts:1-2` defaults to 200 bps.
- UI states 2%.
- Direct APT transfers do not transfer a fee to the treasury, while database records subtract one.

Use one authoritative, versioned fee schedule and a settlement path that actually enforces/splits it.

### SC-04 — Payments are not bound to a product

BurnLink events include buyer, creator, and amount but no BurnLink/product/version ID, nonce, terms hash, or treasury/fee fields. `CreatorVerified.tx_hash` is always an empty vector. Subscriptions exist only as events and are not stored as grants onchain. A caller also chooses `platform_addr`; the module does not pin an official platform resource.

For a new contract, design explicit payment intents and receipts. Include resource identifiers and exact integer amounts; prevent replay; expose admin/treasury rotation through capability-based governance; validate nonzero/different addresses; emit complete fee and product data. Obtain a specialist Move audit before value-bearing mainnet use.

## Positive controls observed

- `.env` is ignored and no populated credential was found in tracked source.
- Session cookies are HttpOnly, Secure in production, and SameSite Strict.
- AES-256-GCM uses random 12-byte IVs and random 256-bit content/share keys.
- Key material is removed explicitly in a few direct Asset routes.
- Download filenames are sanitized; `Content-Disposition` and `nosniff` are set.
- Several object mutation routes correctly check `userId` ownership.
- Payment hashes generally have unique database constraints.
- Google/Dropbox OAuth uses a signed, short-lived random state value.
- The production TypeScript/build path succeeds.

These controls are useful foundations, but they do not offset the critical authorization and serialization failures.

## Required remediation order

### P0 — Before any continued public paid/encrypted use

- C-01, C-02, C-03, H-01, H-02.
- Disable or remove affected production endpoints until deployed.
- Inventory affected encrypted records and rotate/re-encrypt.
- Upgrade Next.js and validate image/server-action exposure.

### P1 — Before a closed paid pilot

- H-03 through H-08.
- Reconcile Shelby expiration and listing state.
- Replace floats with integer money and add schemas/rate limits.
- Add integration tests for authorization, payment replay, bundle ownership, and concurrent one-time links.
- Re-deploy/verify or remove the Move contract from the payment story.

### P2 — Before broader production

- M-01 through M-06.
- Third-party application and Move audits.
- Incident response, key rotation, backups, monitoring, abuse/takedown, privacy and disaster recovery procedures.
- Load/reliability tests with realistic dataset sizes and Shelby failure modes.

## Suggested security acceptance gates

- No route can authenticate a wallet without fresh proof of key control.
- A recursive response scanner finds zero secret fields in all public/non-entitled responses.
- An unauthorized test suite covers every API method and ownership role.
- Every payment receipt is bound to one intent/product/version/buyer and is idempotent under concurrency.
- No active listing is purchasable if its blob is uncommitted, expired, or within the renewal failure window.
- Private realtime events cannot be subscribed to without server authorization.
- A 1 GB+ encrypted upload does not buffer the whole file in the browser or application server.
- CI passes build, lint, tests, dependency policy, SAST, secret scan, and Move tests.
- A fresh network deployment can be reproduced and verified from source.
