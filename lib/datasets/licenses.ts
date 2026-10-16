import { canonicalJson, sha256Hex } from "./hash";

export const LICENSE_TEMPLATES = ["RESEARCH", "COMMERCIAL", "EXCLUSIVE"] as const;
export type LicenseTemplate = (typeof LICENSE_TEMPLATES)[number];
/** METERED is issued automatically to agents that pay per read; it is never "offered". */
export type LicenseKind = LicenseTemplate | "METERED";

export type LicenseOffer = { template: LicenseTemplate; priceApt: number };

export type LicenseTemplateInfo = {
  id: LicenseKind;
  name: string;
  tagline: string;
  grants: string[];
  restrictions: string[];
};

export const LICENSE_INFO: Record<LicenseKind, LicenseTemplateInfo> = {
  RESEARCH: {
    id: "RESEARCH",
    name: "Research",
    tagline: "Non-commercial research and evaluation.",
    grants: [
      "Train and evaluate models for non-commercial research",
      "Publish results, metrics and papers",
      "Use inside one organisation",
    ],
    restrictions: [
      "No commercial products or paid services",
      "No redistribution of the data or derived subsets",
    ],
  },
  COMMERCIAL: {
    id: "COMMERCIAL",
    name: "Commercial",
    tagline: "Train models you ship and sell.",
    grants: [
      "Train, fine-tune and evaluate commercial models",
      "Deploy and monetise models trained on the data",
      "Use across all teams inside one organisation",
      "Receive updates to this dataset version line",
    ],
    restrictions: [
      "No redistribution or resale of the data itself",
      "No sharing outside the licensee organisation",
    ],
  },
  EXCLUSIVE: {
    id: "EXCLUSIVE",
    name: "Exclusive",
    tagline: "Sole commercial rights. Delisted after purchase.",
    grants: [
      "Everything in Commercial",
      "The seller stops licensing this dataset to anyone else",
      "Dataset is removed from the marketplace",
    ],
    restrictions: [
      "No redistribution or resale of the data itself",
      "Existing licences issued before purchase remain valid",
    ],
  },
  METERED: {
    id: "METERED",
    name: "Metered",
    tagline: "Pay per read. Built for agents.",
    grants: [
      "Read any part of the dataset on demand, paid per byte delivered",
      "Train, fine-tune, evaluate and retrieve with the data you read",
      "Use the results in commercial products",
      "Covers later sealed versions of this dataset",
    ],
    restrictions: [
      "No redistribution or resale of the data itself",
      "Only bytes paid for through a valid micropayment are licensed",
    ],
  },
};

export function isLicenseKind(value: unknown): value is LicenseKind {
  return value === "METERED" || isLicenseTemplate(value);
}

export function isLicenseTemplate(value: unknown): value is LicenseTemplate {
  return typeof value === "string" && (LICENSE_TEMPLATES as readonly string[]).includes(value);
}

export function parseOffers(value: unknown): LicenseOffer[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: LicenseOffer[] = [];
  for (const raw of value) {
    const o = raw as Partial<LicenseOffer>;
    if (!isLicenseTemplate(o?.template) || seen.has(o.template)) continue;
    const price = Number(o.priceApt);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) continue;
    seen.add(o.template);
    out.push({ template: o.template, priceApt: Math.round(price * 1e8) / 1e8 });
  }
  return out.sort((a, b) => LICENSE_TEMPLATES.indexOf(a.template) - LICENSE_TEMPLATES.indexOf(b.template));
}

/**
 * The full licence text a buyer agrees to. Its hash is bound into the payment
 * intent's terms hash, which is settled onchain, so the exact wording a buyer
 * accepted can always be proven later.
 */
export function renderLicenseText(input: {
  template: LicenseKind;
  datasetTitle: string;
  datasetId: string;
  versionNumber: number;
  sealHash: string;
  sellerName: string;
}): string {
  const info = LICENSE_INFO[input.template];
  return [
    `FORGE DATA LICENCE: ${info.name.toUpperCase()} (forge.license/${input.template.toLowerCase()}/v1)`,
    ``,
    `Dataset: ${input.datasetTitle} (${input.datasetId})`,
    `Version: v${input.versionNumber}, provenance seal ${input.sealHash}`,
    `Licensor: ${input.sellerName}`,
    ``,
    `1. Grant. The Licensor grants the Licensee a non-transferable licence to:`,
    ...info.grants.map((g) => `   • ${g}`),
    ``,
    `2. Restrictions. The Licensee may not:`,
    ...info.restrictions.map((r) => `   • ${r}`),
    ``,
    `3. Fingerprinting. Each delivered copy carries marks unique to this licence. A copy found outside`,
    `   the Licensee organisation is attributable to this licence and is a material breach.`,
    ``,
    `4. Breach. On breach the Licensor may revoke access and seek damages. Data obtained outside this`,
    `   licence carries no right of use and cannot be cited in a Forge compliance record.`,
    ``,
    `5. Provenance. The Licensor declares that the datasheet sealed with this version is accurate and`,
    `   that it holds the rights needed to grant this licence.`,
    ``,
    `6. Evidence. This licence is identified by the settlement transaction on Aptos and the licence`,
    `   certificate issued by Forge.`,
  ].join("\n");
}

export async function licenseTextHash(text: string): Promise<string> {
  return sha256Hex(canonicalJson({ schema: "forge.license-text/v1", text }));
}
