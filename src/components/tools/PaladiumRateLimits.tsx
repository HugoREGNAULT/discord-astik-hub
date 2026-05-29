import { useEffect, useState } from "react";
import { PALADIUM_ROUTES, useRateLimits } from "@/lib/paladium/rate-limits";

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "prêt";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function PaladiumRateLimits() {
  const rates = useRateLimits();
  // tick every second to refresh countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border border-zinc-800 bg-zinc-950">
      <div
        className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-pink-500"
        style={{ fontFamily: "'Space Mono'" }}
      >
        <span>// rate limits API Paladium</span>
        <span className="text-zinc-500">par app · fenêtre glissante</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800"
              style={{ fontFamily: "'Space Mono'" }}
            >
              <th className="px-4 py-2 font-normal">Route</th>
              <th className="px-4 py-2 font-normal text-right">Restant</th>
              <th className="px-4 py-2 font-normal text-right">Quota</th>
              <th className="px-4 py-2 font-normal text-right">Reset</th>
            </tr>
          </thead>
          <tbody>
            {PALADIUM_ROUTES.map((r) => {
              const info = rates[r.template];
              const remaining = info?.remaining ?? null;
              const limit = info?.limit ?? r.limit;
              const resetMs = info?.resetAt != null ? info.resetAt - Date.now() : null;
              const used = remaining != null;
              const low = used && remaining <= Math.max(1, Math.floor(limit * 0.1));
              return (
                <tr key={r.template} className="border-b border-zinc-900 last:border-0">
                  <td className="px-4 py-2">
                    <div className="text-zinc-200">{r.label}</div>
                    <div
                      className="text-[10px] text-zinc-600 truncate"
                      style={{ fontFamily: "'Space Mono'" }}
                    >
                      {r.template}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      !used ? "text-zinc-600" : low ? "text-pink-500" : "text-zinc-200"
                    }`}
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {used ? remaining : "—"}
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums text-zinc-500"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {limit}/{r.windowMin}min
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums text-zinc-400"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {resetMs != null ? fmtCountdown(resetMs) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // mis à jour après chaque appel · « — » = pas encore appelé cette session
      </div>
    </div>
  );
}
