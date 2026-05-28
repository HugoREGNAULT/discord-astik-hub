import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Mentions légales · PunkAstik" },
      { name: "description", content: "Mentions légales, confidentialité et suppression de données pour PunkAstik Hub." },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Retour</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Mentions légales & confidentialité</h1>

      <section className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Éditeur</h2>
        <p className="text-sm text-muted-foreground">
          PunkAstik Hub est un outil interne édité par la faction PunkAstik à des fins de gestion
          communautaire. Hébergement : Lovable / Cloudflare. Contact : staff PunkAstik sur Discord.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Données collectées</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Identifiant Discord, pseudo, avatar, rôles dans nos serveurs Discord.</li>
          <li>Pseudo Minecraft, UUID Mojang et informations fournies dans la candidature.</li>
          <li>Activité interne (points AstikPoints, donations, sondages, sanctions).</li>
          <li>Journal d'actions du staff (logs).</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Aucune donnée n'est revendue. La base est utilisée uniquement par le staff de la faction.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Cookies</h2>
        <p className="text-sm text-muted-foreground">
          Un seul cookie de session chiffré est utilisé pour maintenir ta connexion Discord
          OAuth2. Aucun cookie publicitaire ni traceur tiers.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Tes droits (RGPD)</h2>
        <p className="text-sm text-muted-foreground">
          Tu peux demander à tout moment l'accès, la rectification ou la suppression de tes
          données en contactant un administrateur sur le Discord PunkAstik. La suppression
          entraîne la fin de ton accès à la faction.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Sécurité</h2>
        <p className="text-sm text-muted-foreground">
          Accès strictement réservé aux membres connectés via Discord. La base de données est
          isolée et inaccessible publiquement.
        </p>
      </section>
    </div>
  );
}
