import { defineConfig, devices } from "@playwright/test";

const database = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "postgres-desk.spec.ts",
  timeout: 90_000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: database
    ? {
        command: "node --import tsx ../server/scripts/seed.ts && npx next start -p 3100",
        env: {
          ...process.env,
          DATABASE_URL: database,
          ONEHOPE_SAMPLE_DATA: "true",
        },
        url: "http://127.0.0.1:3100/login",
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
