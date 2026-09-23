import { build } from "esbuild";

await build({
  entryPoints: ["apps-script/src/entry.ts"],
  outfile: "apps-script/dist/Code.js",
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2020",
});
