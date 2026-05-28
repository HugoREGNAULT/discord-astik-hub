/**
 * <Guard perm="..."> — gate de l'UI basé sur les rôles Discord agrégés.
 *
 * Règle : le contrôle FAIT AUTORITÉ côté serveur (requirePermission). Ce
 * composant n'est qu'un confort UX pour éviter d'afficher une page qui va
 * échouer côté serveur ensuite. Il rend <Forbidden /> si la permission
 * n'est pas accordée.
 */
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import type { Permission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Forbidden({ perm }: { perm?: Permission }) {
  const { data: user } = useCurrentUser();
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <Card className="max-w-lg w-full border-destructive/40">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="size-10 rounded-full bg-destructive/15 grid place-items-center">
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-destructive">Accès refusé</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tu n'as pas les rôles Discord requis pour accéder à cette page.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {perm && (
            <div className="text-sm">
              <span className="text-muted-foreground">Permission requise : </span>
              <Badge variant="outline" className="font-mono">{perm}</Badge>
            </div>
          )}
          {user && (
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">Connecté en tant que</div>
              <div className="font-medium">{user.globalName ?? user.username}</div>
              <div className="text-xs text-muted-foreground">
                {user.roleIds.length} rôle(s) Discord détecté(s) · {user.permissions.length} permission(s)
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button asChild variant="default">
              <Link to="/me">Mon espace</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Accueil</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Si tu penses qu'il s'agit d'une erreur, contacte un membre du Staff sur Discord.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function Guard({
  perm,
  children,
}: {
  perm: Permission;
  children: React.ReactNode;
}) {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-muted-foreground">
        Vérification des droits…
      </div>
    );
  }
  if (!hasPerm(user, perm)) return <Forbidden perm={perm} />;
  return <>{children}</>;
}
