/**
 * Profil Paladium du membre connecté — profil + niveaux de métiers.
 * Lit depuis le cache Supabase via getMyPaladiumProfile (TTL 10min).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pickaxe, Sprout, Sword, FlaskConical, Star, ChevronUp } from "lucide-react";
import { getMyPaladiumProfile } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonoLabel } from "@/components/tools/ToolsUi";

const JOB_ICONS: Record<string, typeof Pickaxe> = {
  mineur: Pickaxe,
  miner: Pickaxe,
  farmer: Sprout,
  hunter: Sword,
  alchemist: FlaskConical,
  alchimiste: FlaskConical,
};

function jobIcon(name: string) {
  const key = name.toLowerCase();
  return JOB_ICONS[key] ?? Star;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function PaladiumProfileCard() {
  const fn = useServerFn(getMyPaladiumProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["me", "paladium-profile"],
    queryFn: () => fn(),
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
  });

  if (isLoading) return null;
  if (!data?.profile) return null;

  const profile = data.profile;
  const jobs = data.jobs ?? [];

  const level = profile.level;
  const money = profile.money;
  const factionName = profile.factionName ?? profile.faction ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className="size-4 text-primary" /> Profil Paladium
          </span>
          <MonoLabel>// mis à jour toutes les 10min</MonoLabel>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          {level != null && (
            <div>
              <span className="text-muted-foreground text-xs">Niveau</span>
              <div className="font-bold text-primary">{level}</div>
            </div>
          )}
          {money != null && (
            <div>
              <span className="text-muted-foreground text-xs">Argent</span>
              <div className="font-bold">{fmtMoney(money)} $</div>
            </div>
          )}
          {factionName && (
            <div>
              <span className="text-muted-foreground text-xs">Faction</span>
              <div className="font-bold">{factionName}</div>
            </div>
          )}
        </div>

        {jobs.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Métiers</p>
            <div className="grid grid-cols-2 gap-2">
              {jobs.map((job) => {
                const Icon = jobIcon(job.name);
                const xp = job.experience ?? job.xp ?? 0;
                return (
                  <div
                    key={job.name}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                      <Icon className="size-3.5 text-primary" />
                      <span className="capitalize">{job.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Niv. {job.level}</span>
                      {xp > 0 && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <ChevronUp className="size-3 text-primary" />
                          {fmtMoney(xp)} xp
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
