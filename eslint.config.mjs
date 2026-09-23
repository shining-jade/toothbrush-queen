import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "out/**",
    ".vercel/**",
    "coverage/**",
    "apps-script/dist/**",
    "public/mediapipe/wasm/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
