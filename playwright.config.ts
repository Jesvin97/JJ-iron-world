import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_DB = process.env.E2E_DATABASE_URL || "postgresql://glamore:glamore@localhost:5432/glamore_e2e?schema=public";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], permissions: ["clipboard-read", "clipboard-write"] } },
    { name: "small-phone", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 640 } }, testMatch: /layout\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/public/settings`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: E2E_DB,
      APP_URL: `http://localhost:${PORT}`,
      AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-1234567",
      AI_PROVIDER: "mock",
      TRUST_PROXY: "false",
      ALLOW_MOCK_AI: "true",
    },
  },
});
