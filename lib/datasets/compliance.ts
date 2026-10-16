import type { Datasheet, SourceType } from "./manifest";
import { SOURCE_TYPE_LABELS } from "./manifest";

/**
 * Builds a training-data record structured after the sections of the EU AI
 * Office "public summary of training content" template for general-purpose AI
 * models. It is a draft to support providers - not legal advice - and the UI
 * says so wherever it is shown.
 */

export type ComplianceDatasetEntry = {
  datasetTitle: string;
  datasetUrl: string;
  versionNumber: number;
  sealHash: string;
  manifestHash: string;
  anchorTxHash: string | null;
  anchorExplorerUrl: string | null;
  totalBytes: number;
  fileCount: number;
  relationship: "LICENSED" | "OWN";
  license?: {
    template: string;
    certificateUrl: string;
    txHash: string;
    termsHash: string;
    issuedAt: string;
    licensor: string;
  };
  datasheet: Datasheet | null;
};

export type ComplianceRecordInput = {
  projectName: string;
  modelName?: string | null;
  providerName?: string | null;
  purpose?: string | null;
  generatedAt: string;
  entries: ComplianceDatasetEntry[];
};

const SECTION_FOR_SOURCE: Record<SourceType, string> = {
  PUBLICLY_AVAILABLE: "2.1 Publicly available datasets",
  LICENSED_FROM_THIRD_PARTY: "2.2 Private datasets obtained from third parties",
  SELF_COLLECTED: "2.6 Other sources of data (collected by the provider)",
  WEB_CRAWLED: "2.3 Data crawled and scraped from online sources",
  USER_CONTRIBUTED: "2.4 User data",
  SYNTHETIC: "2.5 Synthetic data",
};

function sectionFor(entry: ComplianceDatasetEntry): string {
  // Anything licensed through Forge is, from the buyer's perspective, a
  // private dataset obtained from a third party - whatever its origin.
  if (entry.relationship === "LICENSED") return SECTION_FOR_SOURCE.LICENSED_FROM_THIRD_PARTY;
  return entry.datasheet ? SECTION_FOR_SOURCE[entry.datasheet.sourceType] : "2.6 Other sources of data";
}

export function buildComplianceRecord(input: ComplianceRecordInput) {
  const modalities = new Set<string>();
  const languages = new Set<string>();
  const geographies = new Set<string>();
  let personalData = false;
  let tdmRespectedEverywhere = true;
  let start: string | null = null;
  let end: string | null = null;

  for (const e of input.entries) {
    const d = e.datasheet;
    if (!d) continue;
    d.modalities.forEach((m) => modalities.add(m));
    d.languages.forEach((l) => languages.add(l));
    d.geographies.forEach((g) => geographies.add(g));
    personalData ||= d.containsPersonalData;
    tdmRespectedEverywhere &&= d.respectsTdmOptOut;
    if (d.collectionStart && (!start || d.collectionStart < start)) start = d.collectionStart;
    if (d.collectionEnd && (!end || d.collectionEnd > end)) end = d.collectionEnd;
  }

  const sections: Record<string, ComplianceDatasetEntry[]> = {};
  for (const e of input.entries) (sections[sectionFor(e)] ||= []).push(e);

  return {
    schema: "forge.compliance-record/v1",
    disclaimer:
      "Draft structured after the EU AI Office public summary template for GPAI training content. Review with counsel before publication.",
    generatedAt: input.generatedAt,
    general: {
      project: input.projectName,
      model: input.modelName || null,
      provider: input.providerName || null,
      intendedPurpose: input.purpose || null,
      modalities: [...modalities],
      languages: [...languages],
      geographies: [...geographies],
      collectionPeriod: { start, end },
      totals: {
        datasets: input.entries.length,
        bytes: input.entries.reduce((s, e) => s + e.totalBytes, 0),
        files: input.entries.reduce((s, e) => s + e.fileCount, 0),
      },
    },
    dataSources: Object.fromEntries(
      Object.entries(sections).map(([section, entries]) => [
        section,
        entries.map((e) => ({
          dataset: e.datasetTitle,
          url: e.datasetUrl,
          version: e.versionNumber,
          origin: e.datasheet ? SOURCE_TYPE_LABELS[e.datasheet.sourceType] : null,
          description: e.datasheet?.sourceDescription || null,
          rights: e.datasheet?.rightsStatement || null,
          provenance: {
            sealHash: e.sealHash,
            manifestHash: e.manifestHash,
            anchorTransaction: e.anchorTxHash,
            explorer: e.anchorExplorerUrl,
          },
          license: e.license || null,
        })),
      ])
    ),
    dataProcessing: {
      personalDataPresent: personalData,
      consentBases: input.entries
        .map((e) => e.datasheet?.consentBasis)
        .filter((v): v is string => !!v),
      textAndDataMiningOptOutsRespected: tdmRespectedEverywhere,
      processingSteps: input.entries
        .map((e) => (e.datasheet?.processingSteps ? `${e.datasetTitle}: ${e.datasheet.processingSteps}` : null))
        .filter((v): v is string => !!v),
      knownLimitations: input.entries
        .map((e) => (e.datasheet?.knownLimitations ? `${e.datasetTitle}: ${e.datasheet.knownLimitations}` : null))
        .filter((v): v is string => !!v),
    },
  };
}

export type ComplianceRecord = ReturnType<typeof buildComplianceRecord>;
