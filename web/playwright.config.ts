import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/postgres-desk.spec.ts",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npx next start -p 3000",
    // A configured photo makes the pages render the real image path, not only the fallback block.
    env: { ...process.env, ONEHOPE_SAMPLE_DATA: "true", ONEHOPE_IMAGE_HERO: "https://images.onehope.test/hero.jpg" },
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
