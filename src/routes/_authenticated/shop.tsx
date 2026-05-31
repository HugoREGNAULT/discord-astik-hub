import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ToolHeader,
  ToolCard,
  DaButton,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { listShopRewards, createSpendRequest, listMySpendRequests } from "@/lib/data/shop.functions";
import { getMyOverview } from "@/lib/data/me.functions";
import { toUserMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({ meta: [{ title: "Boutique · PunkAstik" }] }),
  component: ShopPage,
  errorComponent: ({ error }) => <ErrorBlock message={toUserMessage(error)} />,
});

function ShopPage() {
  const qc = useQueryClient();
  const lsRewards = useServerFn(listShopRewards);
  const lsMine = useServerFn(listMySpendRequests);
  const meFn = useServerFn(getMyOverview);
  const createFn = useServerFn(createSpendRequest);

  const rewardsQ = useQuery({ queryKey: ["shop", "rewards"], queryFn: () => lsRewards() });
  const mineQ = useQuery({ queryKey: ["shop", "mine"], queryFn: () => lsMine() });
  const meQ = useQuery({ queryKey: ["me-overview"], queryFn: () => meFn() });

  const balance = meQ.data?.member?.astik_points ?? 0;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const mut = useMutation({
    mutationFn: (rewardId: string) => createFn({ data: { rewardId, quantity: 1 } }),
    onSuccess: () => {
      toast.success("Demande envoyée — en attente de validation staff");
      qc.invalidateQueries({ queryKey: ["shop", "mine"] });
      qc.invalidateQueries({ queryKey: ["shop", "rewards"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
    onSettled: () => {
      setPending(false);
      setConfirmId(null);
    },
  });

  return (
    <div className="space-y-6">
      <ToolHeader
        code="// shop"
        title="Boutique AstikPoints"
        description="Échange tes points contre des récompenses en jeu. Chaque demande doit être validée par le staff."
      />

      <ToolCard>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">// solde</span>
          <span className="text-2xl font-bold text-pink-500">
            {balance.toLocaleString("fr-FR")} pts
          </span>
        </div>
      </ToolCard>

      <section>
        <h2 className="text-sm uppercase tracking-[0.3em] text-pink-500 mb-3">// catalogue</h2>
        {rewardsQ.isLoading ? (
          <LoadingBlock />
        ) : rewardsQ.error ? (
          <ErrorBlock message={toUserMessage(rewardsQ.error)} />
        ) : (rewardsQ.data?.rewards ?? []).length === 0 ? (
          <EmptyBlock label="Aucune récompense disponible." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rewardsQ.data!.rewards.map((r: any) => {
              const insufficient = balance < r.cost_points;
              const outOfStock = r.stock !== null && r.stock !== undefined && r.stock <= 0;
              return (
                <ToolCard key={r.id}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-white">{r.name}</h3>
                      <span className="text-pink-500 font-bold whitespace-nowrap">
                        {r.cost_points} pts
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-sm text-zinc-400">{r.description}</p>
                    )}
                    <div className="flex gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      {r.category && <span className="border border-zinc-700 px-2 py-0.5">{r.category}</span>}
                      <span className="border border-zinc-700 px-2 py-0.5">
                        stock: {r.stock === null || r.stock === undefined ? "illimité" : r.stock}
                      </span>
                    </div>
                    <DaButton
                      className="mt-2"
                      disabled={insufficient || outOfStock || mut.isPending}
                      onClick={() => setConfirmId(r.id)}
                    >
                      {outOfStock ? "Rupture" : insufficient ? "Solde insuffisant" : "Échanger"}
                    </DaButton>
                  </div>
                </ToolCard>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-[0.3em] text-pink-500 mb-3">// mes demandes</h2>
        {mineQ.isLoading ? (
          <LoadingBlock />
        ) : (mineQ.data?.requests ?? []).length === 0 ? (
          <EmptyBlock label="Aucune demande pour le moment." />
        ) : (
          <ToolCard>
            <div className="divide-y divide-zinc-800">
              {mineQ.data!.requests.map((r: any) => (
                <div key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="text-white">{r.reward_name} <span className="text-zinc-500">x{r.quantity}</span></div>
                    <div className="text-xs text-zinc-500">{new Date(r.requested_at).toLocaleString("fr-FR")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-pink-500">{r.total_cost} pts</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </ToolCard>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="Confirmer l'échange"
        description="Ta demande sera mise en attente de validation par le staff. Les points ne sont débités qu'après approbation."
        confirmLabel={pending ? "Envoi…" : "Confirmer"}
        onConfirm={() => {
          if (!confirmId) return;
          setPending(true);
          mut.mutate(confirmId);
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "text-amber-400 border-amber-400/40",
    approved: "text-emerald-400 border-emerald-400/40",
    rejected: "text-red-400 border-red-400/40",
    expired: "text-zinc-500 border-zinc-700",
    fulfilled: "text-emerald-500 border-emerald-500/60",
  };
  const cls = map[status] ?? "text-zinc-400 border-zinc-700";
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${cls}`}>
      {status}
    </span>
  );
}
