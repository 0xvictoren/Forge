# Forge: where we are (20 October 2026)

Forge has pivoted from creator media sharing to **a marketplace for AI training data with provenance built in**, plus an **agent layer** so AI agents can find, verify, pay for and read data on their own. It runs on Shelby (storage) and Aptos ShelbyNet (settlement and seals).

## Why the pivot

Shelby now positions itself as S3-compatible storage for AI, agents and distributed compute (private beta since 29 September 2026). Consumer storage apps on similar networks have struggled. Licensed, verifiable training data is a real, paid problem: buyers need provenance for compliance (EU AI Act), sellers need protection against copies being shared.

## What is built

### Data marketplace (humans)
- **Sell (`/studio`)**: wizard to upload, describe, price and seal a dataset. Files are hashed and encrypted in the browser (chunked AES-256-GCM, format FGC2) before upload to Shelby.
- **Seal**: manifest + datasheet hashes anchored onchain with the Forge contract (`anchor_provenance`). Public proof pages (`/proof/:id`, `/verify`) recompute everything and re-check the chain.
- **Licences**: Research, Commercial, Exclusive. Licence text is hashed into the onchain settlement (`settle_purchase`). Certificates at `/license/:slug`.
- **Anti-sharing**: every text delivery (CSV, TSV, JSON, JSONL, TXT) carries per-licence canary rows and an invisible signature. Sellers trace leaks in Studio, revoke licences, and see every download.
- **Pipeline access**: one-hour bearer tokens for training jobs.
- **Compliance (`/compliance`)**: training-data records structured after the EU AI Office template, exported as JSON or a printable report.
- **Storage availability**: proof pages show live whether files are committed on Shelby.

### Agent layer (`/agents`)
- **Pay-per-read**: agents open one Shelby micropayment channel to Forge and pay per byte, offchain, on every read (HTTP 402, sign, read). Byte ranges supported. Never charged for failed deliveries. Each agent gets a Metered licence per dataset, fingerprinted like human purchases.
- **Fund an agent**: a human funds a budget; the browser generates a session key registered on the channel, so the agent never holds the wallet.
- **Settlement**: hourly cron withdraws from channels onchain and pays sellers 95% (5% platform fee to the treasury). Sellers can also settle on demand from Studio.
- **MCP server**: hosted at `/api/mcp` and a local stdio server (`npm run mcp`) that keeps the agent's key on its machine. Ten tools: search, dataset, verify, quote, read, channel status, cite sources, list versions, remember, verify memory.
- **Live feeds**: signed webhooks when a new dataset version is sealed, or polling `/api/agent/datasets/:id/versions?since=N`.
- **Memory vaults**: hash-chained memory checkpoints, anchored onchain hourly as a Merkle root, publicly verifiable.
- **Sponsored storage** (off by default): Forge co-signs Shelby's sponsored registration so sellers need no ShelbyUSD.
- **Seller CLI** (`npm run upload-dataset`): encrypt, upload, seal and publish whole folders with no wallet prompts.

### Design
Apple-style interface with liquid glass (after Aave's "Building glass for the web"), Forge orange `#F4770A`, original logo files.

### Added 20 October 2026
- **Originality check** (`services/originality`, Python + FastAPI): every upload is fingerprinted on the seller's device before encryption (keyed 5-word shingle hashes for text, perceptual hashes for images and video frames, SHA-256 for everything) and compared with every sealed dataset on Forge. Score out of 10 = uniqueness, added value, no internal repeats and documentation; heavily copied data is capped. Below 5 the upload is refused with tips, and sealing needs every data file covered by a passing check. Only keyed hashes are stored. Web comparison is stubbed (`originality/web.py`) for a search provider later.
- **Ratings out of 10**: start at the originality score and move with buyer conversion, agents that return, agents that look and walk away, and 1 to 10 ratings from licence holders (dataset page and the MCP `rate_dataset` tool). Hourly cron `/api/cron/ratings`. Agent search lists best-rated first.
- **Email sign-in** (Privy): email code or Google creates an embedded Aptos key; a "Forge account" wallet (`lib/privy/forge-account-wallet.ts`) plugs it into the wallet adapter so every flow works unchanged. Forge pays gas for these accounts (`/api/sponsor/gas`, Forge contract, Shelby and micropayments only, capped per day). Sponsored storage now also has Forge as fee payer.
- **New landing page**: light, Apple-style, shows the product instead of stock photos.

Verified live on ShelbyNet (20 October): `e2e` (original data 8.1/10 passes; the same data re-listed scores 2.1 and is refused), `e2e:agents`, `e2e:sponsor`, and the new `e2e:email` (an account with 0 APT signs in and lands a Forge-sponsored transaction). Privy's own login could not be tested without an app ID.

## Onchain

| Item | Value |
|---|---|
| Network | Aptos ShelbyNet |
| Forge contract | `0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6::forge` |
| Treasury | `NEXT_PUBLIC_PLATFORM_ADDRESS` |
| Shelby micropayments | `0x1ae7275148bf6ef742b658fd9cbcc2e094201606f4a7bc707bab0201da8043ee::micropayments` |
| Agent payment asset | APT as fungible asset (`0xa`) |

## Verified live (19 October 2026, ShelbyNet)
- **Datasets** (`npm run e2e`): encrypted upload to Shelby, seal + anchor, paid licence settlement, replay protection, free licences, fingerprinted delivery, pipeline pull, leak tracing (canaries and SHA-256), revocation, proofs, compliance export.
- **Agents** (`npm run e2e:agents`): channel open, every payment rejection (forged key, underpayment, over balance, replay), real paid reads from Shelby (ranged and full, fingerprinted to the Metered licence), onchain receiver withdraw, seller paid exactly 95% onchain.
- **Agent extras** (`scripts/e2e-agent-extras.mts`): signed agent requests, feeds, memory chain and onchain Merkle anchor.
- **Sponsored storage** (`npm run e2e:sponsor`, server started with `FORGE_SPONSOR_STORAGE=true`): a seller with no ShelbyUSD uploads, Forge co-signs and pays the fee, quota is charged from the onchain events, and the blob reads back intact. Path and session-binding abuse checks pass.

Run `npm run e2e:cleanup` afterwards to remove test datasets. The faucet allows 10 requests per day; the scripts fall back to the funder key (`SHELBY_SIGNER_PRIVATE_KEY`) for APT and ShelbyUSD when it can cover them.

## Fixed along the way (pre-existing bugs)
- Shelby SDK 0.7 no longer matched Shelby's onchain contract, so every upload failed. Upgraded to `@shelby-protocol/sdk` 0.9.2 and `@shelby-protocol/react` 4.3.0.
- Hash arguments were sent to the contract as text, so purchases could never settle. They are now raw bytes.
- On MongoDB, Prisma `field: null` filters miss unset fields, which broke payment intents and payouts. Fixed with `isSet` filters and partial unique indexes (`npm run db:indexes`).
- A buyer holding several licences got deliveries bound to the newest one, so a free Research licence claimed after a paid Commercial one made every copy trace back as research use. Deliveries, pipeline tokens and the access list now bind to the broadest licence held.
- The agent client detected an `Account` signer with `instanceof`, which fails when the host loads two copies of the Aptos SDK (ESM + CJS), so real paid reads crashed while signing. It now checks the shape instead.

## Configuration
See `.env.example`. Set `CRON_SECRET` in Vercel as well. Optional: `FORGE_SETTLEMENT_PRIVATE_KEY` for a dedicated settlement account.

## Next steps
0. Before deploying: host the originality service (Dockerfile in `services/originality`) and set `ORIGINALITY_SERVICE_URL` + `ORIGINALITY_SERVICE_SECRET` in Vercel, or every upload is refused. Create a Privy app and set `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` for email sign-in. Turn on `FORGE_SPONSOR_STORAGE` so email sellers can store files without ShelbyUSD.
1. Decide when to turn on sponsored storage in production (`FORGE_SPONSOR_STORAGE=true`). The settlement account holds about 0.5 ShelbyUSD, enough for small datasets only.
2. Multipart upload for files above 1.8 GB.
3. Video A/B watermarking and compute-to-data (deferred phases of anti-sharing).
4. Old creator features (stream, chat, vaults) are hidden from the nav, not deleted. Decide whether to remove them.
