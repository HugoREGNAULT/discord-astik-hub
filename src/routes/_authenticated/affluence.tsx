import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getPlayerCountHistory,
  type PlayerCountPoint,
  type HeatmapCell,
} from "@/lib/paladium/history.functions";
import { PageCard, SectionLabel, MonoLabel } from "@/components/tools/ToolsUi";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/affluence")({
  head: () => ({ meta: [{ title: "Affluence Paladium · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <AffluencePage />
    </Guard>
  ),
});

// ─── Constantes ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
// Ordre d'affichage : Lun→Dim (1,2,3,4,5,6,0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const PERIODS = [
  { id: "1", label: "24H", days: 1 },
  { id: "7", label: "7J", days: 7 },
  { id: "30", label: "30J", days: 30 },
];

// ─── Tooltip brutalist ────────────────────────────────────────────────────────

function BrutalistTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="border-[3px] border-primary bg-[#0d0a13] px-3 py-2"
      style={{ fontFamily: "'Space Mono'" }}
    >
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-primary font-bold text-sm">{payload[0].value} joueurs</div>
    </div>
  );
}

// ─── Courbe ───────────────────────────────────────────────────────────────────

function PlayerCountChart({ points, days }: { points: PlayerCountPoint[]; days: number }) {
  const data = points.map((p) => {
    const d = new Date(p.timestamp);
    const label =
      days <= 1
        ? `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`
        : `${d.getUTCDate().toString().padStart(2, "0")}/${(d.getUTCMonth() + 1).toString().padStart(2, "0")}`;
    return { label, count: p.count };
  });

  // Décimer les ticks sur l'axe X pour éviter l'encombrement
  const tickInterval = Math.max(1, Math.floor(data.length / 10));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="playerFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "'Space Mono'" }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "'Space Mono'" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<BrutalistTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#playerFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#0d0a13", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function PlayerHeatmap({ heatmap }: { heatmap: HeatmapCell[] }) {
  const [hovered, setHovered] = useState<{ dow: number; hour: number } | null>(null);

  const cellMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of heatmap) m.set(`${c.dow}_${c.hour}`, c.avg);
    return m;
  }, [heatmap]);

  const maxAvg = useMemo(() => {
    const vals = heatmap.map((c) => c.avg);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [heatmap]);

  const hoveredCell = hovered ? cellMap.get(`${hovered.dow}_${hovered.hour}`) : null;

  return (
    <div>
      {/* En-tête heures */}
      <div className="flex ml-10 mb-1">
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="flex-1 text-center text-[8px] font-mono text-muted-foreground/50"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {h % 3 === 0 ? `${h}h` : ""}
          </div>
        ))}
      </div>

      {/* Grille */}
      {DAY_ORDER.map((dow) => (
        <div key={dow} className="flex items-center mb-0.5">
          {/* Label jour */}
          <div
            className="w-10 shrink-0 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {DAY_LABELS[dow]}
          </div>
          {/* Cellules heure */}
          {Array.from({ length: 24 }, (_, hour) => {
            const avg = cellMap.get(`${dow}_${hour}`) ?? 0;
            const intensity = maxAvg > 0 ? avg / maxAvg : 0;
            const isHovered = hovered?.dow === dow && hovered?.hour === hour;
            return (
              <div
                key={hour}
                className="flex-1 h-5 border border-transparent cursor-default transition-colors"
                style={{
                  backgroundColor:
                    avg > 0
                      ? `rgba(139, 92, 246, ${0.08 + intensity * 0.82})`
                      : "rgba(255,255,255,0.03)",
                  borderColor: isHovered ? "#8b5cf6" : "transparent",
                }}
                onMouseEnter={() => setHovered({ dow, hour })}
                onMouseLeave={() => setHovered(null)}
                title={avg > 0 ? `${DAY_LABELS[dow]} ${hour}h → ~${avg} joueurs` : ""}
              />
            );
          })}
        </div>
      ))}

      {/* Tooltip hover */}
      <div className="mt-2 h-5 flex items-center">
        {hovered && (
          <span
            className="text-[10px] font-mono text-muted-foreground"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {DAY_LABELS[hovered.dow]} {hovered.hour}h →{" "}
            {hoveredCell != null && hoveredCell > 0 ? (
              <span className="text-primary font-bold">~{hoveredCell} joueurs</span>
            ) : (
              <span className="text-muted-foreground/40">pas de données</span>
            )}
          </span>
        )}
      </div>

      {/* Légende */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className="text-[9px] font-mono text-muted-foreground/50"
          style={{ fontFamily: "'Space Mono'" }}
        >
          CREUX
        </span>
        <div className="flex gap-px">
          {[0.08, 0.25, 0.45, 0.65, 0.82, 0.9].map((a, i) => (
            <div
              key={i}
              className="w-5 h-3"
              style={{ backgroundColor: `rgba(139, 92, 246, ${a})` }}
            />
          ))}
        </div>
        <span
          className="text-[9px] font-mono text-muted-foreground/50"
          style={{ fontFamily: "'Space Mono'" }}
        >
          RUSH
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AffluencePage() {
  const [period, setPeriod] = useState("7");
  const days = PERIODS.find((p) => p.id === period)?.days ?? 7;

  const fn = useServerFn(getPlayerCountHistory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["player-count-history", days],
    queryFn: () => fn({ data: { days } }),
    staleTime: 10 * 60_000,
  });

  const points = data?.points ?? [];
  const heatmap = data?.heatmap ?? [];

  const latest = points.at(-1)?.count ?? null;
  const max = points.length > 0 ? Math.max(...points.map((p) => p.count)) : null;
  const avg =
    points.length > 0 ? Math.round(points.reduce((s, p) => s + p.count, 0) / points.length) : null;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div>
        <MonoLabel>// affluence.paladium</MonoLabel>
        <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "'Space Grotesk'" }}>
          AFFLUENCE PALADIUM
        </h1>
        <p
          className="text-sm text-muted-foreground mt-1 font-mono"
          style={{ fontFamily: "'Space Mono'" }}
        >
          Fréquentation globale du serveur — pour planifier les opés faction.
        </p>
      </div>

      {/* Sélecteur de période */}
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList className="rounded-none border border-border bg-transparent h-auto p-0">
          {PERIODS.map((p) => (
            <TabsTrigger
              key={p.id}
              value={p.id}
              className="rounded-none border-r border-border last:border-r-0 data-[state=active]:bg-primary data-[state=active]:text-white uppercase text-[11px] tracking-wider px-4 py-2"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Stats rapides */}
      {!isLoading && !error && points.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "ACTUELLEMENT", value: latest != null ? `${latest}` : "—", unit: "joueurs" },
            { label: "MAX SUR PÉRIODE", value: max != null ? `${max}` : "—", unit: "joueurs" },
            { label: "MOYENNE", value: avg != null ? `${avg}` : "—", unit: "joueurs" },
          ].map((s) => (
            <div key={s.label} className="border-[3px] border-border p-3 bg-card">
              <div
                className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {s.label}
              </div>
              <div
                className="text-2xl font-bold text-primary tabular-nums"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {s.value}
              </div>
              <div
                className="text-[9px] text-muted-foreground uppercase"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {s.unit}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Courbe */}
      <PageCard>
        <SectionLabel>évolution sur {PERIODS.find((p) => p.id === period)?.label}</SectionLabel>
        {isLoading && <div className="h-[200px] animate-pulse bg-muted" />}
        {error && (
          <p className="text-xs text-red-400 font-mono py-8 text-center">Erreur de chargement</p>
        )}
        {!isLoading && !error && points.length === 0 && (
          <p
            className="text-xs text-muted-foreground font-mono py-8 text-center uppercase tracking-wider"
            style={{ fontFamily: "'Space Mono'" }}
          >
            Aucune donnée — attends le prochain snapshot (15 min)
          </p>
        )}
        {!isLoading && !error && points.length > 0 && (
          <PlayerCountChart points={points} days={days} />
        )}
        <p
          className="text-[9px] text-muted-foreground/40 font-mono mt-2 uppercase tracking-wider"
          style={{ fontFamily: "'Space Mono'" }}
        >
          Données UTC+2 · snapshot toutes les 15 min
        </p>
      </PageCard>

      {/* Heatmap */}
      <PageCard>
        <SectionLabel>
          heures de pointe — {PERIODS.find((p) => p.id === period)?.label} (UTC+2)
        </SectionLabel>
        {isLoading && <div className="h-40 animate-pulse bg-muted" />}
        {!isLoading && !error && heatmap.length === 0 && (
          <p
            className="text-xs text-muted-foreground font-mono py-4 text-center uppercase tracking-wider"
            style={{ fontFamily: "'Space Mono'" }}
          >
            Pas assez de données
          </p>
        )}
        {!isLoading && !error && heatmap.length > 0 && <PlayerHeatmap heatmap={heatmap} />}
      </PageCard>
    </div>
  );
}
