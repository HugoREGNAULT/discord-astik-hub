import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  EmptyBlock,
  ErrorBlock,
} from "@/components/tools/ToolsUi";
import {
  listMyShopAlerts,
  updateShopAlert,
  deleteShopAlert,
  type ShopAlertRow,
} from "@/lib/data/shop-alerts.functions";

export const Route = createFileRoute("/_authenticated/tools/alerts")({
  head: () => ({
    meta: [
      { title: "Mes alertes prix · PunkAstik" },
      {
        name: "description",
        content:
          "Toutes tes alertes de prix Paladium (shop admin + HDV). Modifie le seuil, la direction ou supprime-les.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyShopAlerts);
  const q = useQuery({
    queryKey: ["my-shop-alerts"],
    queryFn: () => listFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-shop-alerts"] });

  const shopAlerts = (q.data?.alerts ?? []).filter((a) => a.source === "shop_admin");
  const marketAlerts = (q.data?.alerts ?? []).filter((a) => a.source === "market");

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.alerts"
        title="Mes alertes prix"
        description="Notifications Discord quand un prix passe au-dessus ou en dessous de ton seuil. Tu peux les modifier ou les supprimer à tout moment."
      />

      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      <ToolCard>
        <SectionHeader
          icon={<Bell className="size-3" />}
          label="// alertes shop admin"
          count={shopAlerts.length}
        />
        {shopAlerts.length === 0 ? (
          <EmptyBlock label="Aucune alerte shop admin. Va sur Shop admin → choisis un item → crée une alerte." />
        ) : (
          <ul className="space-y-2">
            {shopAlerts.map((a) => (
              <AlertItem key={a.id} alert={a} onChange={refresh} />
            ))}
          </ul>
        )}
      </ToolCard>

      <ToolCard>
        <SectionHeader
          icon={<Bell className="size-3" />}
          label="// alertes hdv (marché)"
          count={marketAlerts.length}
        />
        {marketAlerts.length === 0 ? (
          <EmptyBlock label="Aucune alerte HDV. Va sur Market HDV → ouvre un item → crée une alerte." />
        ) : (
          <ul className="space-y-2">
            {marketAlerts.map((a) => (
              <AlertItem key={a.id} alert={a} onChange={refresh} />
            ))}
          </ul>
        )}
      </ToolCard>
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3 flex items-center gap-2"
      style={{ fontFamily: "'Space Mono'" }}
    >
      {icon}
      <span>{label}</span>
      <span className="text-zinc-700">·</span>
      <span className="text-zinc-400">{count}</span>
    </div>
  );
}

function AlertItem({ alert, onChange }: { alert: ShopAlertRow; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState(alert.direction);
  const [threshold, setThreshold] = useState(String(alert.threshold));

  const updateFn = useServerFn(updateShopAlert);
  const deleteFn = useServerFn(deleteShopAlert);

  const upd = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: alert.id,
          direction,
          threshold: Number(threshold),
        },
      }),
    onSuccess: () => {
      toast.success("Alerte mise à jour");
      setEditing(false);
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id: alert.id } }),
    onSuccess: () => {
      toast.success("Alerte supprimée");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kindLabel = alert.price_type === "avg" ? "prix moyen" : alert.price_type === "sell" ? "vente" : "achat";

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded border border-pink-500/40 bg-zinc-900/40 px-3 py-2 text-sm">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-zinc-200 truncate">{alert.item_name}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
            {kindLabel}
          </div>
        </div>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "above" | "below")}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
        >
          <option value="below">≤ seuil</option>
          <option value="above">≥ seuil</option>
        </select>
        <input
          type="number"
          step="any"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-28 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
        />
        <button
          onClick={() => {
            const n = Number(threshold);
            if (!Number.isFinite(n) || n <= 0) {
              toast.error("Seuil invalide");
              return;
            }
            upd.mutate();
          }}
          disabled={upd.isPending}
          className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          title="Enregistrer"
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={() => {
            setDirection(alert.direction);
            setThreshold(String(alert.threshold));
            setEditing(false);
          }}
          className="text-zinc-500 hover:text-white"
          title="Annuler"
        >
          <X className="size-4" />
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs text-zinc-200 truncate">{alert.item_name}</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
          {kindLabel} · {alert.direction === "below" ? "≤" : "≥"}{" "}
          {Number(alert.threshold).toLocaleString("fr-FR")}
          {alert.is_triggered && <span className="ml-2 text-amber-400">· déclenchée</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditing(true)}
          className="text-zinc-500 hover:text-pink-400 p-1"
          title="Modifier"
        >
          <Pencil className="size-4" />
        </button>
        <button
          onClick={() => {
            if (confirm("Supprimer cette alerte ?")) del.mutate();
          }}
          disabled={del.isPending}
          className="text-zinc-500 hover:text-red-400 p-1 disabled:opacity-50"
          title="Supprimer"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
