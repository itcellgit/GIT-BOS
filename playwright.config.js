import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the local dev servers and the seeded local database:
//   npm run db:start   (separate terminal)
//   npm run db:seed
//   npm run test:e2e   (starts `npm run dev` — API on :4000, React on :5173 — unless already running)
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/api/me",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
