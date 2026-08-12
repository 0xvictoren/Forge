# Client-side encryption (Forge)

## Security model

```
┌─────────────┐   AES-256-GCM    ┌────────────┐
│  Plaintext  │ ───────────────► │  Ciphertext│ ──► Shelby (blob only)
│   (browser) │   random key Kf  │  IV || ct  │
└─────────────┘                  └────────────┘
       │
       │ wrap Kf
       ├──────────────────► wrappedKeyOwner  (wallet-derived key via HKDF)
       └──────────────────► wrappedKeyShare  (random share secret)
                              encryptionShareKey stored in MongoDB
                              (released only after ownership / payment / unlock)
```

### What never leaves the browser unencrypted
- Media plaintext
- Raw content key `Kf` (only wrapped forms are POSTed)

### What Shelby stores
- Ciphertext only (`IV (12) || ciphertext+tag`)

### What MongoDB stores
- `blobRef` / `blobId` (existing `shelby:{address}::{path}`)
- `isEncrypted`, `encryptionVersion`
- `wrappedKeyOwner`, `wrappedKeyShare`, `encryptionShareKey`

### Who can decrypt
| Role | Path |
|------|------|
| Owner | Sign deterministic message → HKDF → unwrap `wrappedKeyOwner` |
| Buyer / unlock | After payment or grant, API returns share material → unwrap `wrappedKeyShare` |

### Honest limits
- **Owner path** is wallet-bound: only the signing wallet can re-derive the owner wrap key.
- **Share path** is *server-mediated*: the share secret is released by API after access checks. A compromised DB that also serves authorized responses can facilitate decryption for multi-party access. Ciphertext remains useless without key material.
- Thumbnails should stay unencrypted for marketplace previews.

## Example: encrypt then upload

```ts
import { useContentEncryption } from "@/hooks/use-content-encryption";
import { useShelbyWalletUpload } from "@/hooks/use-shelby-wallet-upload";

const { encryptForUpload } = useContentEncryption();
const { uploadFile } = useShelbyWalletUpload();

// Option A — encrypt helper + upload
const { encryptedFile, material } = await encryptForUpload(file);
// upload encryptedFile to Shelby, then POST material to /api/assets or /api/burnlinks

// Option B — hook does both
const result = await uploadFile(file, "media", { encrypt: true });
// result.encryption is EncryptionMaterial to persist
```

## Example: decrypt after unlock

```ts
import { useEncryptedDownload } from "@/hooks/use-encrypted-download";

const { decryptAndDownload } = useEncryptedDownload();

const pkg = await fetch(`/api/assets/${id}/decrypt-package`).then((r) => r.json());
await decryptAndDownload({
  ciphertextUrl: pkg.streamUrl,
  keyPackage: pkg.encryption,
  fileName: pkg.fileName,
  asOwner: pkg.asOwner,
});
```

## Ciphertext format

```
[ 12-byte IV | AES-GCM ciphertext | 16-byte auth tag ]
```

Auth tag is appended by Web Crypto GCM; decrypt expects the same packing.

## Wallet derivation message

Stable strings in `lib/encryption.ts`:

- Message: `Forge Content Encryption Key v1 — …`
- Nonce: `forge-cek-v1`
- HKDF salt / info: `forge-wallet-key-v1` / `forge-aes-256-gcm-v1`

Changing these permanently loses access to existing owner-wrapped keys.
