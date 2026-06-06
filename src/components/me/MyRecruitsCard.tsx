/**
 * Carte « Mes recrues » — membres recrutés par le membre connecté.
 * Lecture seule (listMyRecruits). Masquée s'il n'a recruté personne.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { listMyRecruits } from "@/lib/data/me.functions";
import { avatarUrl } from "@/lib/paladium/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MyRecruitsCard() {
  const fn = useServerFn(listMyRecruits);
  const { data } = useQuery({
    queryKey: ["me", "recruits"],
    queryFn: () => fn(),
  });

  const recruits = data?.recruits ?? [];
  if (recruits.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Mes recrues
          </span>
          <Badge variant="outline">{recruits.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {recruits.map((r) => (
            <li key={r.discord_id} className="px-4 py-2 flex items-center gap-3">
              {r.mc_uuid ? (
                <img src={avatarUrl(r.mc_uuid, 32)} alt="" className="size-8 rounded bg-muted" />
              ) : (
                <div className="size-8 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {r.ig_name ?? r.discord_username ?? "—"}
                </div>
                {r.arrival_date && (
                  <div className="text-xs text-muted-foreground">
                    Arrivé le {new Date(r.arrival_date).toLocaleDateString("fr-FR")}
                  </div>
                )}
              </div>
              {r.current_grade && (
                <Badge variant="secondary" className="shrink-0">
                  {r.current_grade}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
