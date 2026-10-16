# Forge product, market, and feasibility study

Research date: 2026-09-28  
Repository reviewed: `main` at `5506d64`  
Scope: current Forge codebase, Shelby feasibility, decentralized-storage competition, agent/data-market demand, positioning, and delivery roadmap.

## Executive conclusion

Forge is technically credible as a testnet prototype, but it is not production-ready and it is not yet a decentralized data marketplace. Today, Shelby stores blobs while identity, catalog metadata, entitlements, encryption secrets, payments, analytics, and moderation are controlled by one Next.js/MongoDB backend. The production build passes, the public Vercel deployment responds, and many product surfaces exist, but the configured Move deployment is no longer present on the current Shelbynet ledger and critical application-security issues currently defeat authentication and paid-content protection.

The market opportunity is real if Forge narrows its focus. The best wedge is not generic file storage or another creator marketplace. It is:

> A curated, agent-native exchange for versioned datasets and live data products, with machine-readable provenance, quality evidence, licenses, access policies, and pay-per-use delivery.

The product should make a dataset or data endpoint immediately usable by an AI agent through MCP, OpenAPI/S3-compatible interfaces, HTTP range/streaming, and x402-style payments. Shelby is a good candidate for the hot, verifiable data plane, but Forge must own the higher-value trust layer: discovery, quality, lineage, licensing, delivery receipts, reputation, disputes, and lifecycle management.

The recommendation is a conditional **go** for a security-first pilot, and a **no-go** for public paid launch until the P0 security and durability blockers in `SECURITY_AUDIT.md` are fixed.

## What exists today

The repository is substantial: 255 TypeScript/TSX/Move/Prisma source files, about 24,777 lines, 81 API route files, 32 pages, and 78 React components. It contains no automated tests.

### Working or materially implemented

| Area | Current state | Assessment |
|---|---|---|
| Web application | Next.js 15/React 19 app; production build completes and generates 81 routes | Working |
| Live deployment | `https://forge-alpha-blush.vercel.app` returned HTTP 200 during review | Working at review time |
| Wallet UX | Aptos wallet adapter, wallet-aware layouts, transfers, Shelby wallet uploads | Implemented, but authentication is insecure |
| Shelby storage | Browser wallet uploads, server uploads for streams, blob proxy/download, media player integration | Implemented on Shelbynet; lifecycle gaps remain |
| Encryption | Client-side AES-256-GCM with a per-file content key and wallet-derived owner wrap | Cryptography is reasonable; authorization/key delivery is broken |
| Marketplace | Assets, bundles, vaults, explore, purchases, library, certificates | Broad implementation; not safe for paid launch |
| Creator features | Profiles, posts, stream, tips, subscriptions, invoices, analytics, referrals, chat | Implemented to varying depth |
| Imports | Google Drive OAuth; partial Dropbox scaffolding | Google path implemented; Dropbox import disabled |
| Database | Rich Prisma/MongoDB model for marketplace and social state | Working central control plane |
| Move contract | Verification, tips, subscription and BurnLink purchase functions | Source exists; current configured deployment is absent and subscription logic is incomplete |

### Partial, misleading, or non-functional areas

- The configured module address and platform resource both returned `not_found` from the current Shelbynet REST API. Local source and compiled artifacts are not proof of a live deployment.
- The app normally sends direct `0x1::aptos_account::transfer` payments and verifies them offchain. The Forge contract is not the authoritative purchase/entitlement system.
- The contract initializes creator tiers as an empty vector but has no entry function to add or update tiers, so its `subscribe` function cannot be used successfully for a normal creator.
- The app advertises a 2% platform fee, the Move contract is hard-coded to 5%, and direct-transfer flows do not actually route the recorded 2% fee to the treasury.
- “AI metadata processing” is explicitly a stub that derives keywords from filenames and tags. There is no dataset inspection, schema inference, PII detection, quality scoring, lineage, deduplication, contamination testing, or benchmark evidence.
- User-controlled wallet uploads default to only 168 hours (7 days) for every type except avatars and banners, and there is no renewal worker. Marketplace records can therefore outlive the Shelby blobs they sell.
- Client encryption and wallet upload read the entire file into browser memory. This is unsuitable for large datasets even if Shelby itself supports large, chunked uploads.
- The Stream feed explicitly leaves subscriber visibility unfinished.
- Dropbox import endpoints return a disabled response.
- The lint command launches an interactive setup prompt, so CI linting is not configured.
- Compiled output is committed: 463 `move/build` files, 445 root `build` files, and 15 terminal logs. This makes reviews and supply-chain inspection noisier.

## Current architecture and decentralization reality

```text
Creator wallet
  | signs Shelby upload / APT transfer
  v
Browser (optional AES-GCM encryption)
  | ciphertext                         | metadata + wrapped keys
  v                                    v
Shelby hot blob storage          Next.js API + MongoDB
  ^                                    |
  | proxy read after server ACL        | purchases, grants, profiles,
  |                                    | search, analytics, chat, OAuth
Buyer / agent <------------------------+

Move contract: separate payment/profile experiment; not the source of truth
Pusher: real-time events
S3: legacy Stream fallback
```

This architecture is a hybrid application with decentralized blob storage, not a decentralized marketplace. That can still be a sensible product: full decentralization is not automatically valuable. The important requirement is to make trust boundaries explicit and progressively minimize the backend’s power over ownership, access, keys, and receipts.

## Shelby feasibility

### Why Shelby fits

Shelby is designed for read-heavy, low-latency data rather than cold archival storage. Its published design separates control and data planes, uses erasure coding, pays for reads, and targets demanding workloads such as AI pipelines, analytics, and streaming. Its official materials also emphasize protocol-level ownership/access policy and cross-chain SDKs for Aptos, EVM, and Solana.

This matches Forge better than permanent archival networks when the product is live agent access to frequently read data, previews, evaluation sets, versioned snapshots, or query results.

### Current constraints

- Current official evidence still describes Shelby as Early Access on testnet, with production expected later in 2026. The developer portal remains an early-access application, the docs use `Network.TESTNET`, and the explorer describes itself as beta/testnet. No authoritative mainnet-launch announcement was found during this review.
- Storage is time-bound. Forge must track onchain expiration, fund renewals, notify owners, and define what happens when a listing’s storage expires.
- API keys affect rate limits, so Forge needs quota monitoring and graceful degradation.
- Shelby retrieval does not itself solve confidential access once plaintext or a decryption key reaches a buyer. No downloadable dataset can be made uncopyable. Forge should sell enforceable licenses, receipts, access modes, and reputation—not promise DRM.
- Production should support an export/migration path and possibly a second storage backend until Shelby has sufficient production history for enterprise buyers.

### Feasibility verdict

| Dimension | Verdict | Reason |
|---|---|---|
| Prototype/pilot on testnet | Yes | Existing SDK integration and UI are enough after security fixes |
| Large-dataset upload | Not yet | Full-buffer browser encryption/upload and no multipart encrypted flow |
| Durable catalog | Not yet | 7-day default wallet blob lifetime and no renewal reconciliation |
| Confidential paid data | Not yet | Key leaks and bypasses; centralized share secret model |
| Agent-facing reads | Feasible | HTTP/MCP/x402 layer can sit over Shelby; not implemented yet |
| Enterprise/regulated data | Not initially | Jurisdiction, deletion, DPA, audit, privacy, key custody, and SLA gaps |
| Production mainnet launch | Blocked | Current Shelby maturity plus application security/deployment blockers |

## Market landscape

### Competitor map

| Category | Examples | Strength | Gap Forge can exploit |
|---|---|---|---|
| General decentralized storage | Filecoin/IPFS, Storj, Akave | Capacity, ecosystem, S3/IPFS compatibility | Storage is not a trusted, agent-ready data product; retrieval and onboarding can be fragmented |
| Permanent storage | Arweave/ar.io | Permanent, verifiable publishing and mature gateways | Expensive for large changing datasets; deletion/update semantics are poor for regulated data |
| High-performance blob storage | Shelby, Walrus | Erasure-coded decentralized blobs and fast reads | Blobs are not a marketplace; Walrus explicitly provides no confidentiality and no region choice |
| Open dataset hubs | Hugging Face, Kaggle | Distribution, community, integrations, previews | Monetization, programmable per-use rights, commercial provenance, and agent purchasing are limited |
| Centralized data exchanges | AWS Data Exchange, Snowflake Marketplace | Enterprise procurement, governance, existing buyers | Human sales/procurement, cloud lock-in, egress economics, limited onchain auditability |
| Decentralized data markets | Ocean Protocol, Sahara AI, Vana | Tokenized access, data ownership, licenses, compute-to-data or data collectives | User experience, liquidity, buyer trust, quality assurance, and agent-native delivery remain open battlegrounds |
| Agent service markets | x402 directories and paid APIs | Machine-native discovery/payment | Often sell API calls, not versioned, independently verifiable data products with quality and lineage |

Forge must not claim that no one combines AI assets, blockchain ownership, and monetization. Sahara already supports monetized datasets and licenses; Ocean offers Compute-to-Data; Vana focuses on user-controlled data; Hugging Face has mature gated distribution. Forge’s differentiation must be narrower and operationally provable.

### Demand signals and recurring complaints

The social evidence is qualitative, not a statistically representative survey, but several patterns repeat:

1. **Quality beats raw volume.** Practitioners complain about duplicate, refusal-heavy, poorly labeled, weakly spot-checked training sets and the cost of real curation.
2. **Provenance and usable licensing are purchase requirements.** Buyers ask for clear commercial training rights, origin traceability, PII/copyright status, and documented transformations.
3. **Integration matters.** Data engineers want API or S3 access, schemas, and easy ETL integration—not a token-gated download page.
4. **Retrieval reliability is a real decentralized-storage pain.** IPFS users report slow or non-functional public gateways; official IPFS troubleshooting material calls a public gateway an additional failure point.
5. **Pricing predictability and trust matter.** Cloud users complain about egress and surprise bills; decentralized-storage users react strongly to minimum-fee changes and unstable operator economics.
6. **Creators lack capture.** Dataset creators observe that expensive curation is scraped or reused without payment or even attribution.
7. **Agents need a machine purchase path.** x402 standardizes an HTTP `402` payment challenge and is explicitly designed for agents buying data/APIs without signup. MCP provides the discovery/tool interface but requires correct authorization.

These signals favor a product that bundles data with evidence and delivery, instead of selling anonymous files.

## Recommended market position

### Positioning

**Forge is the trusted data supply layer for agents.** Sellers publish a versioned data product once. Buyers and agents can inspect a safe sample, verify origin and quality claims, accept machine-readable rights, pay for exactly the access mode they need, and receive a verifiable delivery receipt.

Avoid leading with “decentralized storage.” Buyers purchase reliable data and clear rights; Shelby is the enabling infrastructure and trust story.

### Initial wedge

Start with **agent evaluation datasets and tool-use traces** that are:

- legally owned or explicitly contributed;
- small enough for a pilot but updated frequently;
- valuable because of labeling and curation rather than raw size;
- naturally consumed by engineering agents through an API/MCP server;
- measurable through task success, tool choice, safety, latency, and cost labels.

Examples include redacted MCP/tool-call traces, coding-agent task/evaluation suites, support-agent failure sets, structured output/grounding tests, and multilingual/local-domain agent evaluations. Do not begin with scraped personal data, medical data, biometric data, or opaque web corpora.

The second wedge can be live, frequently updated domain feeds sold per query. This uses Shelby’s hot-read properties better than a one-time bulk download and gives creators recurring revenue.

### Supply strategy

Launch curated, not permissionless:

- recruit 10–20 credible dataset creators or domain communities;
- define one mandatory manifest and quality rubric;
- manually verify rights and samples;
- offer migration/import tooling from Hugging Face, S3, Drive, and Git repositories;
- subsidize initial storage and validation;
- guarantee transparent payout accounting and stablecoin settlement.

An empty open marketplace creates adverse selection: low-quality sellers arrive before serious buyers. Curation is the moat at the start.

## What to keep, add, change, and remove

### Keep and strengthen

- Shelby wallet-owned uploads and ciphertext storage.
- Assets, bundles, vaults, library, certificates, seller reputation, and analytics.
- Google Drive import, then add Hugging Face/S3/Git imports.
- Samples/previews, but generate safe derivative samples rather than exposing full blob references or secrets.
- Wallet-native settlement and verifiable receipts.

### Add before a market pilot

1. **Dataset manifest**
   - content digest/Merkle root, version, previous version, schema, formats, size/row count, splits;
   - source lineage and transformation steps;
   - SPDX-style license plus machine-readable commercial-training, derivative, redistribution, geography, expiry, and attribution rights;
   - PII, consent, copyright, safety, and collection-method declarations.

2. **Quality evidence**
   - schema validation, null/error statistics, deduplication, language/domain distributions;
   - contamination and benchmark-overlap checks where relevant;
   - human spot-check plan and sample audit results;
   - buyer reviews tied to verified purchases and dataset versions.

3. **Agent-native delivery**
   - MCP server for search, sample, purchase, fetch/query, and receipt verification;
   - OpenAPI and signed HTTP URLs with byte-range/stream support;
   - x402-compatible per-query, per-batch, or per-version access;
   - explicit agent spending limits, idempotency keys, and purchase receipts.

4. **Access modes**
   - full encrypted snapshot download;
   - paid query/slice API;
   - time-limited subscription to updates;
   - later, privacy-preserving compute-to-data for sensitive assets.

5. **Storage lifecycle**
   - expiration indexer, automatic renewal, funding alerts, retry/dead-letter queue;
   - availability probes and integrity checks;
   - versioned immutable manifests with mutable “latest” pointers;
   - export/migration and secondary-backend policy.

6. **Commercial trust**
   - escrow or delayed settlement, dispute/refund workflow, takedown process;
   - seller verification and proof-of-rights review;
   - terms for prohibited data, sanctions, privacy requests, and repeat infringement;
   - stablecoin prices. APT can remain an optional payment rail, not the accounting unit.

7. **Secure key architecture**
   - per-buyer envelope keys or public-key re-wrapping;
   - never return a reusable global share secret;
   - key rotation/revocation for future accesses;
   - separate secrets and metadata stores with audit logs.

### Deprioritize or remove from the initial product

- generic creator feed and short-form video;
- hiring directory;
- tips, social following, general chat, and generic freelancing invoices;
- broad “sell any digital asset” positioning;
- legacy S3 Stream upload paths after migration;
- fake or stub “AI metadata” claims.

These features create a wide attack surface and distract from dataset trust, ingestion, and agent delivery. They can return later as integrations or community layers if usage proves the need.

## Business model

A workable model is a transparent mix of:

- 5–10% marketplace fee on dataset/version purchases;
- lower 2–5% take on high-volume pay-per-query access;
- seller subscription for validation, private listings, teams, and SLA analytics;
- enterprise plan for private catalogs, policy controls, audit exports, and support;
- pass-through storage/read costs shown separately from Forge’s fee.

Do not record a fee that is not actually collected. Prices and balances should use integer smallest units and stablecoin-denominated quotes. Publish the fee split in the payment intent and receipt.

## 90-day execution plan

### Days 0–14: stop-the-line security

- Fix every P0/P1 item in `SECURITY_AUDIT.md`.
- Rotate any secrets or content keys that may have been exposed through affected APIs.
- Disable paid listings/BurnLinks until key leakage and authentication are fixed.
- Remove public Pusher channels and legacy arbitrary-key S3 endpoints.
- Upgrade vulnerable dependencies, add security headers, rate limits, validation, and audit logging.
- Re-deploy and verify the Move package or explicitly remove contract claims from the product.

### Days 15–45: dataset core

- Remove unrelated navigation from the pilot build.
- Implement dataset/version/manifest/license models.
- Build chunked, resumable, encrypted large-file upload and renewal reconciliation.
- Add safe sample generation and automated quality checks.
- Use stablecoin-denominated payment intents bound to buyer, seller, product version, amount, expiry, and nonce.
- Add unit, API authorization, contract, and end-to-end tests.

### Days 46–75: agent interface

- Ship MCP and OpenAPI discovery/search/sample endpoints.
- Add x402-compatible pay-per-query or pay-per-version access.
- Return signed receipts containing dataset version digest, terms digest, price, buyer, seller, and delivery result.
- Add SDK examples for a coding agent and a data pipeline.

### Days 76–90: curated design-partner pilot

- Onboard 10–20 sellers and 3–5 buyer teams.
- Run every listing through rights and quality review.
- Measure retrieval success, latency, repeat usage, refunds, renewal reliability, and seller earnings.
- Keep production value limits low until Shelby production readiness and the security program mature.

## Pilot success metrics

Use operational and market proof, not vanity wallet counts:

- at least 99.9% successful authorized reads during the pilot;
- no expired blob while a listing is active;
- median time from discovery to first usable sample under 60 seconds for an agent;
- at least 30% of activated buyers make a second paid data access within 30 days;
- fewer than 5% of purchases disputed for quality mismatch;
- every paid delivery has a version/terms/payment receipt;
- positive gross margin after Shelby reads/storage, chain fees, validation, and support;
- at least five datasets with repeat paid access by unrelated buyers.

## Key risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Shelby is still pre-production | Network/reset/API changes can invalidate blobs and deployments | Pilot limits, lifecycle monitor, export path, optional second backend |
| Marketplace cold start | Buyers want quality; sellers want buyers | One vertical, curated supply, design partners, subsidized validation |
| Data rights/privacy | Decentralization does not legalize collection or remove obligations | Rights review, prohibited categories, consent/provenance records, takedown, avoid PII initially |
| Data copying after purchase | Encryption cannot stop an authorized buyer copying plaintext | Query access, licenses, watermarking where appropriate, receipts, reputation, legal enforcement |
| Bad data/adverse selection | Open marketplaces attract low-quality supply | Mandatory manifests, automated checks, samples, verified reviews, seller bonds/escrow later |
| Crypto payment friction | Volatile APT and wallet prompts reduce conversion | Stablecoin unit of account, sponsored gas/account abstraction, optional conventional checkout |
| Central control-plane trust | Mongo/API can mint or revoke access | Signed append-only receipts, onchain product/version commitments, minimized key custody, public audit log |

## Research sources

Primary and official sources:

- Shelby documentation: https://docs.shelby.xyz/
- Shelby technical paper: https://arxiv.org/abs/2506.19233
- Aptos announcement of Shelby Early Access (2026-03-05): https://aptosnetwork.com/currents/shelby-early-access-is-live-on-aptos-testnet
- Shelby Ethereum Kit/cross-chain docs: https://docs.shelby.xyz/sdks/ethereum-kit
- Shelby developer early-access portal: https://developers.shelby.xyz/
- Filecoin documentation: https://docs.filecoin.io/
- Walrus data-security model: https://docs.wal.app/docs/data-security
- Walrus epochs and renewal: https://docs.wal.app/docs/console/storage-epochs
- ar.io/Arweave console and pricing: https://console.arweave.net/
- Sahara AI Marketplace: https://docs.saharaai.com/user-guide-marketplace
- Ocean Compute-to-Data: https://docs.oceanprotocol.com/developers/compute-to-data
- Vana: https://vana.org/
- Hugging Face gated datasets: https://huggingface.co/docs/hub/datasets-gated
- MCP authorization specification: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/basic/authorization.mdx
- x402 standard and ecosystem metrics: https://www.x402.org/
- x402 reference implementation: https://github.com/x402-foundation/x402
- AWS S3 pricing: https://aws.amazon.com/s3/pricing/
- Google Cloud Storage pricing: https://cloud.google.com/storage/pricing

Qualitative community evidence (directional, not representative market sizing):

- IPFS gateway reliability complaint: https://www.reddit.com/r/ipfs/comments/1fdcwvs/is_the_gateway_situation_hopeless/
- Official IPFS troubleshooting context: https://docs.ipfs.tech/how-to/troubleshooting/
- Dataset quality discussion: https://www.reddit.com/r/LocalLLaMA/comments/1ps6w96/dataset_quality_is_not_improving_much/
- Demand for commercial licensing and unique data: https://www.reddit.com/r/datasets/comments/1re8ll4/where_can_i_buy_high_qualityunique_datasets_for/
- Curated marketplace expectations: https://www.reddit.com/r/dataengineering/comments/1mf0sdy/would_a_curated_marketplace_for_exclusive_verified/
- Provenance/licensing concern: https://www.reddit.com/r/LLMDevs/comments/1pxak0p/whats_the_actual_market_for_licensed_curated/
- Storj pricing/trust reaction: https://www.reddit.com/r/storj/comments/1uwe4n4/rolling_back_on_the_minimum/
- Cloud egress/lock-in discussion: https://www.reddit.com/r/dataengineering/comments/1oo5rpu/why_everyone_is_migrating_to_cloud_platforms/

## Research caveat

Social posts reveal hypotheses and vocabulary, not market size. Before building beyond the 90-day pilot, run 15 seller interviews and 15 buyer interviews, ask for concrete recent purchasing/curation workflows, and obtain paid or signed design-partner commitments. Do not treat waitlist signups or general enthusiasm for “decentralized AI” as demand validation.
