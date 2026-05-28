import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion · PunkAstik" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate({ to: "/dashboard" });
  }, [isLoading, user, navigate]);

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-br from-background via-background to-[oklch(0.20_0.05_295)]">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center font-bold text-primary-foreground text-xl">
            P
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PunkAstik — Connexion</h1>
            <p className="text-xs text-muted-foreground">Dashboard Paladium</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Connecte-toi avec Discord. Les accès dépendent de tes rôles sur les serveurs PunkAstik.
        </p>
        <Button asChild className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white">
          <a href="/api/auth/login">Se connecter avec Discord</a>
        </Button>
      </div>
    </div>
  );
}
