import { test, expect } from "@playwright/test";

test("staff connecté navigue vers /polls/:id sans redirection", async ({ page }) => {
  // 1. Authentification staff via endpoint de test
  const loginRes = await page.request.post("/api/test/login");
  expect(loginRes.status()).toBe(302);

  // 2. Création d'un sondage de test
  const seedRes = await page.request.post("/api/test/seed-poll");
  expect(seedRes.status()).toBe(200);
  const { pollId } = await seedRes.json();
  expect(pollId).toBeDefined();

  // 3. Navigation directe vers le détail du sondage
  await page.goto(`/polls/${pollId}`, { waitUntil: "networkidle" });

  // 4. Vérifier qu'on n'a PAS été redirigé vers la liste
  await expect(page).toHaveURL(`/polls/${pollId}`);

  // 5. Vérifier que la page de vote s'affiche bien
  await expect(page.getByText("Créneaux proposés")).toBeVisible();
  await expect(page.getByText("Sondage E2E Test")).toBeVisible();

  // 6. Vérifier que les boutons de vote staff sont présents (clôturer / rouvrir)
  await expect(page.getByRole("button", { name: /Clôturer/i })).toBeVisible();
});
