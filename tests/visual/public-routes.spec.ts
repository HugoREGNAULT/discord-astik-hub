import { test, expect, type Page } from "@playwright/test";

/**
 * Routes publiques (pas besoin d'auth). Pour les routes _authenticated,
 * voir auth-routes.spec.ts qui réutilise une session sauvegardée.
 */
const PUBLIC_ROUTES = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "candidature", path: "/candidature" },
  { name: "legal", path: "/legal" },
  { name: "forbidden", path: "/forbidden" },
];

/** Stabilise la page avant snapshot: polices chargées, animations off, scroll up. */
async function stabilize(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  // Laisse React/Tanstack Query se stabiliser
  await page.waitForLoadState("networkidle").catch(() => {});
}

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} — pixel perfect`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await stabilize(page);

    await expect(page).toHaveScreenshot(`${route.name}-${testInfo.project.name}.png`, {
      fullPage: true,
    });
  });
}
