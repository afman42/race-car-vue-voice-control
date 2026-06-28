// playwright.config.js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: "https://localhost:5173",
    headless: true,
    // Self-signed cert from @vitejs/plugin-basic-ssl — ignore HTTPS errors.
    ignoreHTTPSErrors: true,
    // Increase default timeouts for waiting on dashboard updates.
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    // Capture trace on first retry for debugging.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 5173",
    url: "https://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
