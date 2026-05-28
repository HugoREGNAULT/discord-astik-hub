import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Coins, ShoppingCart, Target, ShieldAlert, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · PunkAstik" }] }),
  component: Dashboard,
});

const TILES = [
  { to: "/profile", title: "Mon profil", icon: UserCircle2, perm: "profile.self", desc: "Tes points, ton grade, ton historique." },
  { to: "/members", title: "Membres", icon: Users, perm: "members.view", desc: "Annuaire des membres faction." },
  { to: "/points", title: "AstikPoints", icon: Coins, perm: "points.manage", desc: "Ajouter, retirer, historique." },
  { to: "/donations", title: "Dons", icon: ShoppingCart, perm: "donations.manage", desc: "Panier de don, calcul des points." },
  { to: "/effectif", title: "Effectif", icon: Users, perm: "members.view", desc: "Liste par grade." },
  { to: "/objectives", title: "Objectifs", icon: Target, perm: "objectives.edit", desc: "Plan d'action staff." },
  { to: "/admin", title: "Admin", icon: ShieldAlert, perm: "admin.access", desc: "Logs, état système." },
] as const;

function Dashboard() {
  const { data: user } = useCurrentUser();
  const visible = TILES.filter((t) => user?.permissions.includes(t.perm as never));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Salut, {user?.globalName ?? user?.username} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {visible.length} module{visible.length > 1 ? "s" : ""} disponible{visible.length > 1 ? "s" : ""} selon tes rôles Discord.
        </p>
        <div className="flex flex-wrap gap-1 mt-3">
          {user?.permissions.map((p) => (
            <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <Card className="h-full transition border-border hover:border-primary/60 hover:shadow-[0_0_0_1px_var(--primary)]">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="size-10 rounded-md bg-primary/15 text-primary grid place-items-center">
                  <t.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{t.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
