"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { GlassSegmented } from "@/components/glass/glass-segmented";

type Lang = "ts" | "curl" | "mcp";

export function CodeTabs({ origin }: { origin: string }) {
  const [lang, setLang] = useState<Lang>("ts");
  const [copied, setCopied] = useState(false);
  const code: Record<Lang, string> = {
    ts: `import { Ed25519PrivateKey, Account } from "@aptos-labs/ts-sdk";
import { ForgeAgentClient } from "forge/agent-client"; // lib/agent-client in this repo

const session = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(process.env.FORGE_AGENT_SESSION_KEY!),
});
const forge = new ForgeAgentClient({
  baseUrl: "${origin}",
  sender: process.env.FORGE_AGENT_SENDER!,
  signer: session,
  maxPricePerReadOctas: 10_000_000n, // never pay more than 0.1 APT per read
});

const { datasets } = await forge.catalog("robot");
const { files } = await forge.dataset(datasets[0].id);
const read = await forge.read(files[0].id, { range: [0, 1_048_575] });
console.log(read.chargedOctas, read.licence);`,
    curl: `# 1. Ask: returns 402 with the price and what to sign
curl -i ${origin}/api/agent/files/FILE_ID \\
  -H "X-Forge-Agent: $FORGE_AGENT_SENDER" -H "Range: bytes=0-1048575"

# 2. Sign payment.signAmount + payment.signSequenceNumber with the session key
#    (BCS SenderBuiltMicropayment, base64), then:
curl ${origin}/api/agent/files/FILE_ID \\
  -H "X-Forge-Micropayment: $SIGNED" -H "Range: bytes=0-1048575" -o part.bin`,
    mcp: `{
  "mcpServers": {
    "forge": {
      "url": "${origin}/api/mcp",
      "headers": {
        "X-Forge-Agent": "$FORGE_AGENT_SENDER",
        "X-Forge-Session-Key": "$FORGE_AGENT_SESSION_KEY"
      }
    }
  }
}`,
  };
  return (
    <div>
      <GlassSegmented
        size="sm"
        ariaLabel="Code language"
        value={lang}
        onChange={setLang}
        className="w-[300px]"
        options={[
          { value: "ts", label: "TypeScript" },
          { value: "curl", label: "cURL" },
          { value: "mcp", label: "MCP" },
        ]}
      />
      <div className="relative mt-4">
        <pre className="mono max-h-[420px] overflow-auto rounded-[22px] bg-[var(--bg-terminal)] p-5 pr-14 text-[12.5px] leading-relaxed text-[#e5e5ea]">{code[lang]}</pre>
        <button
          type="button"
          aria-label="Copy code"
          onClick={async () => {
            await navigator.clipboard.writeText(code[lang]);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
