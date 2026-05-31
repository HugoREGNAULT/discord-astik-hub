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
    __root.tsx                        layout racine + QueryClient
    index.tsx                         redirection vers /dashboard
    login.tsx                         page de connexion Discord
    welcome.tsx                       page d'accueil / onboarding
    _authenticated.tsx                layout protégé (sidebar + auth check)
    _authenticated/
      dashboard.tsx                   tableau de bord modulaire
      me.tsx                          espace perso (raccourci self)
      profile.tsx                     profil perso (points, grade, historique)
      members.tsx                     liste membres + recherche
      members.$id.tsx                 fiche membre (notes, warnings, alts, édition)
      effectif.tsx                    effectif groupé par grade
      recruitment.tsx                 candidatures (review + décisions)
      points.tsx                      gestion AstikPoints + historique
      donations.tsx                   paniers de dons (items / actions / argent)
      config.tsx                      config valeurs (points par item/action)
      objectives.tsx                  objectifs faction
      absences.tsx                    déclarations d'absence
      blacklist.tsx                   blacklist joueurs (MC / Discord)
      polls.tsx / polls.index.tsx     sondages (liste + layout)
      polls.$id.tsx                   détail sondage + votes
      pdc.tsx                         planificateur PDC (plans + blocs)
      logs.tsx                        logs applicatifs
      staff.tsx                       page staff (activité, modération)
      admin.tsx                       santé système + admin
      tools.tsx / tools.index.tsx     hub outils Paladium
      tools.leaderboard.tsx           classements
      tools.faction.tsx               infos faction
      tools.check-bc.tsx              suivi BC faction (faction_bc_checks)
      tools.market.tsx                marché joueur (prix moyens)
      tools.shop-admin.tsx            admin shop (prix officiels)
      tools.sales.tsx                 historique listings joueurs
      tools.alerts.tsx                alertes de prix
      tools.status.tsx                statut serveur Paladium
      tools.uptime.tsx                historique d'uptime
      tools.player.tsx                recherche joueur tracké
      tools.events.tsx                évènements
      tools.clicker.tsx               mini-jeu interne
      tools.xp-calculator.tsx         calculateur XP
    api/
      auth/login.ts                   redirige vers Discord OAuth
      auth/callback.ts                échange code → token → session
      auth/logout.ts                  détruit la session
      auth/whoami.ts                  ping session courante
      health.ts                       healthcheck
      public/bot/                     API publique consommée par le bot Discord
        import.ts                     import en masse (members, points…)
        member.ts                     upsert/lookup d'un membre
        message.ts                    incrément stats messages
        voice.ts                      incrément stats vocal
        stats.ts                      push de stats agrégées
      public/hooks/                   webhooks planifiés (cron externe)
        generate-digest.ts            génère le digest IA hebdo
        sync-discord-presence.ts      rafraîchit le cache de rôles Discord
        paladium-sync.ts              sync global Paladium
        paladium-market-sync.ts       sync marché joueur
        paladium-admin-shop-sync.ts   sync shop admin
        paladium-status-sync.ts       sync statut serveur
      test/                           routes de dev (désactivées en prod)

  lib/
    auth/
      permissions.ts                  table CENTRALE des permissions
      require.server.ts               requirePermission / requireSelfOrPermission
      session.server.ts               lecture/écriture cookie chiffré
      session.functions.ts            getCurrentUser (serverFn pour le front)
      use-current-user.ts             hook React Query
    discord/
      api.server.ts                   fetch rôles agrégés (2 serveurs)
      constants.ts                    IDs guildes + rôles (source unique)
    data/                             toutes les serverFn CRUD / lecture
      members.functions.ts            membres + détails
      points.functions.ts             AstikPoints + ledger
      donations.functions.ts          paniers de dons
      values.functions.ts             config_values (items / actions)
      effectif.functions.ts           effectif par grade
      objectives.functions.ts         objectifs
      absences.functions.ts           absences
      blacklist.functions.ts (+ .server.ts)
      applications.functions.ts       candidatures
      applications-ai.functions.ts    pré-analyse IA des candidatures
      polls.functions.ts              sondages + votes
      pdc.functions.ts                plans PDC
      check-bc.functions.ts           suivi BC
      shop-alerts.functions.ts        alertes de prix
      leaderboard.functions.ts        classements
      faction-members.ts              membres faction (Paladium API)
      search.functions.ts             recherche transverse
      notifications.functions.ts      notifs internes
      bulk-dm.functions.ts            envoi DM en masse via bot
      digest.functions.ts (+ .server.ts)  digest IA hebdo
      account.functions.ts            espace compte
      me.functions.ts                 raccourcis self
      staff.functions.ts              vues staff
      admin.functions.ts              santé / admin
      logs.functions.ts               lecture logs
      health.functions.ts             healthcheck
      postgrest.ts                    helpers PostgREST
    db.server.ts                      client Supabase admin (service_role)

  components/
    AppSidebar.tsx                    sidebar dynamique selon permissions
    RouteError.tsx                    error boundary réutilisable
    ui/                               shadcn primitives
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

~29 tables (voir `supabase/migrations/`), regroupées par domaine :

- **Membres & modération** : `members`, `member_alts`, `notes`, `warnings`,
  `absences`, `blacklist`, `discord_role_cache`, `minecraft_uuid_cache`.
- **Points & dons** : `points_ledger`, `donations`, `donation_lines`,
  `config_values`.
- **Recrutement & vie de faction** : `applications`, `objectives`, `polls`,
  `poll_options`, `poll_votes`, `pdc_plans`, `pdc_blocks`, `faction_bc_checks`.
- **Stats & snapshots** : `leaderboard_snapshots`, `logs`, `ai_digests`.
- **Outils Paladium** : `paladium_tracked_players`,
  `paladium_market_price_history`, `paladium_admin_shop_history`,
  `paladium_player_listings_history`, `paladium_server_status_history`,
  `shop_admin_price_alerts`.

RLS activé partout, **aucune policy publique d'écriture** : seul le client
`service_role` (côté serveur) lit/écrit après vérification Discord. Quelques
tables d'observabilité (snapshots, historiques Paladium, digests, caches)
exposent un `SELECT` à `authenticated` pour les vues internes.

### Rôle Grafana

Un rôle Postgres `grafana_reader` (LOGIN, lecture seule) est provisionné
par migration. Il a `USAGE` sur `public` et `SELECT` sur les tables
métier listées ci-dessus, plus les vues d'agrégation dédiées :

- `v_leaderboard_timeseries` — séries temporelles points / messages / vocal.
- `v_points_daily` — agrégat journalier des mouvements de points.
- `v_staff_activity_daily` — activité staff (dons validés, points donnés…).

Les nouvelles tables ne sont **pas** automatiquement ouvertes à
`grafana_reader` (choix volontaire) — il faut un `GRANT` explicite.



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
