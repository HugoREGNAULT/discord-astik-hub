import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { RouteError } from "@/components/RouteError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Swords,
  Coins,
  Hammer,
  Globe2,
  Crown,
  Vault,
  Pickaxe,
  Sparkles,
  Calendar,
  Target,
  Rocket,
  Lock,
  Skull,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reunion-v12")({
  errorComponent: RouteError,
  head: () => ({
    meta: [
      { title: "Réunion générale · 19 juin · PunkAstik" },
      {
        name: "description",
        content:
          "Dossier de pré-lancement PunkAstik V12 — Leaks, objectifs, événements et plan de lancement.",
      },
    ],
  }),
  component: () => (
    <Guard perm="members.view">
      <ReunionV12Page />
    </Guard>
  ),
});

/* =========================================================================
 * Helpers
 * ====================================================================== */

const NEON = "#ec4899";
const BLURPLE = "#5865F2";

const MEETING_DATE = new Date("2026-06-14T15:00:00+02:00");
const LIVE_DATE = new Date("2026-06-19T18:00:00+02:00");
const OPEN_DATE = new Date("2026-06-19T19:00:00+02:00");

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

/* =========================================================================
 * UI primitives — Cyberpunk corner card
 * ====================================================================== */

function CyberCard({
  children,
  className = "",
  accent = NEON,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`relative bg-zinc-950/60 border border-zinc-800 hover:border-pink-500/60 transition-all duration-300 group ${className}`}
      style={{ boxShadow: `0 0 0 1px transparent` }}
    >
      {/* Corner accents */}
      <span
        className="absolute -top-px -left-px size-3 border-t border-l"
        style={{ borderColor: accent }}
      />
      <span
        className="absolute -top-px -right-px size-3 border-t border-r"
        style={{ borderColor: accent }}
      />
      <span
        className="absolute -bottom-px -left-px size-3 border-b border-l"
        style={{ borderColor: accent }}
      />
      <span
        className="absolute -bottom-px -right-px size-3 border-b border-r"
        style={{ borderColor: accent }}
      />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          boxShadow: `inset 0 0 30px ${accent}22, 0 0 24px ${accent}33`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionLabel({ code, title }: { code: string; title: string }) {
  return (
    <div className="mb-6">
      <div
        className="text-pink-500 text-[10px] uppercase tracking-[0.3em] mb-2"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // {code}
      </div>
      <h2
        className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-white"
        style={{ fontFamily: "'Space Grotesk'" }}
      >
        {title}
      </h2>
    </div>
  );
}

/* =========================================================================
 * Page
 * ====================================================================== */

function ReunionV12Page() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white -mx-4 -my-4 md:-mx-6 md:-my-6">
      <PageHeader
        code="STAFF/REUNION/19-JUIN"
        title="Réunion générale — 19 juin"
        description="Dossier de pré-lancement V12 · leaks, objectifs et plan de bataille."
      />

      <div className="px-4 md:px-6 pb-24 space-y-20">
        <Hero />
        <Countdown />
        <Timeline />
        <Leaks />
        <Events />
        <PointsRepartition />
        <Objectifs />
        <PlanLancement />
        <StaffSection />
      </div>

      {/* Scanlines */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .scanline::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 0%, rgba(236,72,153,0.06) 50%, transparent 100%);
          animation: scan 6s linear infinite;
          pointer-events: none;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease-out both; }
      `}</style>
    </div>
  );
}

/* =========================================================================
 * [00] HERO
 * ====================================================================== */

function Hero() {
  return (
    <section className="relative overflow-hidden scanline border border-zinc-800 bg-zinc-950/40 px-6 md:px-12 py-16 md:py-24 fade-up">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(236,72,153,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(88,101,242,0.18), transparent 45%)",
        }}
      />
      <div className="relative">
        <div
          className="text-pink-500 text-[10px] uppercase tracking-[0.4em] mb-4"
          style={{ fontFamily: "'Space Mono'" }}
        >
          [00] // pre_launch_dossier
        </div>
        <h1
          className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-none"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          PUNKASTIK <span className="text-pink-500">V12</span>
        </h1>
        <p
          className="mt-4 text-lg md:text-xl text-zinc-400 uppercase tracking-widest"
          style={{ fontFamily: "'Space Mono'" }}
        >
          Dossier de pré-lancement
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Badge
            variant="outline"
            className="font-mono border-pink-500/50 text-pink-400 px-3 py-1.5 uppercase tracking-wider"
          >
            <Sparkles className="size-3 mr-2" /> LIVE PALADIUM · 19 JUIN — 18H00
          </Badge>
          <Badge
            variant="outline"
            className="font-mono px-3 py-1.5 uppercase tracking-wider"
            style={{ borderColor: `${BLURPLE}80`, color: BLURPLE }}
          >
            <Rocket className="size-3 mr-2" /> OPEN V12 · 19 JUIN — 19H00
          </Badge>
        </div>

        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className="bg-pink-500 hover:bg-pink-600 text-black uppercase tracking-widest font-bold border-b-4 border-black/30"
          >
            <a href="#leaks">Accéder aux leaks</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 * [01] COMPTE À REBOURS
 * ====================================================================== */

function CountdownBlock({ label, target, color }: { label: string; target: Date; color: string }) {
  const { d, h, m, s } = useCountdown(target);
  const items = [
    { v: d, l: "Jours" },
    { v: h, l: "Heures" },
    { v: m, l: "Min" },
    { v: s, l: "Sec" },
  ];
  return (
    <CyberCard accent={color} className="p-6 md:p-8">
      <div
        className="text-xs uppercase tracking-[0.3em] mb-4"
        style={{ fontFamily: "'Space Mono'", color }}
      >
        // {label}
      </div>
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        {items.map((it) => (
          <div key={it.l} className="text-center">
            <div
              className="text-3xl md:text-5xl font-black tabular-nums"
              style={{ fontFamily: "'Space Grotesk'", color }}
            >
              {String(it.v).padStart(2, "0")}
            </div>
            <div
              className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {it.l}
            </div>
          </div>
        ))}
      </div>
    </CyberCard>
  );
}

function Countdown() {
  return (
    <section className="fade-up">
      <SectionLabel code="01" title="Compte à rebours" />
      <div className="grid md:grid-cols-2 gap-6">
        <CountdownBlock label="Live Paladium" target={LIVE_DATE} color={NEON} />
        <CountdownBlock label="Ouverture V12" target={OPEN_DATE} color={BLURPLE} />
      </div>
    </section>
  );
}

/* =========================================================================
 * [02] TIMELINE
 * ====================================================================== */

const TIMELINE = [
  { when: "19 Juin · 18h", what: "Live Paladium", icon: Sparkles },
  { when: "19 Juin · 19h", what: "Ouverture V12", icon: Rocket },
  { when: "J+3", what: "Baby Wither", icon: Skull },
  { when: "J+10", what: "Wither Normal", icon: Skull },
  { when: "J+30", what: "Passif", icon: ShieldCheck },
  { when: "J+60", what: "Prédateur", icon: Swords },
  { when: "J+75", what: "Thirsty", icon: Skull },
  { when: "J+120", what: "Suprême", icon: Crown },
];

function Timeline() {
  return (
    <section className="fade-up">
      <SectionLabel code="02" title="Timeline V12" />
      <div className="relative">
        <div
          className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent, #ec4899 20%, #5865F2 80%, transparent)",
          }}
        />
        <div className="space-y-6">
          {TIMELINE.map((step, i) => {
            const Icon = step.icon;
            const left = i % 2 === 0;
            return (
              <div
                key={step.what}
                className={`relative flex ${left ? "md:flex-row" : "md:flex-row-reverse"} items-start gap-4 md:gap-8`}
              >
                <div className="relative z-10 md:w-1/2 pl-12 md:pl-0 md:px-8">
                  <CyberCard accent={i < 2 ? NEON : BLURPLE} className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-9 grid place-items-center border"
                        style={{
                          borderColor: i < 2 ? NEON : BLURPLE,
                          boxShadow: `0 0 12px ${(i < 2 ? NEON : BLURPLE) + "55"}`,
                        }}
                      >
                        <Icon className="size-4" style={{ color: i < 2 ? NEON : BLURPLE }} />
                      </div>
                      <div>
                        <div
                          className="text-[10px] uppercase tracking-widest text-zinc-500"
                          style={{ fontFamily: "'Space Mono'" }}
                        >
                          {step.when}
                        </div>
                        <div className="text-base font-bold uppercase tracking-tight text-white">
                          {step.what}
                        </div>
                      </div>
                    </div>
                  </CyberCard>
                </div>
                <span
                  className="absolute left-4 md:left-1/2 top-4 -translate-x-1/2 size-3 rounded-full"
                  style={{
                    background: i < 2 ? NEON : BLURPLE,
                    boxShadow: `0 0 12px ${i < 2 ? NEON : BLURPLE}`,
                  }}
                />
                <div className="hidden md:block md:w-1/2" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 * [03] LEAKS
 * ====================================================================== */

const BRANCHES = [
  {
    icon: Swords,
    label: "Pillage",
    color: NEON,
    items: ["Buffs offensifs", "Nouveaux outils de raid", "Bonus territoire"],
  },
  {
    icon: Coins,
    label: "Économie",
    color: "#f59e0b",
    items: ["Multiplicateurs banque", "Trade inter-faction", "Marché HDV"],
  },
  {
    icon: Hammer,
    label: "Build",
    color: "#10b981",
    items: ["Blocs exclusifs", "Claims étendus", "Foreuse Bedrock"],
  },
  {
    icon: Globe2,
    label: "Global",
    color: BLURPLE,
    items: ["XP partagée", "Évents communs", "Récompenses cross-ligues"],
  },
];

const LIGUES = [
  { name: "Bronze", color: "#cd7f32" },
  { name: "Argent", color: "#c0c0c0" },
  { name: "Or", color: "#ffd700" },
  { name: "Diamant", color: "#5865F2" },
  { name: "Platine", color: "#ec4899" },
];

function Leaks() {
  return (
    <section id="leaks" className="fade-up scroll-mt-20">
      <SectionLabel code="03" title="Leaks V12" />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Rework Withers */}
        <CyberCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Skull className="size-5 text-pink-500" />
            <h3 className="text-lg font-bold uppercase tracking-tight">Rework Withers</h3>
          </div>
          <ul className="text-sm text-zinc-300 space-y-2 mb-4">
            <li>• Refonte complète des paliers</li>
            <li>• Nerfs ciblés sur le Suprême</li>
            <li>• Nouveaux upgrades intermédiaires</li>
            <li>• Courbe XP rééquilibrée</li>
          </ul>
          <div
            className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // progression estimée
          </div>
          <Progress value={62} className="h-2" />
        </CyberCard>

        {/* Factions */}
        <CyberCard accent={BLURPLE} className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="size-5" style={{ color: BLURPLE }} />
            <h3 className="text-lg font-bold uppercase tracking-tight">Factions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Membres" from="20" to="35" />
            <Stat label="Claims" from="100" to="650" />
          </div>
          <ul className="text-sm text-zinc-300 space-y-2 mt-4">
            <li>• Suppression multi-faction</li>
            <li>• Nouveau système de permissions granulaires</li>
          </ul>
        </CyberCard>

        {/* Branches Progression */}
        <CyberCard className="p-6 lg:col-span-2">
          <h3 className="text-lg font-bold uppercase tracking-tight mb-5">Progression</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BRANCHES.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.label}
                  className="border border-zinc-800 hover:border-zinc-700 bg-zinc-950/50 p-4 transition"
                  style={{ boxShadow: `inset 0 -2px 0 ${b.color}` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="size-4" style={{ color: b.color }} />
                    <div className="text-sm font-bold uppercase tracking-wider">{b.label}</div>
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-1">
                    {b.items.map((it) => (
                      <li key={it}>· {it}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CyberCard>

        {/* Classements */}
        <CyberCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="size-5 text-pink-500" />
            <h3 className="text-lg font-bold uppercase tracking-tight">Classements</h3>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {LIGUES.map((l) => (
              <div
                key={l.name}
                className="text-center border border-zinc-800 bg-zinc-950/60 p-3"
                style={{ boxShadow: `inset 0 -2px 0 ${l.color}` }}
              >
                <Crown className="size-4 mx-auto mb-2" style={{ color: l.color }} />
                <div
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: l.color, fontFamily: "'Space Mono'" }}
                >
                  {l.name}
                </div>
              </div>
            ))}
          </div>
        </CyberCard>

        {/* Banque */}
        <CyberCard accent="#f59e0b" className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Vault className="size-5" style={{ color: "#f59e0b" }} />
            <h3 className="text-lg font-bold uppercase tracking-tight">Banque</h3>
          </div>
          <div className="space-y-3">
            {[
              { lvl: "Niveau 1", cost: "~50 M", pct: 100 },
              { lvl: "Niveau 2", cost: "~250 M", pct: 60 },
              { lvl: "Niveau 3", cost: "~1 Md", pct: 15 },
            ].map((p) => (
              <div key={p.lvl}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="uppercase tracking-wider text-zinc-300">{p.lvl}</span>
                  <span className="text-zinc-500 font-mono">{p.cost}</span>
                </div>
                <Progress value={p.pct} className="h-1.5" />
              </div>
            ))}
          </div>
        </CyberCard>

        {/* Foreuse Bedrock */}
        <CyberCard accent="#10b981" className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Pickaxe className="size-5" style={{ color: "#10b981" }} />
            <h3 className="text-lg font-bold uppercase tracking-tight">Foreuse Bedrock</h3>
          </div>
          <ul className="text-sm text-zinc-300 space-y-2">
            <li>
              <span className="text-zinc-500">Fonction :</span> mine sous la bedrock
            </li>
            <li>
              <span className="text-zinc-500">Restriction :</span> 1 par faction
            </li>
            <li>
              <span className="text-zinc-500">Utilité :</span> ressources rares endgame
            </li>
          </ul>
        </CyberCard>

        {/* Donjons */}
        <CyberCard className="p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="size-5 text-pink-500" />
            <h3 className="text-lg font-bold uppercase tracking-tight">Donjons</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-zinc-300">
            <div>
              <div
                className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // nouveaux sorts
              </div>
              <p>Sorts inédits débloqués via progression de faction.</p>
            </div>
            <div>
              <div
                className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // récompenses
              </div>
              <p>Drops exclusifs, fragments d'Antique.</p>
            </div>
            <div>
              <div
                className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // stratégique
              </div>
              <p>Source majeure de power-spike en mid-game.</p>
            </div>
          </div>
        </CyberCard>
      </div>
    </section>
  );
}

function Stat({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/60 p-3">
      <div
        className="text-[10px] uppercase tracking-widest text-zinc-500"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-zinc-500 line-through font-mono">{from}</span>
        <span className="text-2xl font-black text-pink-500">{to}</span>
      </div>
    </div>
  );
}

/* =========================================================================
 * [04] EVENTS
 * ====================================================================== */

const WEEK = [
  { day: "Lun", evt: "Libre" },
  { day: "Mar", evt: "Egghunt" },
  { day: "Mer", evt: "Totem" },
  { day: "Jeu", evt: "Libre" },
  { day: "Ven", evt: "End Event" },
  { day: "Sam", evt: "KOTH" },
  { day: "Dim", evt: "Egghunt" },
];

function Events() {
  return (
    <section className="fade-up">
      <SectionLabel code="04" title="Events" />
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {WEEK.map((d) => {
          const accent = d.evt === "Libre" ? "#52525b" : NEON;
          return (
            <CyberCard key={d.day} accent={accent} className="p-4 text-center">
              <div
                className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {d.day}
              </div>
              <div
                className="text-sm font-bold uppercase tracking-tight"
                style={{ color: d.evt === "Libre" ? "#71717a" : "#fff" }}
              >
                {d.evt}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800/80 text-[10px] text-zinc-500 font-mono">
                Boss ×2
              </div>
            </CyberCard>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================================
 * [05] RÉPARTITION DES POINTS
 * ====================================================================== */

const POINTS = [
  { label: "KOTH", val: 1000, color: "#ec4899" },
  { label: "Totem", val: 1000, color: "#f43f5e" },
  { label: "Boss", val: 1000, color: "#5865F2" },
  { label: "Egghunt", val: 750, color: "#a855f7" },
  { label: "Farm AVM", val: 750, color: "#10b981" },
  { label: "End Event", val: 500, color: "#f59e0b" },
];

function PointsRepartition() {
  const total = POINTS.reduce((s, p) => s + p.val, 0);
  const R = 80;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = POINTS.map((p) => {
    const len = (p.val / total) * C;
    const arc = { ...p, len, offset, pct: (p.val / total) * 100 };
    offset += len;
    return arc;
  });

  return (
    <section className="fade-up">
      <SectionLabel code="05" title="Répartition des points" />
      <CyberCard className="p-6">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="relative grid place-items-center">
            <svg viewBox="0 0 200 200" className="w-64 h-64 -rotate-90">
              <circle cx="100" cy="100" r={R} fill="none" stroke="#18181b" strokeWidth="22" />
              {arcs.map((a) => (
                <circle
                  key={a.label}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="22"
                  strokeDasharray={`${a.len} ${C}`}
                  strokeDashoffset={-a.offset}
                  style={{
                    filter: `drop-shadow(0 0 4px ${a.color})`,
                    transition: "stroke-dasharray 1s ease",
                  }}
                />
              ))}
            </svg>
            <div className="absolute text-center">
              <div
                className="text-3xl font-black"
                style={{ fontFamily: "'Space Grotesk'", color: NEON }}
              >
                {total.toLocaleString("fr-FR")}
              </div>
              <div
                className="text-[10px] uppercase tracking-widest text-zinc-500"
                style={{ fontFamily: "'Space Mono'" }}
              >
                pts / semaine
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {arcs.map((a) => (
              <div
                key={a.label}
                className="flex items-center justify-between gap-3 border-b border-zinc-800/80 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="size-3"
                    style={{ background: a.color, boxShadow: `0 0 8px ${a.color}` }}
                  />
                  <span className="uppercase tracking-wider text-sm">{a.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs font-mono">
                    {a.pct.toFixed(0)}%
                  </span>
                  <span className="font-bold tabular-nums">{a.val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CyberCard>
    </section>
  );
}

/* =========================================================================
 * [06] OBJECTIFS
 * ====================================================================== */

const OBJECTIFS = [
  { label: "100 membres actifs", pct: 42, due: "J+30" },
  { label: "Screen de faction", pct: 10, due: "J+7" },
  { label: "Utilisation d'un Suprême Wither", pct: 0, due: "J+120" },
  { label: "Meilleur village faction", pct: 25, due: "J+45" },
  { label: "1 milliard banque", pct: 5, due: "J+60" },
  { label: "BC 27×27", pct: 0, due: "J+90" },
  { label: "Avant-poste", pct: 15, due: "J+30" },
  { label: "5 Full Antique", pct: 8, due: "J+90" },
];

function statusOf(pct: number) {
  if (pct >= 100) return { txt: "Atteint", color: "#10b981" };
  if (pct >= 50) return { txt: "En cours", color: NEON };
  if (pct > 0) return { txt: "Lancé", color: "#f59e0b" };
  return { txt: "À venir", color: "#52525b" };
}

function Objectifs() {
  return (
    <section className="fade-up">
      <SectionLabel code="06" title="Objectifs PunkAstik" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {OBJECTIFS.map((o) => {
          const st = statusOf(o.pct);
          return (
            <CyberCard key={o.label} accent={st.color} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Target className="size-4 text-pink-500" />
                <span
                  className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 border"
                  style={{ color: st.color, borderColor: `${st.color}66` }}
                >
                  {st.txt}
                </span>
              </div>
              <div className="text-sm font-bold uppercase tracking-tight mb-3 min-h-[2.5rem]">
                {o.label}
              </div>
              <Progress value={o.pct} className="h-1.5" />
              <div className="mt-3 flex justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                <span>{o.pct}%</span>
                <span>{o.due}</span>
              </div>
            </CyberCard>
          );
        })}
      </div>
      <p
        className="mt-4 text-[10px] uppercase tracking-widest text-zinc-600"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // données mock — branchement bot Discord prévu
      </p>
    </section>
  );
}

/* =========================================================================
 * [07] PLAN DE LANCEMENT
 * ====================================================================== */

const PLAN = [
  {
    when: "J0",
    color: NEON,
    items: [
      "Connexion de tous les membres",
      "Organisation vocale",
      "Farm initial",
      "Claims prioritaires",
    ],
  },
  {
    when: "J+7",
    color: BLURPLE,
    items: ["Premières progressions", "Déblocages", "Préparation événements"],
  },
  {
    when: "J+30",
    color: "#10b981",
    items: [
      "Développement économique",
      "Développement militaire",
      "Préparation endgame",
    ],
  },
];

function PlanLancement() {
  return (
    <section className="fade-up">
      <SectionLabel code="07" title="Plan de lancement" />
      <div className="grid md:grid-cols-3 gap-6">
        {PLAN.map((p) => (
          <CyberCard key={p.when} accent={p.color} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="size-5" style={{ color: p.color }} />
              <div
                className="text-2xl font-black"
                style={{ color: p.color, fontFamily: "'Space Grotesk'" }}
              >
                {p.when}
              </div>
            </div>
            <ul className="space-y-2 text-sm text-zinc-300">
              {p.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <span style={{ color: p.color }}>▸</span>
                  {it}
                </li>
              ))}
            </ul>
          </CyberCard>
        ))}
      </div>
    </section>
  );
}

/* =========================================================================
 * [08] SECTION STAFF (auth verrouillée par <Guard>)
 * ====================================================================== */

function StaffSection() {
  return (
    <section className="fade-up">
      <SectionLabel code="08" title="Section Staff" />
      <CyberCard accent={BLURPLE} className="p-8">
        <div className="flex items-start gap-4">
          <div
            className="size-12 grid place-items-center border shrink-0"
            style={{ borderColor: BLURPLE, boxShadow: `0 0 16px ${BLURPLE}66` }}
          >
            <Lock className="size-5" style={{ color: BLURPLE }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold uppercase tracking-tight mb-2">
              Zone confidentielle
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              Accès restreint aux membres du staff via Discord. Cette section accueillera
              prochainement :
            </p>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-zinc-300">
              <li>• Notes stratégiques</li>
              <li>• Plans de farm</li>
              <li>• Objectifs confidentiels</li>
              <li>• Répartition des responsabilités</li>
            </ul>
            <div
              className="mt-6 text-[10px] uppercase tracking-widest text-zinc-500"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // contenu en préparation · vérification rôles Discord active
            </div>
          </div>
        </div>
      </CyberCard>
    </section>
  );
}
