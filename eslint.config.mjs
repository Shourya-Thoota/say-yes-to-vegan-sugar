import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "freebuff-sites-build/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
