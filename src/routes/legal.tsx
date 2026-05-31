import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Database, Cookie, UserCheck, Lock } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Mentions légales · PunkAstik" },
      {
        name: "description",
        content: "Mentions légales, confidentialité et suppression de données pour PunkAstik Hub.",
      },
    ],
  }),
  component: LegalPage,
});

type Section = {
  id: string;
  icon: typeof Shield;
  title: string;
  tag: string;
  children: React.ReactNode;
};

function LegalPage() {
  const sections: Section[] = [
    {
      id: "editor",
      icon: Shield,
      title: "Éditeur",
      tag: "[01] · LEGAL_ENTITY",
      children: (
        <p>
          PunkAstik Hub est un outil interne édité par la faction{" "}
          <strong className="text-white">PunkAstik</strong> à des fins de gestion communautaire.
          Hébergement : Lovable / Cloudflare. Contact : staff PunkAstik sur Discord.
        </p>
      ),
    },
    {
      id: "data",
      icon: Database,
      title: "Données collectées",
      tag: "[02] · DATA_COLLECTED",
      children: (
        <>
          <ul className="list-disc pl-5 space-y-1">
            <li>Identifiant Discord, pseudo, avatar, rôles dans nos serveurs Discord.</li>
            <li>Pseudo Minecraft, UUID Mojang et informations fournies dans la candidature.</li>
            <li>Activité interne (points AstikPoints, donations, sondages, sanctions).</li>
            <li>Journal d'actions du staff (logs).</li>
          </ul>
          <p className="mt-3">
            Aucune donnée n'est revendue. La base est utilisée uniquement par le staff de la
            faction.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      icon: Cookie,
      title: "Cookies",
      tag: "[03] · SESSION",
      children: (
        <p>
          Un seul cookie de session chiffré est utilisé pour maintenir ta connexion Discord OAuth2.
          Aucun cookie publicitaire ni traceur tiers.
        </p>
      ),
    },
    {
      id: "rights",
      icon: UserCheck,
      title: "Tes droits (RGPD)",
      tag: "[04] · USER_RIGHTS",
      children: (
        <p>
          Tu peux demander à tout moment l'accès, la rectification ou la suppression de tes données
          en contactant un administrateur sur le Discord PunkAstik. La suppression entraîne la fin
          de ton accès à la faction.
        </p>
      ),
    },
    {
      id: "security",
      icon: Lock,
      title: "Sécurité",
      tag: "[05] · ACCESS_POLICY",
      children: (
        <p>
          Accès strictement réservé aux membres connectés via Discord. La base de données est isolée
          et inaccessible publiquement. Toutes les communications sont chiffrées en transit.
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#5865F2 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent blur-sm" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#5865F2] to-transparent blur-sm" />
      </div>

      {/* Header */}
      <header className="relative max-w-4xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-pink-500 transition-colors text-xs uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Space Mono'" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour
        </Link>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-pink-500/30 blur-md" />
            <img
              src={logo}
              alt="PunkAstik"
              className="relative w-9 h-9 object-cover rounded-sm border border-pink-500/40"
            />
          </div>
          <h1
            className="font-bold tracking-tight uppercase text-lg"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            PunkAstik <span className="text-pink-500">//</span>
          </h1>
        </div>
      </header>

      {/* Title block */}
      <section className="relative max-w-4xl mx-auto px-6 pt-12 pb-10">
        <div
          className="text-pink-500 text-[11px] uppercase tracking-[0.3em] mb-3"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // LEGAL.EXE
        </div>
        <h2
          className="text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[0.95]"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          Mentions{" "}
          <span className="bg-gradient-to-r from-pink-500 to-[#5865F2] bg-clip-text text-transparent">
            légales
          </span>
        </h2>
        <p className="text-zinc-400 text-sm mt-4 max-w-2xl">
          Transparence sur ce que le hub collecte, comment c'est stocké, et tes droits.
        </p>
      </section>

      {/* Sections */}
      <section className="relative max-w-4xl mx-auto px-6 pb-16 space-y-6">
        {sections.map(({ id, icon: Icon, title, tag, children }) => (
          <div key={id} className="relative group">
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-pink-500/60" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#5865F2]/60" />
            <div className="relative bg-zinc-900/90 border border-zinc-800 backdrop-blur-md p-6 md:p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 flex items-center justify-center bg-zinc-950 border border-zinc-800">
                  <Icon className="w-4 h-4 text-pink-500" />
                </div>
                <div>
                  <div
                    className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {tag}
                  </div>
                  <h3
                    className="text-lg font-bold uppercase tracking-tight"
                    style={{ fontFamily: "'Space Grotesk'" }}
                  >
                    {title}
                  </h3>
                </div>
              </div>
              <div className="text-sm text-zinc-400 leading-relaxed">{children}</div>
            </div>
          </div>
        ))}
      </section>

      <footer
        className="relative max-w-4xl mx-auto px-6 pb-8 text-center text-[10px] text-zinc-600 uppercase tracking-widest"
        style={{ fontFamily: "'Space Mono'" }}
      >
        ENCRYPTED_HUB · PUNKASTIK © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
