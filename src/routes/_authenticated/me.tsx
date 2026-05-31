import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/me")({
  component: MeRedirect,
});

function MeRedirect() {
  const { data, isLoading } = useCurrentUser();
  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Chargement de votre profil…</div>
    );
  }
  if (!data?.discordId) {
    return <Navigate to="/dashboard" />;
  }
  return <Navigate to="/members/$id" params={{ id: data.discordId }} />;
}
