import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PunkAstik · Faction Paladium" },
      {
        name: "description",
        content:
          "Bienvenue sur le hub de la PunkAstik. Connecte-toi en tant que membre ou candidate pour rejoindre la faction Paladium.",
      },
      { property: "og:title", content: "PunkAstik · Faction Paladium" },
      {
        property: "og:description",
        content:
          "Hub officiel de la PunkAstik — connexion membre et candidatures.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&family=Space+Mono&display=swap",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
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
      <header className="relative max-w-6xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-pink-500/30 blur-md" />
            <img
              src={logo}
              alt="PunkAstik"
              className="relative w-10 h-10 object-cover rounded-sm border border-pink-500/40"
            />
          </div>
          <div>
            <h1
              className="font-bold tracking-tight uppercase text-lg"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              PunkAstik <span className="text-pink-500">//</span>
            </h1>
            <p
              className="text-zinc-500 text-[10px] uppercase tracking-[0.2em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Faction Paladium
            </p>
          </div>
        </div>
        <div
          className="text-[10px] text-zinc-600 font-mono text-right leading-none hidden sm:block"
          style={{ fontFamily: "'Space Mono'" }}
        >
          SYS_HUB_V2
          <br />
          STABLE_BUILD
        </div>
      </header>

      {/* Hero text */}
      <section className="relative max-w-6xl mx-auto px-6 pt-8 pb-12 text-center">
        <p
          className="text-pink-500 text-xs uppercase tracking-[0.4em] mb-4"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // welcome.exe
        </p>
        <h2
          className="text-4xl md:text-6xl font-bold tracking-tight uppercase mb-4"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          Bienvenue dans la <span className="text-pink-500">PunkAstik</span>
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-base">
          Faction Paladium. Connecte-toi à ton espace membre, ou candidate pour
          rejoindre l'équipe.
        </p>
      </section>

      {/* Split CTA */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connexion */}
        <div className="relative group">
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-[#5865F2]" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#5865F2]" />
          <div className="relative bg-zinc-900/90 border border-zinc-800 backdrop-blur-md p-8 h-full flex flex-col">
            <div
              className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest mb-2"
              style={{ fontFamily: "'Space Mono'" }}
            >
              [01] · MEMBER_ACCESS
            </div>
            <h3
              className="text-2xl font-bold uppercase tracking-tight mb-3"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              Déjà membre ?
            </h3>
            <p className="text-zinc-400 text-sm mb-8 flex-1">
              Connecte-toi avec Discord pour accéder à ton espace personnel, tes
              AstikPoints, ton grade et l'activité de la faction.
            </p>
            <a
              href="/api/auth/login"
              className="relative inline-flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-6 transition-all duration-300 active:scale-[0.98] border-b-4 border-black/20 uppercase tracking-wider text-sm"
            >
              <LogIn className="w-5 h-5" />
              Se connecter
            </a>
          </div>
        </div>

        {/* Candidature */}
        <div className="relative group">
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-pink-500" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-pink-500" />
          <div className="relative bg-zinc-900/90 border border-zinc-800 backdrop-blur-md p-8 h-full flex flex-col">
            <div
              className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest mb-2"
              style={{ fontFamily: "'Space Mono'" }}
            >
              [02] · NEW_RECRUIT
            </div>
            <h3
              className="text-2xl font-bold uppercase tracking-tight mb-3"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              Pas encore des nôtres ?
            </h3>
            <p className="text-zinc-400 text-sm mb-8 flex-1">
              Rejoins la PunkAstik en remplissant le formulaire de candidature.
              Connexion Discord requise pour identifier ton compte.
            </p>
            <Link
              to="/candidature"
              className="relative inline-flex items-center justify-center gap-3 bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 px-6 transition-all duration-300 active:scale-[0.98] border-b-4 border-black/20 uppercase tracking-wider text-sm"
            >
              <UserPlus className="w-5 h-5" />
              Candidater
            </Link>
          </div>
        </div>
      </section>

      <footer
        className="relative max-w-6xl mx-auto px-6 pb-8 text-center text-[10px] text-zinc-600 font-mono uppercase tracking-widest"
        style={{ fontFamily: "'Space Mono'" }}
      >
        ENCRYPTED_HUB · PUNKASTIK © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
