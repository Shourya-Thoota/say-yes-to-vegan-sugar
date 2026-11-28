import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "freebuff-sites-build/**",
    "freebuff.open-next.config.ts",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
