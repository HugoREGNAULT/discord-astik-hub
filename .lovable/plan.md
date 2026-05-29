## Constats (tests API à l'instant)

- **Status** : l'API renvoie `{ java: { global, factions }, launcher, anarchy }` — mon extracteur actuel ne sait pas lire cette forme, d'où l'écran vide.
- **Classements** : les IDs corrects sont `job.miner`, `job.farmer`, etc. (avec un point, pas un tiret) → mes onglets métiers renvoient 404. Pour KOTH/END, certaines lignes ont `username == uuid` (joueurs « wilderness ») → il faut résoudre via Mojang.
- **Market** : `/items/{nom}` exige le nom interne exact (`paladium-ore`, `tile-grass`…). « draper » n'existe pas tel quel. La liste globale est paginée à 100 max (1481 items au total) → impossible de chercher librement sans paginer.

## Plan

### 1. Page Statut — refonte
Nouvelle mise en page basée sur la vraie structure :
- Bandeau global Java (online/offline + joueurs)
- Tuile Launcher + tuile Anarchy
- Grille des serveurs faction (Aeloria, Egopolis, …) avec pastille colorée selon `running` / `whitelist` / `offline` / `unknown`

### 2. Classements
- IDs corrigés (`money`, `job.miner`, `job.farmer`, `job.hunter`, `job.alchemist`, `boss`, `egghunt`, `end`, `chorus`, `koth`, `clicker`, `alliance`)
- Résolution UUID → pseudo via Mojang sessionserver pour les lignes où le pseudo est un UUID (KOTH / END). Cache mémoire par UUID pour éviter les appels répétés.

### 3. Market HDV — recherche libre
- Au premier rendu : charger toutes les pages (15 requêtes × 100 items, dans la limite 300/5min) et indexer en mémoire.
- Recherche par sous-chaîne sur le nom interne.
- Pour chaque item correspondant : afficher quantité dispo, total vendu, prix moyen.
- Détail au clic : `/items/{name}` pour voir les listings actifs (vendeur, prix, quantité, expiration).

### 4. Lookup Joueur — ventes + historique BDD
Ajout de deux sections à la fiche joueur :
- **Ventes en cours** : `/v1/paladium/shop/market/players/{uuid}/items`
- **Ventes passées** : lues depuis la table d'historique

Chaque recherche réussie :
- Upsert dans `paladium_tracked_players` (uuid, pseudo, compte de lookups, `last_searched_at`)
- Snapshot immédiat des listings du joueur dans `paladium_player_listings_history`

### 5. Top joueurs recherchés
Bloc en haut du lookup affichant les 10 joueurs les plus recherchés, cliquables pour relancer la recherche.

### 6. Sync automatique toutes les 10 min
- Route publique `POST /api/public/hooks/paladium-sync` (vérif via clé anon)
- Itère sur les joueurs trackés (priorité aux plus recherchés, max ~30 par run pour respecter le rate limit)
- Pour chaque : appelle `/players/{uuid}/items`, compare avec le dernier snapshot, marque les listings disparus comme « vendus », insère les nouveaux
- pg_cron toutes les 10 minutes

## Détails techniques

**Nouvelles tables Supabase**
- `paladium_tracked_players` : uuid (PK), username, search_count, first_searched_at, last_searched_at, last_synced_at
- `paladium_player_listings_history` : id, player_uuid, item_name, item_display, quantity, price, price_pb, listed_at (createdAt API), expires_at, first_seen_at, last_seen_at, sold_at (null tant que présent)

RLS : lecture pour `authenticated`, écriture via service role uniquement.

**Server functions**
- `trackPlayerSearch({ uuid, username })` — upsert + snapshot initial
- `getTopSearchedPlayers()` — top 10 par `search_count`
- `getPlayerSalesHistory({ uuid })` — listings actuels + historique des ventes
- `syncTrackedPlayersListings()` — utilisée par la route cron, signature interne

**Résolution UUID → pseudo**
- Helper côté serveur via Mojang sessionserver (pas de clé) + cache mémoire request-scoped pour le leaderboard ; les UUID résolus sont aussi écrits dans `paladium_tracked_players` quand disponibles.

**Cron pg_cron**
```sql
select cron.schedule(
  'paladium-sync-listings',
  '*/10 * * * *',
  $$ select net.http_post(
    url:='https://punkastik.com/api/public/hooks/paladium-sync',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{}'::jsonb
  ) $$
);
```

## À confirmer
1. OK pour créer les 2 nouvelles tables ?
2. La sync auto toutes les 10 min — OK pour limiter à ~30 joueurs par tick (pour ne pas exploser le rate limit profile 50/5min) ?
