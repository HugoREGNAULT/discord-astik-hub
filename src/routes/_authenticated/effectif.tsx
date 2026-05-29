import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEffectif } from "@/lib/data/effectif.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GroupGridSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_authenticated/effectif")({
  head: () => ({ meta: [{ title: "Effectif · PunkAstik" }] }),
  component: () => (<Guard perm="members.view"><EffectifPage /></Guard>),
});

function EffectifPage() {
  const fn = useServerFn(getEffectif);
  const { data, isLoading } = useQuery({ queryKey: ["effectif"], queryFn: () => fn() });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Effectif</h1>
        {data && <Badge variant="secondary">{data.total} membres</Badge>}
      </div>
      {isLoading && <GroupGridSkeleton count={6} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.groups.map((g: any) => (
          <Card key={g.label}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{g.label}</CardTitle>
              <Badge>{g.members.length}</Badge>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {g.members.map((m: any) => (
                  <li key={m.discord_id} className="truncate">{m.ig_name ?? m.discord_username ?? m.discord_id}</li>
                ))}
                {g.members.length === 0 && <li className="text-muted-foreground text-xs">—</li>}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
