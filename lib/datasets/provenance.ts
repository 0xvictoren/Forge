import { AccountAddress } from "@aptos-labs/ts-sdk";
import { hexToVectorU8 } from "@/lib/forge-purchase";

/** Hex-encode a UTF-8 identifier (Mongo ids are already hex, but be general). */
export function idToHex(id: string): string {
  if (/^[0-9a-f]+$/i.test(id) && id.length % 2 === 0) return `0x${id.toLowerCase()}`;
  return `0x${Array.from(new TextEncoder().encode(id), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function buildAnchorPayload(
  moduleAddress: string,
  input: { datasetId: string; versionNumber: number; manifestHash: string; datasheetHash: string; sealHash: string }
) {
  if (!moduleAddress) throw new Error("Forge contract address is not configured");
  return {
    function: `${AccountAddress.from(moduleAddress, { maxMissingChars: 63 }).toString()}::forge::anchor_provenance` as `${string}::forge::anchor_provenance`,
    typeArguments: [] as string[],
    functionArguments: [
      hexToVectorU8(idToHex(input.datasetId)),
      String(input.versionNumber),
      hexToVectorU8(input.manifestHash),
      hexToVectorU8(input.datasheetHash),
      hexToVectorU8(input.sealHash),
    ],
  };
}
