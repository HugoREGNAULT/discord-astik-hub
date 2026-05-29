# Bot PunkAstik — Contrat API

Le bot Discord pousse les données d'activité vers ces endpoints. Tout est authentifié via le header `x-bot-key` qui doit valoir `BOT_API_KEY` (secret côté serveur).

**Base URL stable** : `https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app`

Toutes les routes acceptent CORS (`*`) et OPTIONS. Réponse : `{ ok: true, ... }` en succès, `{ error: string }` sinon.

---

## 1. POST `/api/public/bot/voice`

Ajoute du temps vocal (à appeler en continu pendant que le membre est en vocal **actif**, càd : pas mute/deaf serveur ou self, dans les conditions définies).

```json
{ "discord_id": "123", "seconds": 30 }
```

Incrémente `voice_total_seconds` ET `voice_7d_seconds`. À appeler par tranches (ex : toutes les 30s).

## 2. POST `/api/public/bot/message`

Incrémente le compteur de messages (avec la règle anti-spam 1msg/30s appliquée **côté bot**).

```json
{ "discord_id": "123", "count": 1 }
```

`count` est optionnel (défaut 1). Incrémente `messages_total` ET `messages_7d`.

## 3. POST `/api/public/bot/stats`

SET direct des valeurs 7j calculées côté bot (rolling window précis). Utile pour recalculer périodiquement la fenêtre glissante de 7 jours.

```json
{
  "discord_id": "123",
  "messages_7d": 142,
  "voice_7d_seconds": 38400,
  "messages_total": 5230,
  "voice_total_seconds": 720000
}
```

Tous les champs autres que `discord_id` sont optionnels.

## 4. POST `/api/public/bot/member`

Upsert d'un membre (sync pseudo Discord, avatar, IG name, grade…).

```json
{
  "discord_id": "123",
  "discord_username": "Pseudo#0001",
  "avatar_url": "https://cdn.discordapp.com/avatars/...",
  "ig_name": "PseudoIG",
  "current_grade": "Caporal",
  "status": "active",
  "arrival_date": "2024-08-15"
}
```

Tous les champs autres que `discord_id` sont optionnels. Crée le membre s'il n'existe pas.

## 5. POST `/api/public/bot/import`

Import bulk de timestamps historiques (max 50 000 entrées par appel).

```json
{
  "entries": [
    { "discord_id": "123", "timestamp": "2024-01-15T12:00:00Z" },
    { "discord_id": "123", "timestamp": "2024-01-15T12:00:31Z" }
  ]
}
```

Compte tous les timestamps tels quels (pas de règle anti-spam, conformément aux specs). Les membres absents de la table `members` sont **ignorés** (filtre déjà fait côté bot après vérification de présence sur la guilde).

---

## Automatisation côté DB (déjà en place)

- **Trigger `points_ledger` → `members.astik_points`** : à chaque insertion dans `points_ledger`, le total `astik_points` du membre est mis à jour automatiquement avec `total_after`. Le bot/staff n'a qu'à insérer une ligne dans le ledger.

## À faire côté bot

- Tracker l'état mute/deaf (server + self) pour suspendre `/voice` quand inactif.
- Maintenir un cooldown 30s par utilisateur avant d'envoyer `/message`.
- Recalculer périodiquement (ex : toutes les heures) la fenêtre 7j glissante et pousser via `/stats`.
- Sync membres (`/member`) au join/update + périodiquement pour les avatars/pseudos.
