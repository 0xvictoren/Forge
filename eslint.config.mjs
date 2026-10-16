import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Existing client effects intentionally synchronize async stores and APIs.
      // Keep these compiler-advisory rules out of the Phase 1 security gate.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // API downloads intentionally use native anchors rather than router links.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "build/**",
    "move/build/**",
    "node_modules/**",
    "terminals/**",
    "tsconfig.tsbuildinfo",
  ]),
]);
