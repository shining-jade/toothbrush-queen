import { build } from "esbuild";

await build({
  entryPoints: ["apps-script/src/entry.ts"],
  outfile: "apps-script/dist/Code.js",
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2020",
  footer: {
    // Apps Script simple triggers (onOpen) and menu item callbacks (addItem's second
    // argument) must be plain global functions — the esbuild IIFE bundle hides everything
    // else, so each one gets a thin top-level wrapper delegating into the bundle.
    js: [
      "function doPost(event) { return globalThis.__brushKingDoPost(event); }",
      "function onOpen() { return globalThis.__brushKingInstallWizard.onOpen(); }",
      "function bkSetupSheets() { return globalThis.__brushKingInstallWizard.setupSheets(); }",
      "function bkSetupSecurity() { return globalThis.__brushKingInstallWizard.setupSecurity(); }",
      "function bkSetupSkinFolder() { return globalThis.__brushKingInstallWizard.setupSkinFolder(); }",
      "function bkAddChallenge() { return globalThis.__brushKingInstallWizard.addChallenge(); }",
      "function bkShowStatus() { return globalThis.__brushKingInstallWizard.showStatus(); }",
    ].join("\n"),
  },
});
