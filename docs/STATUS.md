# Forge: where we are (16 October 2026)

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

## Onchain

| Item | Value |
|---|---|
| Network | Aptos ShelbyNet |
| Forge contract | `0x8e9918d910feda3733f078af8fcf17e4a07eed9e255f4261779ca1ba55c642b6::forge` |
| Treasury | `NEXT_PUBLIC_PLATFORM_ADDRESS` |
| Shelby micropayments | `0x1ae7275148bf6ef742b658fd9cbcc2e094201606f4a7bc707bab0201da8043ee::micropayments` |
| Agent payment asset | APT as fungible asset (`0xa`) |

## Verified live
- Seal + anchor, paid licence settlement, replay protection, free licences, revocation, proofs, compliance export (`npm run e2e`).
- Agent channel open, all payment rejections (forged key, underpayment, over balance, replay), no charge on failed delivery, onchain receiver withdraw (`npm run e2e:agents`).
- Signed agent requests, feeds, memory chain and onchain Merkle anchor (`scripts/e2e-agent-extras.mts`).

## Not yet verified (needs test funds)
The ShelbyNet faucet allows 10 requests per day and was exhausted during testing.
1. **Storage uploads and real file delivery**: need ShelbyUSD on the seller wallet. Then `npm run e2e` and `npm run e2e:agents` run the full storage path.
2. **Seller payout leg of settlement**: a MongoDB filter bug was fixed after the last run; rerun `npm run e2e:agents`.
3. **Sponsored storage**: needs ShelbyUSD on the settlement account and `FORGE_SPONSOR_STORAGE=true`.

## Fixed along the way (pre-existing bugs)
- Shelby SDK 0.7 no longer matched Shelby's onchain contract, so every upload failed. Upgraded to `@shelby-protocol/sdk` 0.9.2 and `@shelby-protocol/react` 4.3.0.
- Hash arguments were sent to the contract as text, so purchases could never settle. They are now raw bytes.
- On MongoDB, Prisma `field: null` filters miss unset fields, which broke payment intents and payouts. Fixed with `isSet` filters and partial unique indexes (`npm run db:indexes`).

## Configuration
See `.env.example`. Set `CRON_SECRET` in Vercel as well. Optional: `FORGE_SETTLEMENT_PRIVATE_KEY` for a dedicated settlement account.

## Next steps
1. Top up test APT and ShelbyUSD, then rerun the E2E scripts.
2. Turn on sponsored storage once the settlement account holds ShelbyUSD.
3. Multipart upload for files above 1.8 GB.
4. Video A/B watermarking and compute-to-data (deferred phases of anti-sharing).
5. Old creator features (stream, chat, vaults) are hidden from the nav, not deleted. Decide whether to remove them.
