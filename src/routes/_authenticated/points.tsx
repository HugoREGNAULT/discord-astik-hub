import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";

import { listMembers } from "@/lib/data/members.functions";
import {
  addPoints,
  removePoints,
  setPoints,
  getPointsHistory,
  getPointsPillarSummary,
  reversePointsTransaction,
} from "@/lib/data/points.functions";
import { PILLAR_OPTIONS, type PointPillar } from "@/lib/data/points-pillars";
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
import {
  getPointReasons,
  createPointReason,
  togglePointReason,
} from "@/lib/data/point-reasons.functions";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({ meta: [{ title: "Gestion Points · PunkAstik" }] }),
  component: () => (
    <Guard perm="points.manage">
      <PointsPage />
    </Guard>
  ),
});

// Labels des piliers pour l'affichage
const PILLAR_LABEL: Record<string, string> = {
  discord_activity: "Activité Discord",
  ig_investment: "Investissement IG",
  global_investment: "Investissement Global",
};

function PointsPage() {
  const { data: me } = useCurrentUser();
  const canDonations = hasPerm(me, "donations.manage");
  // État membre partagé entre les deux onglets points
  const [target, setTarget] = useState<string>("");

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
          <TabsTrigger value="pillars">Par pilier</TabsTrigger>
          <TabsTrigger value="reasons">Motifs</TabsTrigger>
          {canDonations && <TabsTrigger value="donations">Dons</TabsTrigger>}
        </TabsList>
        <TabsContent value="manual" className="mt-4">
          <ManualPanel target={target} setTarget={setTarget} />
        </TabsContent>
        <TabsContent value="pillars" className="mt-4">
          <PillarsPanel target={target} setTarget={setTarget} />
        </TabsContent>
        <TabsContent value="reasons" className="mt-4">
          <ReasonsPanel />
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

// ─── ManualPanel ────────────────────────────────────────────────────────────

interface PanelProps {
  target: string;
  setTarget: (v: string) => void;
}

function ManualPanel({ target, setTarget }: PanelProps) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMembers);
  const addFn = useServerFn(addPoints);
  const rmFn = useServerFn(removePoints);
  const setFn = useServerFn(setPoints);
  const histFn = useServerFn(getPointsHistory);
  const reasonsFn = useServerFn(getPointReasons);
  const fid = useId();

  const members = useQuery({
    queryKey: ["members", "", "active"],
    queryFn: () => listFn({ data: {} }),
  });

  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [pillar, setPillar] = useState<PointPillar | "">("");
  const [busy, setBusy] = useState(false);
  const [reasonId, setReasonId] = useState<string>("");

  const pointReasons = useQuery({
    queryKey: ["point-reasons"],
    queryFn: () => reasonsFn({ data: undefined }),
  });

  const activeReasons = pointReasons.data?.reasons.filter((r) => r.active) ?? [];

  const handleReasonChange = (val: string) => {
    setReasonId(val);
    if (val === "" || val === "__libre") {
      if (val === "__libre") {
        setPillar("");
        setReason("");
      }
      return;
    }
    const found = activeReasons.find((r) => r.id === val);
    if (found) {
      setPillar(found.pillar as PointPillar);
      setReason(found.label);
    }
  };

  const history = useQuery({
    queryKey: ["history", target],
    queryFn: () => histFn({ data: { memberDiscordId: target, limit: 25 } }),
    enabled: !!target,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history", target] });
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["pillar-summary", target] });
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
    if ((action === "add" || action === "remove") && !pillar) {
      toast.error("Sélectionne un pilier.");
      return;
    }
    setBusy(true);
    try {
      let res: { total: number };
      if (action === "add")
        res = await addFn({
          data: { memberDiscordId: target, amount, reason, pillar: pillar as PointPillar },
        });
      else if (action === "remove")
        res = await rmFn({
          data: { memberDiscordId: target, amount, reason, pillar: pillar as PointPillar },
        });
      else res = await setFn({ data: { memberDiscordId: target, total: amount, reason } });
      toast.success(`OK — nouveau solde : ${res.total} pts`);
      setAmount(0);
      setReason("");
      setReasonId("");
      refresh();
    } catch (e: unknown) {
      toast.error(toUserMessage(e as Error));
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
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
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

          <div>
            <label
              htmlFor={`${fid}-reason-id`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Motif
            </label>
            <DaSelect
              id={`${fid}-reason-id`}
              value={reasonId}
              onChange={(e) => handleReasonChange(e.target.value)}
              className="w-full mt-1"
            >
              <option value="">— Choisir un motif —</option>
              {activeReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
              <option value="__libre">Saisie libre (sans motif)</option>
            </DaSelect>
          </div>

          <div>
            <label
              htmlFor={`${fid}-pillar`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Pilier <span className="text-primary">*</span>
            </label>
            <DaSelect
              id={`${fid}-pillar`}
              value={pillar}
              onChange={(e) => setPillar(e.target.value as PointPillar | "")}
              disabled={!!reasonId && reasonId !== "__libre"}
              className="w-full mt-1"
            >
              <option value="">— Choisir un pilier —</option>
              {PILLAR_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </DaSelect>
            <p
              className="text-[10px] text-muted-foreground mt-1"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Requis pour Ajouter / Retirer. Ignoré pour Définir.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${fid}-amount`}
                className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
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
                className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
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
            <DaButton variant="success" disabled={busy || !pillar} onClick={() => run("add")}>
              {busy ? "..." : "+ Ajouter"}
            </DaButton>
            <DaButton variant="danger" disabled={busy || !pillar} onClick={() => run("remove")}>
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
          <ul className="divide-y divide-border">
            {history.data.history.map((e: any) => (
              <LedgerRow key={e.id} entry={e} onReversed={refresh} />
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}

// ─── PillarsPanel ────────────────────────────────────────────────────────────

function PillarsPanel({ target, setTarget }: PanelProps) {
  const listFn = useServerFn(listMembers);
  const summaryFn = useServerFn(getPointsPillarSummary);
  const histFn = useServerFn(getPointsHistory);
  const qc = useQueryClient();
  const fid = useId();

  const members = useQuery({
    queryKey: ["members", "", "active"],
    queryFn: () => listFn({ data: {} }),
  });

  const summary = useQuery({
    queryKey: ["pillar-summary", target],
    queryFn: () => summaryFn({ data: { memberDiscordId: target } }),
    enabled: !!target,
  });

  const history = useQuery({
    queryKey: ["history", target],
    queryFn: () => histFn({ data: { memberDiscordId: target, limit: 50 } }),
    enabled: !!target,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history", target] });
    qc.invalidateQueries({ queryKey: ["pillar-summary", target] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>membre</SectionLabel>
        <DaSelect
          id={`${fid}-p-member`}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full"
        >
          <option value="">— Choisir —</option>
          {members.data?.members.map((m) => (
            <option key={m.discord_id} value={m.discord_id}>
              {m.ig_name ?? m.discord_username} ({m.astik_points} pts)
            </option>
          ))}
        </DaSelect>
      </PageCard>

      {target && summary.data && (
        <PageCard>
          <SectionLabel>répartition par pilier</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {PILLAR_OPTIONS.map((p) => (
              <div key={p.value} className="border-[3px] border-border bg-secondary p-3 space-y-1">
                <div
                  className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {p.label}
                </div>
                <div
                  className="text-xl font-bold text-primary"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {summary.data.summary[p.value] ?? 0}
                </div>
              </div>
            ))}
            {(summary.data.summary.uncategorized ?? 0) !== 0 && (
              <div className="border-[3px] border-border bg-secondary p-3 space-y-1">
                <div
                  className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  Non catégorisé
                </div>
                <div
                  className="text-xl font-bold text-muted-foreground"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {summary.data.summary.uncategorized}
                </div>
              </div>
            )}
          </div>
        </PageCard>
      )}

      <PageCard>
        <SectionLabel>historique détaillé</SectionLabel>
        {!target && <EmptyBlock label="Sélectionne un membre" />}
        {target && history.data?.history && history.data.history.length === 0 && (
          <EmptyBlock label="Aucun mouvement" />
        )}
        {history.data?.history && history.data.history.length > 0 && (
          <ul className="divide-y divide-border">
            {history.data.history.map((e: any) => (
              <LedgerRow key={e.id} entry={e} onReversed={refresh} showPillar />
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}

// ─── ReasonsPanel ────────────────────────────────────────────────────────────

function ReasonsPanel() {
  const qc = useQueryClient();
  const reasonsFn = useServerFn(getPointReasons);
  const createFn = useServerFn(createPointReason);
  const toggleFn = useServerFn(togglePointReason);
  const fid = useId();

  const [newLabel, setNewLabel] = useState("");
  const [newPillar, setNewPillar] = useState<PointPillar | "">("");

  const reasons = useQuery({
    queryKey: ["point-reasons"],
    queryFn: () => reasonsFn({ data: undefined }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["point-reasons"] });

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({ data: { label: newLabel.trim(), pillar: newPillar as PointPillar } }),
    onSuccess: () => {
      toast.success("Motif créé");
      setNewLabel("");
      setNewPillar("");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Motif mis à jour");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>motifs existants</SectionLabel>
        {reasons.data?.reasons.length === 0 && <EmptyBlock label="Aucun motif" />}
        <ul className="divide-y divide-border">
          {reasons.data?.reasons.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`font-medium text-sm ${r.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {r.label}
                </span>
                <span
                  className="text-[9px] border border-primary/40 text-primary px-1 py-0.5 uppercase tracking-widest"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {PILLAR_LABEL[r.pillar] ?? r.pillar}
                </span>
                {!r.active && (
                  <span
                    className="text-[9px] border border-muted-foreground/30 text-muted-foreground px-1 py-0.5 uppercase tracking-widest"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    inactif
                  </span>
                )}
              </div>
              <DaButton
                variant="ghost"
                onClick={() => toggleMutation.mutate(r.id)}
                disabled={toggleMutation.isPending}
                className="text-[10px] px-2 py-0.5 whitespace-nowrap"
              >
                {r.active ? "Désactiver" : "Réactiver"}
              </DaButton>
            </li>
          ))}
        </ul>
      </PageCard>

      <PageCard>
        <SectionLabel>nouveau motif</SectionLabel>
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`${fid}-new-label`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Label
            </label>
            <DaInput
              id={`${fid}-new-label`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="ex: Don Raid"
              className="w-full mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`${fid}-new-pillar`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Pilier
            </label>
            <DaSelect
              id={`${fid}-new-pillar`}
              value={newPillar}
              onChange={(e) => setNewPillar(e.target.value as PointPillar | "")}
              className="w-full mt-1"
            >
              <option value="">— Choisir —</option>
              {PILLAR_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </DaSelect>
          </div>
          <DaButton
            variant="success"
            disabled={createMutation.isPending || !newLabel.trim() || !newPillar}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "..." : "+ Créer le motif"}
          </DaButton>
        </div>
      </PageCard>
    </div>
  );
}

// ─── LedgerRow (partagé) ─────────────────────────────────────────────────────

interface LedgerRowProps {
  entry: {
    id: string;
    created_at: string;
    staff_username: string | null;
    action_type: string;
    reason: string | null;
    amount: number;
    pillar: string | null;
  };
  onReversed: () => void;
  showPillar?: boolean;
}

function LedgerRow({ entry: e, onReversed, showPillar = false }: LedgerRowProps) {
  const reverseFn = useServerFn(reversePointsTransaction);
  const [open, setOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const isReversal = e.action_type === "reversal";
  const canReverse = !isReversal && e.action_type !== "set";

  const mutation = useMutation({
    mutationFn: () => reverseFn({ data: { ledgerId: e.id, reason: reverseReason } }),
    onSuccess: () => {
      toast.success("Transaction annulée");
      setOpen(false);
      setReverseReason("");
      onReversed();
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });

  return (
    <li className="py-2 space-y-1">
      <div className="flex justify-between text-sm gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {new Date(e.created_at).toLocaleString("fr-FR")} · {e.staff_username ?? "—"}
          </div>
          <div className="text-foreground flex items-center gap-2 flex-wrap">
            <span className="font-mono text-primary">{e.action_type}</span>
            {showPillar && e.pillar && (
              <span
                className="text-[9px] border border-primary/40 text-primary px-1 py-0.5 uppercase tracking-widest"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {PILLAR_LABEL[e.pillar] ?? e.pillar}
              </span>
            )}
            {isReversal && (
              <span
                className="text-[9px] border border-muted-foreground/40 text-muted-foreground px-1 py-0.5 uppercase tracking-widest"
                style={{ fontFamily: "'Space Mono'" }}
              >
                annulation
              </span>
            )}
            <span className="text-muted-foreground">{e.reason ?? ""}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span
            className={`font-bold whitespace-nowrap ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {e.amount >= 0 ? "+" : ""}
            {e.amount}
          </span>
          {canReverse && (
            <DaButton
              variant="ghost"
              onClick={() => setOpen((v) => !v)}
              className="text-[10px] px-2 py-0.5"
            >
              Annuler
            </DaButton>
          )}
        </div>
      </div>

      {open && (
        <div className="flex gap-2 items-center pl-2 pt-1">
          <DaInput
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="Raison de l'annulation…"
            className="flex-1 text-sm"
          />
          <DaButton
            variant="danger"
            disabled={mutation.isPending || !reverseReason.trim()}
            onClick={() => mutation.mutate()}
            className="text-[10px] px-2 py-0.5"
          >
            {mutation.isPending ? "..." : "Confirmer"}
          </DaButton>
          <DaButton
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-[10px] px-2 py-0.5"
          >
            ✕
          </DaButton>
        </div>
      )}
    </li>
  );
}
