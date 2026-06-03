
# Refonte du flow recrutement

Le flow devient explicitement en 2 étapes côté staff : **Accepter la candidature écrite** (donne juste le rôle attente + DM dispo entretien), puis **Entretien validé** (passe le candidat membre et applique les rôles finaux). Plus deux améliorations sur la fiche : profil Paladium correctement affiché, et 2-3 questions IA générées en fonction du profil.

## Nouveau flow

```
postulant /candidature
        │ submitApplication (inchangé) → status=pending
        ▼
[ /recruitment — fiche candidature ]
   ┌─ Bouton "Accepter (écrit)"  ─────────────────────────┐
   │  • status = "accepted"                                │
   │  • rôle public INTERVIEW_PENDING_PUBLIC (déjà OK)    │
   │  • DM : "Candidature écrite validée, dispo pour     │
   │     entretien dans <#1510035883951132694>"           │
   │  • PAS de fiche members, PAS de trial, PAS d'onboarding
   └───────────────────────────────────────────────────────┘
        │
        ▼
[ entretien IRL ]
        │
        ▼
   ┌─ Nouveau bouton "Entretien validé" (uniquement si status=accepted)
   │  • Tente d'ajouter sur PUBLIC : rôle 1485405351141703700
   │  • Tente d'ajouter sur FACTION : rôles 1503345902343950447
   │    + MEMBER_FACTION (1503030823174148216)
   │    → si la personne n'est pas encore dans le guild faction,
   │       on log l'échec et on affiche un warning ; le bouton
   │       reste cliquable pour réessayer
   │  • Crée/MAJ la fiche members en status='trial' + tasks onboarding
   │  • status applications = "interview_validated"
   │  • Retire le rôle INTERVIEW_PENDING_PUBLIC (cleanup)
   │  • DM de bienvenue (équivalent de l'actuel "accepté")
   │  • Notif staff + audit log
   └──────────────────────────────────────────────────────
```

## Changements

### 1. `src/lib/discord/constants.ts`
Ajouter les 3 nouveaux IDs nommés :
- `MEMBER_PUBLIC = "1485405351141703700"` (public)
- `TRIAL_FACTION = "1503345902343950447"` (privé, à côté de MEMBER_FACTION — nom provisoire)
- `INTERVIEW_CHANNEL = "1510035883951132694"` (salon dispo)

### 2. `src/lib/data/applications.functions.ts`
- `decideApplication` : **simplifier** la branche `accepted` — ne fait plus que rôle attente + DM "dispo entretien dans <#...>". Plus de `members.upsert`, plus de `onboarding_tasks`, plus de `trial_until`.
- DM accepté : nouveau wording + mention du salon.
- Nouvelle serverFn `validateInterview({ applicationId })` (perm `recruit.access`) :
  - guard : application doit être `accepted`
  - tente PUT sur les 3 rôles + retire le rôle attente, agrège les échecs sans tout casser
  - upsert `members` status=`trial`, `trial_until = +14j`, insert tasks onboarding (idempotent)
  - update applications → `status = "interview_validated"`, `interview_validated_at`, `interview_validated_by_*`
  - DM bienvenue + log `application_interview_validated`
- `listApplications` accepte le nouveau statut.

### 3. Migration DB
- Étendre la contrainte/CHECK implicite du `status` côté code (la table n'a pas de check actif). Ajouter colonnes :
  - `interview_validated_at TIMESTAMPTZ NULL`
  - `interview_validated_by_discord_id TEXT NULL`
  - `interview_validated_by_username TEXT NULL`

### 4. `src/lib/data/applications-ai.functions.ts`
- Élargir le prompt système : demander aussi `followup_questions: string[]` (2-3 questions personnalisées basées sur profil Paladium + réponses) en plus de `score/fit/strengths/concerns`.
- Étendre le type `AiSynth` et le parsing.

### 5. `src/routes/_authenticated/recruitment.tsx`
- `AppStatus` ajoute `"interview_validated"` + 4ᵉ onglet "Entretien validé".
- Boutons fiche candidature :
  - status=`pending` : "Accepter (écrit)" + "Refuser" (comme avant)
  - status=`accepted` : "Entretien validé ✅" (nouveau, vert) + "Finalement refuser"
  - status=`interview_validated` : badge "Membre en essai" + lien vers `/members/:id`
- Section `AiReview` :
  - Remplacer le bloc « sources brutes » par un **panneau profil Paladium lisible** (niveau, faction IG, money, métiers principaux avec niveau) au lieu d'un simple "profil récupéré" / JSON dump. Si `paladium_error`, afficher un message clair + bouton "Réessayer".
  - Afficher `followup_questions` IA en liste cochable (purement visuelle, pour aider le recruteur en entretien).

### 6. Bug API/IA "on voit pas le profil"
Cause probable : l'UI affiche seulement `"profil récupéré"` ou `"indisponible (<error>)"` dans un `<details>` replié, ce qui donne l'impression que ça ne marche pas. La data est bien là, juste pas rendue. Le fix vit dans le bloc Paladium du composant `AiReview` (point 5) : rendu structuré + bouton retry.

## Détails techniques

- **Rôles à la jonction du privé** : pas d'auto-assign sur join (l'utilisateur a choisi "Nouveau bouton"). Si le bot n'arrive pas à mettre les rôles privés (404 = user pas dans le guild), `validateInterview` renvoie un warning par rôle ; le bouton reste disponible pour relance.
- **Retrait rôle attente** : `DELETE /guilds/{public}/members/{id}/roles/{INTERVIEW_PENDING_PUBLIC}` via nouvelle helper `removeGuildMemberRole` dans `discord/api.server.ts`.
- **Idempotence** : si on re-clique "Entretien validé" sur quelqu'un déjà `interview_validated`, on renvoie une erreur claire.
- **Compat** : les candidatures déjà `accepted` avant la migration restent visibles ; pour elles le bouton "Entretien validé" reste utilisable et créera la fiche membre.
- **Permissions** : `validateInterview` gated par `recruit.access` (même que decide).
- **Audit** : nouvelle action `application_interview_validated` avec détail des succès/échecs par rôle, ajoutée au log chain.

## Hors scope (à confirmer plus tard)
- Détection automatique de la jonction au serveur privé (option non retenue).
- Renommage des rôles `TRIAL_FACTION` / `MEMBER_PUBLIC` si tu as un nom officiel.
