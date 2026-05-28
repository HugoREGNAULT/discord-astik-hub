import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";

import { listMembers } from "@/lib/data/members.functions";
import { addPoints, removePoints, setPoints, getPointsHistory } from "@/lib/data/points.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({ meta: [{ title: "AstikPoints · PunkAstik" }] }),
  component: () => (<Guard perm="points.manage"><PointsPage /></Guard>),
});

function PointsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMembers);
  const addFn = useServerFn(addPoints);
  const rmFn = useServerFn(removePoints);
  const setFn = useServerFn(setPoints);
  const histFn = useServerFn(getPointsHistory);
  const fid = useId();

  const members = useQuery({ queryKey: ["members", "", "active"], queryFn: () => listFn({ data: {} }) });

  const [target, setTarget] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");


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
    if (!target) { toast.error("Sélectionne un membre."); return; }
    if (action !== "set" && amount <= 0) { toast.error("Montant > 0 requis."); return; }
    if (action === "set" && amount < 0) { toast.error("Le solde ne peut pas être négatif."); return; }
    try {
      let res: { total: number };
      if (action === "add") res = await addFn({ data: { memberDiscordId: target, amount, reason } });
      else if (action === "remove") res = await rmFn({ data: { memberDiscordId: target, amount, reason } });
      else res = await setFn({ data: { memberDiscordId: target, total: amount, reason } });
      toast.success(`OK — nouveau solde : ${res.total} pts`);
      setAmount(0); setReason(""); refresh();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  };


  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">AstikPoints</h1>

      <Card>
        <CardHeader><CardTitle>Action manuelle</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor={`${fid}-member`} className="text-xs text-muted-foreground">Membre</label>
            <select id={`${fid}-member`} value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm">
              <option value="">— Choisir —</option>
              {members.data?.members.map((m) => (
                <option key={m.discord_id} value={m.discord_id}>{m.ig_name ?? m.discord_username} ({m.astik_points} pts)</option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fid}-amount`} className="text-xs text-muted-foreground">Montant</label>
              <Input id={`${fid}-amount`} type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor={`${fid}-reason`} className="text-xs text-muted-foreground">Raison</label>
              <Input id={`${fid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: don raid base ennemie" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => run("add")} className="bg-success text-success-foreground hover:opacity-90">+ Ajouter</Button>
            <Button onClick={() => run("remove")} variant="destructive">− Retirer</Button>
            <Button onClick={() => run("set")} variant="secondary">= Définir</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique du membre</CardTitle></CardHeader>
        <CardContent>
          {!target && <p className="text-sm text-muted-foreground">Sélectionne un membre.</p>}
          {history.data?.history && (
            <ul className="divide-y divide-border">
              {history.data.history.map((e: any) => (
                <li key={e.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()} · {e.staff_username ?? "—"}</div>
                    <div>{e.action_type} · {e.reason ?? ""}</div>
                  </div>
                  <div className={`font-bold ${e.amount >= 0 ? "text-success" : "text-destructive"}`}>
                    {e.amount >= 0 ? "+" : ""}{e.amount}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
