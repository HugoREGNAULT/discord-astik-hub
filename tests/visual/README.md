# Tests de régression visuelle

Trois viewports comparés au pixel près : **mobile 390×844**, **tablette 768×1024**, **desktop 1440×900**.

## Première installation

```bash
bunx playwright install --with-deps chromium
```

## Lancer les tests

```bash
# Compare au snapshot de référence (échoue si la page a changé)
bun run test:visual

# Met à jour les snapshots de référence après un changement UI volontaire
bun run test:visual:update

# Cible un viewport
bunx playwright test --project=mobile
```

Les snapshots de référence vivent dans `tests/visual/*.spec.ts-snapshots/`.
Versionne-les : c'est la « vérité » contre laquelle on compare.

## Tester contre la preview Lovable (sans dev server local)

```bash
PLAYWRIGHT_BASE_URL=https://discord-astik-hub.lovable.app bun run test:visual
```

## Ajouter une route protégée (auth)

Les routes `/_authenticated/*` requièrent une session Discord. Crée
`tests/visual/.auth/storage-state.json` une seule fois en te connectant
manuellement, puis charge-le via `test.use({ storageState: "..." })`.
Le squelette est laissé volontairement minimal — à activer quand on a un
compte de test dédié.

## CI

En CI, désactive les animations et la dépendance au temps réel (déjà fait
dans le config). Si un diff est faux positif (anti-aliasing), augmente
`maxDiffPixelRatio` dans `playwright.config.ts`.
