/**
 * Carte « Ton mois en chiffres » — récap des 30 derniers jours (getMyMonthlyRecap).
 * Points gagnés + dons via points_ledger ; activité messages/vocal = 7 derniers jours
 * (pas d'historique quotidien en base — c'est indiqué).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Coins, Gift, MessageSquare, Mic } from "lucide-react";
import { getMyMonthlyRecap } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function MonthlyRecapCard() {
  const fn = useServerFn(getMyMonthlyRecap);
  const { data } = useQuery({
    queryKey: ["me", "recap"],
    queryFn: () => fn({ data: { days: 30 } }),
  });

  if (!data) return null;
  const voiceHours = Math.round((data.voice7dSeconds / 3600) * 10) / 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" /> Ton mois en chiffres
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Tile
          icon={Coins}
          label="Points gagnés (30j)"
          value={`+${data.pointsGained.toLocaleString("fr-FR")}`}
        />
        <Tile
          icon={Gift}
          label="Dons (30j)"
          value={`${data.donationCount}`}
          hint={
            data.donationPoints ? `${data.donationPoints.toLocaleString("fr-FR")} AP` : undefined
          }
        />
        <Tile
          icon={MessageSquare}
          label="Messages"
          value={data.messages7d.toLocaleString("fr-FR")}
          hint="7 derniers jours"
        />
        <Tile icon={Mic} label="Vocal" value={`${voiceHours} h`} hint="7 derniers jours" />
      </CardContent>
    </Card>
  );
}
