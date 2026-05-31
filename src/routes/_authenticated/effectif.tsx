import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, ErrorBlock } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEffectif } from "@/lib/data/effectif.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GroupGridSkeleton } from "@/components/Skeletons";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/effectif")({
  head: () => ({ meta: [{ title: "Effectif · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <EffectifPage />
    </Guard>
  ),
});

interface EMember {
  discord_id: string;
  name: string;
  ig_name: string | null;
  avatarUrl: string | null;
  blacklisted: boolean;
}

function EffectifPage() {
  const fn = useServerFn(getEffectif);
  const { data, isLoading, error } = useQuery({ queryKey: ["effectif"], queryFn: () => fn() });

  return (
    <div className="space-y-4">
      <PageHeader
        code="// effectif"
        title="Effectif"
        description={
          data ? `${data.total} membres au total.` : "Vue d'ensemble des membres par groupe."
        }
      />
      {error && <ErrorBlock message={(error as Error).message} hint="Réessaie dans un instant." />}
      {isLoading && <GroupGridSkeleton count={6} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.groups.map((g: { label: string; members: EMember[] }) => (
          <Card key={g.label}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{g.label}</CardTitle>
              <Badge>{g.members.length}</Badge>
            </CardHeader>
            <CardContent>
              {g.members.length === 0 ? (
                <p className="text-muted-foreground text-xs">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {g.members.map((m) => (
                    <MemberChip key={m.discord_id} m={m} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MemberChip({ m }: { m: EMember }) {
  return (
    <Link
      to="/members/$id"
      params={{ id: m.discord_id }}
      className={cn(
        "inline-flex items-center gap-1.5 max-w-full rounded-full border border-border bg-muted/40 pl-0.5 pr-2.5 py-0.5 text-xs hover:border-primary/50 hover:bg-muted/60 transition",
        m.blacklisted &&
          "border-destructive/50 bg-destructive/10 text-destructive hover:border-destructive",
      )}
      title={m.blacklisted ? `${m.name} — blacklist` : m.name}
    >
      {m.avatarUrl ? (
        <img src={m.avatarUrl} alt="" className="size-5 rounded-full shrink-0" />
      ) : (
        <span className="size-5 rounded-full bg-muted shrink-0" aria-hidden />
      )}
      <span className="truncate max-w-[140px]">{m.name}</span>
      {m.blacklisted && <Ban className="size-3 shrink-0" aria-label="Blacklisté" />}
    </Link>
  );
}
