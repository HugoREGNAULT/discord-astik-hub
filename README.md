# PunkAstik / Paladium — Dashboard

Dashboard web connecté à Discord OAuth2 pour la faction PunkAstik (Paladium).
L'accès à chaque page et à chaque action dépend des **rôles Discord** de
l'utilisateur sur deux serveurs précis.

**Le système de permissions est volontairement strict et central.**
Il est la raison d'être du projet : un même endpoint refusera ou acceptera
selon le rôle Discord, et **la vérification se fait toujours côté serveur**.

---

## Stack

- **TanStack Start** (React + Vite + TypeScript), équivalent moderne de Next.js
- **Tailwind CSS v4** + shadcn/ui — thème dark gaming custom
- **Lovable Cloud** (Postgres managé) pour la persistance
- **Discord OAuth2** + Discord API v10 (rôles, guildes, members)
- **Sessions cookies signées + chiffrées** (HMAC + AES-GCM via `SESSION_SECRET`)

---

## Architecture

```
src/
  routes/
    __root.tsx                  layout racine + QueryClient
    index.tsx                   redirection vers /dashboard
    login.tsx                   page de connexion Discord
    _authenticated.tsx          layout protégé (sidebar + auth check)
    _authenticated/
      dashboard.tsx             tableau de bord modulaire
      profile.tsx               profil perso (points, grade, historique)
      members.tsx               liste membres + recherche
      members.$id.tsx           fiche membre (notes, warnings, alts, édition)
      points.tsx                gestion AstikPoints + historique
      donations.tsx             paniers de dons (items / actions / argent)
      config.tsx                config valeurs (points par item/action)
      effectif.tsx              effectif groupé par grade
      objectives.tsx            objectifs faction
      admin.tsx                 santé système + logs
    api/
      auth/login.ts             redirige vers Discord OAuth
      auth/callback.ts          échange code → token → session
      auth/logout.ts            détruit la session

  lib/
    auth/
      permissions.ts            table CENTRALE des permissions
      require.server.ts         requirePermission() — gate serveur
      session.server.ts         lecture/écriture cookie chiffré
      session.functions.ts      getCurrentUser (serverFn pour le front)
      use-current-user.ts       hook React Query
    discord/
      api.server.ts             fetch rôles agrégés (2 serveurs)
      constants.ts              IDs guildes + rôles (source unique)
    data/                       toutes les serverFn CRUD
      members.functions.ts
      points.functions.ts
      donations.functions.ts
      values.functions.ts
      effectif.functions.ts
      objectives.functions.ts
      admin.functions.ts
    db.server.ts                client Supabase admin (service_role)

  components/
    AppSidebar.tsx              sidebar dynamique selon permissions
    ui/                         shadcn primitives
```

---

## Système de permissions

**Tout est dans `src/lib/auth/permissions.ts`** — c'est la **seule** source
de vérité. Chaque server function sensible appelle
`requirePermission(perm)` avant la moindre lecture/écriture.

### Rôles Discord reconnus

| Rôle              | ID                    | Serveur |
| ----------------- | --------------------- | ------- |
| Staff Faction     | `1503083799540404255` | Privé   |
| Haut Staff Public | `1485420835165569146` | Public  |
| Staff Points      | `1505555444373127188` | Privé   |
| Staff Ticket      | `1503077087160828066` | Privé   |
| Recruteur         | `1485381120014024876` | Public  |
| Membre Faction    | `1503030823174148216` | Privé   |

> Haut staff = `STAFF_FACTION` (privé) **OU** `HIGH_STAFF_PUBLIC` (public).

### Permissions

| Permission            | Qui ?                                 |
| --------------------- | ------------------------------------- |
| `profile.self`        | Membre faction, recruteur, haut staff |
| `members.view`        | Staff faction, staff points           |
| `members.edit`        | Staff faction                         |
| `notes.view/write`    | Staff faction                         |
| `warnings.view/write` | Staff faction                         |
| `points.manage`       | Staff points (+ haut staff)           |
| `donations.manage`    | Staff points (+ haut staff)           |
| `config.manage`       | Staff points (+ haut staff)           |
| `recruit.access`      | Recruteur (+ haut staff)              |
| `objectives.edit`     | Staff faction                         |
| `admin.access`        | Haut staff uniquement                 |

L'UI cache automatiquement les modules indisponibles (sidebar +
dashboard), mais **le contrôle réel est serveur** : un appel direct à une
serverFn sans la permission renvoie `FORBIDDEN` et logue
`permission_denied`.

---

## Setup Discord OAuth2

1. https://discord.com/developers/applications → ton app → **OAuth2**
2. Ajouter ces redirect URIs :
   - `https://id-preview--<project-id>.lovable.app/api/auth/callback`
   - `https://project--<project-id>.lovable.app/api/auth/callback`
   - (ton domaine custom le cas échéant)
3. Récupérer **Client ID**, **Client Secret**, **Bot Token**
4. Inviter le bot sur les deux serveurs (scope `bot`, perm "View Channels" suffit)

### Secrets requis (déjà configurés dans Lovable Cloud)

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `SESSION_SECRET` (32+ caractères aléatoires)

---

## Base de données

11 tables (voir `supabase/migrations/`) :
`members`, `member_alts`, `points_ledger`, `donations`, `donation_lines`,
`config_values`, `notes`, `warnings`, `objectives`, `logs`, `discord_role_cache`.

RLS activé partout, **aucune policy publique** : seul le client
`service_role` (côté serveur) lit/écrit après vérification Discord.

---

## Import des JSON existants

À faire plus tard : créer `src/lib/import-json.server.ts` qui prend les
fichiers `members.json`, `points.json`, etc. fournis par le bot et fait un
upsert dans les tables correspondantes. Exposer via une serverFn protégée
par `admin.access`.

---

## Règle d'or

> **Ne simplifie pas le système de permissions. Le but principal du site
> est d'avoir des accès différents selon les rôles Discord.**
