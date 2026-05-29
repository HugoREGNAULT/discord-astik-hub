import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  StatTile,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import {
  PaladiumApi,
  asArray,
  hasPaladiumKey,
  resolveUuid,
  type PlayerJob,
} from "@/lib/paladium/api";
import { JOBS, type JobId, xpBetween } from "@/lib/paladium/xp-curves";
import { RATES } from "@/lib/paladium/xp-rates";

export const Route = createFileRoute("/_authenticated/tools/xp-calculator")({
  head: () => ({
    meta: [
      { title: "Calculateur XP Métiers · Outils PunkAstik" },
      {
        name: "description",
        content:
          "Calcule l'XP nécessaire pour passer d'un niveau à un autre dans un métier Paladium.",
      },
    ],
  }),
  component: XpCalculator,
});

function XpCalculator() {
  const [job, setJob] = useState<JobId>("miner");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(50);
  const [currentXp, setCurrentXp] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [edition, setEdition] = useState<"java" | "bedrock">("java");

  const [pseudo, setPseudo] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);

  const uuidQ = useQuery({
    queryKey: ["mojang", resolved],
    queryFn: () => resolveUuid(resolved!),
    enabled: !!resolved,
    retry: false,
  });
  const jobsQ = useQuery({
    queryKey: ["pala-jobs", uuidQ.data?.id],
    queryFn: () => PaladiumApi.getPlayerJobs(uuidQ.data!.id),
    enabled: !!uuidQ.data?.id,
    retry: false,
  });

  // Prefill from fetched jobs if matching
  const jobsList = asArray<PlayerJob>(jobsQ.data ?? null);
  const matched = jobsList.find((j) => j.name?.toLowerCase().includes(job));

  const xpRaw = useMemo(() => xpBetween(job, from, to, currentXp), [job, from, to, currentXp]);
  const xpWithBonus = useMemo(
    () => Math.ceil(xpRaw / (1 + Math.max(0, bonus) / 100)),
    [xpRaw, bonus],
  );

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.xp-calculator"
        title="Calculateur XP Métiers"
        description="Sélectionne un métier, entre tes niveaux et obtiens l'XP totale et la quantité de ressources à farmer."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Métier">
            <select
              value={job}
              onChange={(e) => setJob(e.target.value as JobId)}
              className="w-full bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
            >
              {JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Édition">
            <div className="flex gap-1">
              {(["java", "bedrock"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEdition(e)}
                  className={`flex-1 px-2 py-2 text-xs uppercase tracking-[0.2em] border ${
                    edition === e
                      ? "border-pink-500 text-white bg-pink-500/10"
                      : "border-zinc-800 text-zinc-400"
                  }`}
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Bonus XP (%)">
            <input
              type="number"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value) || 0)}
              min={0}
              className="w-full bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
            />
          </Field>
          <Field label="Niveau actuel">
            <input
              type="number"
              value={from}
              min={0}
              onChange={(e) => setFrom(Number(e.target.value) || 0)}
              className="w-full bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
            />
          </Field>
          <Field label="Niveau cible">
            <input
              type="number"
              value={to}
              min={0}
              onChange={(e) => setTo(Number(e.target.value) || 0)}
              className="w-full bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
            />
          </Field>
          <Field label="XP déjà acquise (option.)">
            <input
              type="number"
              value={currentXp}
              min={0}
              onChange={(e) => setCurrentXp(Number(e.target.value) || 0)}
              className="w-full bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Pseudo (option.) — pré-remplit ton niveau"
            className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-pink-500 focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => setResolved(pseudo.trim() || null)}
            className="bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-2 border-b-4 border-black/20"
            style={{ fontFamily: "'Space Mono'" }}
          >
            Pré-remplir
          </button>
        </div>

        {uuidQ.error && (
          <p className="text-xs text-pink-400 mt-2">{(uuidQ.error as Error).message}</p>
        )}
        {matched && (
          <button
            type="button"
            onClick={() => {
              setFrom(matched.level ?? 1);
              setCurrentXp(Number(matched.experience ?? matched.xp ?? 0));
            }}
            className="mt-3 text-[10px] uppercase tracking-[0.3em] text-pink-500 hover:text-pink-400"
            style={{ fontFamily: "'Space Mono'" }}
          >
            → utiliser niveau {matched.level} ({Number(matched.experience ?? matched.xp ?? 0)} xp)
          </button>
        )}
      </ToolCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatTile label="XP brute requise" value={xpRaw.toLocaleString("fr-FR")} accent="white" />
        <StatTile
          label={`XP réelle (avec bonus ${bonus}%)`}
          value={xpWithBonus.toLocaleString("fr-FR")}
          accent="pink"
        />
      </div>

      <ToolCard>
        <h2
          className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-3"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // ressources à farmer
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
              <th className="py-2">Action</th>
              <th className="py-2 text-right">XP / unité</th>
              <th className="py-2 text-right">Quantité requise</th>
            </tr>
          </thead>
          <tbody>
            {RATES[job].map((a) => (
              <tr key={a.label} className="border-b border-zinc-900 last:border-0">
                <td className="py-2 text-zinc-300">{a.label}</td>
                <td className="py-2 text-right text-zinc-400">{a.xp}</td>
                <td className="py-2 text-right text-white font-bold">
                  {Math.ceil(xpWithBonus / a.xp).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-zinc-600 mt-3" style={{ fontFamily: "'Space Mono'" }}>
          // les courbes d'XP et rendements sont des approximations — ajuste les fichiers xp-curves
          / xp-rates si besoin. Édition: {edition}.
        </p>
      </ToolCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
