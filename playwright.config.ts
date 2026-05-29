import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de régression visuelle automatisés.
 *
 * Trois projets (viewports) : mobile, tablette, desktop.
 * Lance le dev server localement, capture des snapshots stables, et compare
 * pixel à pixel avec les baselines stockées dans tests/visual.spec.ts-snapshots/.
 *
 * Usage:
 *   bunx playwright install --with-deps chromium   # 1ère fois
 *   bun run test:visual                            # exécute
 *   bun run test:visual:update                     # met à jour les baselines
 */
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  // Tolérance: 0.2% de pixels peuvent différer (anti-aliasing).
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
