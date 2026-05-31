import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";

import { listMembers } from "@/lib/data/members.functions";
import { addPoints, removePoints, setPoints, getPointsHistory } from "@/lib/data/points.functions";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  PageHeader,
  PageCard,
  SectionLabel,
  DaButton,
  DaInput,
  DaSelect,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DonationsPanel } from "@/components/DonationsPanel";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({ meta: [{ title: "Gestion Points · PunkAstik" }] }),
  component: () => (
    <Guard perm="points.manage">
      <PointsPage />
    </Guard>
  ),
});

function PointsPage() {
  const me = useCurrentUser();
  const canDonations = hasPerm(me, "donations.manage");

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        code="// points.manage"
        title="Gestion Points"
        description="Ajustements manuels du solde et paniers de dons regroupés au même endroit."
      />
      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Actions manuelles</TabsTrigger>
          {canDonations && <TabsTrigger value="donations">Dons</TabsTrigger>}
        </TabsList>
        <TabsContent value="manual" className="mt-4">
          <ManualPanel />
        </TabsContent>
        {canDonations && (
          <TabsContent value="donations" className="mt-4">
            <DonationsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ManualPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMembers);
  const addFn = useServerFn(addPoints);
  const rmFn = useServerFn(removePoints);
  const setFn = useServerFn(setPoints);
  const histFn = useServerFn(getPointsHistory);
  const fid = useId();

  const members = useQuery({
    queryKey: ["members", "", "active"],
    queryFn: () => listFn({ data: {} }),
  });

  const [target, setTarget] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const history = useQuery({
    queryKey: ["history", target],
    queryFn: () => histFn({ data: { memberDiscordId: target, limit: 25 } }),
    enabled: !!target,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history", target] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const run = async (action: "add" | "remove" | "set") => {
    if (!target) {
      toast.error("Sélectionne un membre.");
      return;
    }
    if (action !== "set" && amount <= 0) {
      toast.error("Montant > 0 requis.");
      return;
    }
    if (action === "set" && amount < 0) {
      toast.error("Le solde ne peut pas être négatif.");
      return;
    }
    setBusy(true);
    try {
      let res: { total: number };
      if (action === "add")
        res = await addFn({ data: { memberDiscordId: target, amount, reason } });
      else if (action === "remove")
        res = await rmFn({ data: { memberDiscordId: target, amount, reason } });
      else res = await setFn({ data: { memberDiscordId: target, total: amount, reason } });
      toast.success(`OK — nouveau solde : ${res.total} pts`);
      setAmount(0);
      setReason("");
      refresh();
    } catch (e: any) {
      toast.error(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>action manuelle</SectionLabel>
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`${fid}-member`}
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Membre
            </label>
            <DaSelect
              id={`${fid}-member`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full mt-1"
            >
              <option value="">— Choisir —</option>
              {members.data?.members.map((m) => (
                <option key={m.discord_id} value={m.discord_id}>
                  {m.ig_name ?? m.discord_username} ({m.astik_points} pts)
                </option>
              ))}
            </DaSelect>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${fid}-amount`}
                className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
                style={{ fontFamily: "'Space Mono'" }}
              >
                Montant
              </label>
              <DaInput
                id={`${fid}-amount`}
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={`${fid}-reason`}
                className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
                style={{ fontFamily: "'Space Mono'" }}
              >
                Raison
              </label>
              <DaInput
                id={`${fid}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ex: don raid base ennemie"
                className="w-full mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            <DaButton variant="success" disabled={busy} onClick={() => run("add")}>
              {busy ? "..." : "+ Ajouter"}
            </DaButton>
            <DaButton variant="danger" disabled={busy} onClick={() => run("remove")}>
              {busy ? "..." : "− Retirer"}
            </DaButton>
            <DaButton variant="ghost" disabled={busy} onClick={() => run("set")}>
              {busy ? "..." : "= Définir"}
            </DaButton>
          </div>
        </div>
      </PageCard>

      <PageCard>
        <SectionLabel>historique du membre</SectionLabel>
        {!target && <EmptyBlock label="Sélectionne un membre" />}
        {target && history.data?.history && history.data.history.length === 0 && (
          <EmptyBlock label="Aucun mouvement" />
        )}
        {history.data?.history && history.data.history.length > 0 && (
          <ul className="divide-y divide-zinc-800">
            {history.data.history.map((e: any) => (
              <li key={e.id} className="py-2 flex justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div
                    className="text-[11px] uppercase tracking-[0.2em] text-zinc-400"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {new Date(e.created_at).toLocaleString("fr-FR")} · {e.staff_username ?? "—"}
                  </div>
                  <div className="text-zinc-200 truncate">
                    <span className="font-mono text-pink-400 mr-2">{e.action_type}</span>
                    {e.reason ?? ""}
                  </div>
                </div>
                <div
                  className={`font-bold whitespace-nowrap ${
                    e.amount >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {e.amount >= 0 ? "+" : ""}
                  {e.amount}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}
