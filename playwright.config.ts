import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test/exec",
    },
  },
});
