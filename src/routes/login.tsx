import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion · PunkAstik" },
      {
        name: "description",
        content:
          "Connecte-toi au dashboard PunkAstik avec ton compte Discord. Accès staff et faction Paladium.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&family=Space+Mono&display=swap",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate({ to: "/dashboard" });
  }, [isLoading, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] p-4 relative overflow-hidden">
      {/* Background cyber elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(#5865F2 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent blur-sm" />
      </div>

      <div className="relative w-full max-w-md group">
        {/* Frame corners */}
        <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-pink-500" />
        <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#5865F2]" />

        <div className="relative bg-zinc-900/90 border border-zinc-800 backdrop-blur-md p-8 shadow-2xl shadow-pink-500/10">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center font-bold text-white text-2xl rounded-sm rotate-3 shadow-lg shadow-pink-500/20"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                P
              </div>
              <div>
                <h1
                  className="text-white font-bold text-xl tracking-tight uppercase"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  PunkAstik <span className="text-pink-500">//</span>
                </h1>
                <p
                  className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-medium"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  Dashboard Paladium
                </p>
              </div>
            </div>
            <div className="text-[10px] text-zinc-600 font-mono text-right leading-none">
              SYS_AUTH_V2
              <br />
              STABLE_BUILD
            </div>
          </div>

          {/* Info */}
          <div className="mb-8 p-4 bg-zinc-950/50 border-l-2 border-pink-500/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1">
              <div className="w-1 h-1 bg-pink-500 animate-pulse" />
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Connecte-toi avec{" "}
              <span className="text-[#5865F2] font-semibold">Discord</span>. Les
              accès dépendent de tes rôles sur les serveurs PunkAstik.
            </p>
          </div>

          {/* CTA */}
          <div className="relative">
            <div className="absolute inset-0 bg-[#5865F2] blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
            <a
              href="/api/auth/login"
              className="relative w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-6 rounded-none transition-all duration-300 active:scale-[0.98] border-b-4 border-black/20"
            >
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.579.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
              </svg>
              <span className="uppercase tracking-wider text-sm">
                Se connecter avec Discord
              </span>
            </a>
          </div>

          {/* Footer metadata */}
          <div className="mt-8 pt-4 border-t border-zinc-800/50 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="w-1 h-1 bg-zinc-700" />
              <div className="w-1 h-1 bg-zinc-700" />
              <div className="w-1 h-1 bg-zinc-700" />
            </div>
            <div className="text-[9px] text-zinc-600 font-mono tracking-widest">
              ENCRYPTED_SESSION_ESTABLISHED
            </div>
          </div>
        </div>

        <div className="h-1 w-2/3 mx-auto bg-gradient-to-r from-transparent via-pink-500/30 to-transparent mt-4" />
      </div>
    </div>
  );
}
