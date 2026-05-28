import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getMemberDetail } from "@/lib/data/members.functions";
import { getPointsHistory } from "@/lib/data/points.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mon profil · PunkAstik" }] }),
  component: Profile,
});

function Profile() {
  const { data: user } = useCurrentUser();
  const getDetail = useServerFn(getMemberDetail);
  const getHistory = useServerFn(getPointsHistory);

  const detail = useQuery({
    queryKey: ["profile", user?.discordId],
    queryFn: () => getDetail({ data: { discordId: user!.discordId } }),
    enabled: !!user?.discordId,
  });
  const history = useQuery({
    queryKey: ["history", user?.discordId],
    queryFn: () => getHistory({ data: { discordId: user!.discordId, limit: 20 } }),
    enabled: !!user?.discordId,
  });

  const m = detail.data?.member;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        {user?.avatarUrl && <img src={user.avatarUrl} className="size-16 rounded-full" alt="" />}
        <div>
          <h1 className="text-2xl font-bold">{user?.globalName ?? user?.username}</h1>
          <p className="text-sm text-muted-foreground">@{user?.username}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">AstikPoints</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">{m?.astik_points ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Grade</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{m?.current_grade ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Arrivée</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{m?.arrival_date ?? "—"}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Historique récent</CardTitle></CardHeader>
        <CardContent>
          {history.data?.entries?.length ? (
            <ul className="divide-y divide-border">
              {history.data.entries.map((e: any) => (
                <li key={e.id} className="py-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()} · {e.action_type}
                  </span>
                  <span className={e.amount >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {e.amount >= 0 ? "+" : ""}{e.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun gain récent.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tes rôles Discord</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {user?.roleIds.map((r) => <Badge key={r} variant="secondary" className="text-[10px] font-mono">{r}</Badge>)}
        </CardContent>
      </Card>
    </div>
  );
}
