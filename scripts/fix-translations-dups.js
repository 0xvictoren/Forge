const fs = require("fs");
let code = fs.readFileSync("lib/i18n/translations.ts", "utf8");

const startMarkers = ["const en: Dict = {", "const ko: Dict = {", "const zh: Dict = {", "const fr: Dict = {"];
startMarkers.forEach(startMarker => {
  let idx = 0;
  while (true) {
    const start = code.indexOf(startMarker, idx);
    if (start === -1) break;
    const end = code.indexOf("};", start);
    if (end === -1) break;
    const block = code.slice(start, end + 2);
    const lines = block.split("\n");
    const seen = new Set();
    const cleaned = [];
    for (const line of lines) {
      const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
      if (m) {
        const k = m[1];
        if (seen.has(k)) { 
          // skip duplicate key line entirely
          continue;
        }
        seen.add(k);
      }
      cleaned.push(line);
    }
    const newBlock = cleaned.join("\n");
    code = code.slice(0, start) + newBlock + code.slice(end + 2);
    idx = start + newBlock.length;
  }
});
fs.writeFileSync("lib/i18n/translations.ts", code);
console.log("Deduped duplicate keys in translations.ts language objects (kept first occurrence of each key).");
