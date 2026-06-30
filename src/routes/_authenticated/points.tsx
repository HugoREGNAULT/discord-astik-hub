import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";
import { getPointsTimeline, getComparisonTimelines } from "@/lib/data/points-timeline.functions";
import { SinglePointsChart, ComparisonPointsChart } from "@/components/points/PointsChart";

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
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="reasons">Motifs</TabsTrigger>
          {canDonations && <TabsTrigger value="donations">Dons</TabsTrigger>}
        </TabsList>
        <TabsContent value="manual" className="mt-4">
          <ManualPanel target={target} setTarget={setTarget} />
        </TabsContent>
        <TabsContent value="pillars" className="mt-4">
          <PillarsPanel target={target} setTarget={setTarget} />
        </TabsContent>
        <TabsContent value="evolution" className="mt-4">
          <EvolutionPanel target={target} setTarget={setTarget} />
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
    queryKey: ["members", "", "active", "no-staff"],
    queryFn: () => listFn({ data: { excludeStaff: true } }),
  });

  const [multiMode, setMultiMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

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
      setPillar("");
      setReason("");
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
    enabled: !multiMode && !!target,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history", target] });
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["pillar-summary", target] });
  };

  // ── Mode mono ──
  const runSingle = async (action: "add" | "remove" | "set") => {
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

  // ── Mode multi ──
  const runMulti = async (action: "add" | "remove") => {
    if (selectedMembers.length === 0) {
      toast.error("Sélectionne au moins un membre.");
      return;
    }
    if (amount <= 0) {
      toast.error("Montant > 0 requis.");
      return;
    }
    if (!pillar) {
      toast.error("Sélectionne un pilier.");
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const memberId of selectedMembers) {
      try {
        if (action === "add")
          await addFn({
            data: { memberDiscordId: memberId, amount, reason, pillar: pillar as PointPillar },
          });
        else
          await rmFn({
            data: { memberDiscordId: memberId, amount, reason, pillar: pillar as PointPillar },
          });
        ok++;
      } catch {
        fail++;
      }
    }
    const sign = action === "add" ? "+" : "−";
    const recap = reason ? ` (${reason})` : "";
    if (fail === 0) {
      toast.success(`${ok} membre${ok > 1 ? "s" : ""} — ${sign}${amount} pts${recap}`);
    } else {
      toast.warning(`${ok}/${ok + fail} réussis, ${fail} échoué(s)`);
    }
    setSelectedMembers([]);
    setAmount(0);
    setReason("");
    setReasonId("");
    refresh();
    setBusy(false);
  };

  const allMembersList = members.data?.members ?? [];
  const filteredForMulti = memberSearch.trim()
    ? allMembersList.filter((m) =>
        (m.ig_name ?? m.discord_username ?? "").toLowerCase().includes(memberSearch.toLowerCase()),
      )
    : allMembersList;

  const toggleMember = (id: string) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="space-y-5">
      <PageCard>
        {/* Toggle mono / multi */}
        <div className="flex items-center gap-2 mb-4">
          <DaButton
            variant={!multiMode ? "primary" : "ghost"}
            onClick={() => {
              setMultiMode(false);
              setSelectedMembers([]);
            }}
            className="text-[11px]"
          >
            Mono
          </DaButton>
          <DaButton
            variant={multiMode ? "primary" : "ghost"}
            onClick={() => {
              setMultiMode(true);
              setTarget("");
            }}
            className="text-[11px]"
          >
            Multi-membres
          </DaButton>
        </div>

        <SectionLabel>{multiMode ? "attribution multi-membres" : "action manuelle"}</SectionLabel>
        <div className="space-y-3">
          {/* ── Sélection membres ── */}
          {!multiMode ? (
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
                {allMembersList.map((m) => (
                  <option key={m.discord_id} value={m.discord_id}>
                    {m.ig_name ?? m.discord_username} ({m.astik_points} pts)
                  </option>
                ))}
              </DaSelect>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  Membres
                  {selectedMembers.length > 0 && (
                    <span className="ml-2 text-primary">
                      [{selectedMembers.length} sélectionné{selectedMembers.length > 1 ? "s" : ""}]
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] text-primary underline"
                    style={{ fontFamily: "'Space Mono'" }}
                    onClick={() => setSelectedMembers(filteredForMulti.map((m) => m.discord_id))}
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground underline"
                    style={{ fontFamily: "'Space Mono'" }}
                    onClick={() => setSelectedMembers([])}
                  >
                    Effacer
                  </button>
                </div>
              </div>
              <DaInput
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Rechercher un membre…"
                className="w-full mb-2"
              />
              <div className="border-[3px] border-border max-h-48 overflow-y-auto divide-y divide-border">
                {filteredForMulti.length === 0 && (
                  <div
                    className="px-3 py-2 text-xs text-muted-foreground"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    Aucun résultat
                  </div>
                )}
                {filteredForMulti.map((m) => {
                  const checked = selectedMembers.includes(m.discord_id);
                  return (
                    <label
                      key={m.discord_id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                        checked ? "bg-primary/10" : "hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(m.discord_id)}
                        className="accent-primary"
                      />
                      <span className="text-sm flex-1" style={{ fontFamily: "'Space Grotesk'" }}>
                        {m.ig_name ?? m.discord_username}
                      </span>
                      <span
                        className="text-[10px] text-muted-foreground tabular-nums"
                        style={{ fontFamily: "'Space Mono'" }}
                      >
                        {m.astik_points} pts
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Motif ── */}
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

          {/* ── Pilier ── */}
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
              Requis pour Ajouter / Retirer.{!multiMode && " Ignoré pour Définir."}
            </p>
          </div>

          {/* ── Montant + Raison ── */}
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

          {/* ── Actions ── */}
          <div className="flex gap-2 flex-wrap pt-2">
            {!multiMode ? (
              <>
                <DaButton
                  variant="success"
                  disabled={busy || !pillar}
                  onClick={() => runSingle("add")}
                >
                  {busy ? "..." : "+ Ajouter"}
                </DaButton>
                <DaButton
                  variant="danger"
                  disabled={busy || !pillar}
                  onClick={() => runSingle("remove")}
                >
                  {busy ? "..." : "− Retirer"}
                </DaButton>
                <DaButton variant="ghost" disabled={busy} onClick={() => runSingle("set")}>
                  {busy ? "..." : "= Définir"}
                </DaButton>
              </>
            ) : (
              <>
                <DaButton
                  variant="success"
                  disabled={busy || !pillar || selectedMembers.length === 0}
                  onClick={() => runMulti("add")}
                >
                  {busy
                    ? "..."
                    : `+ Ajouter à ${selectedMembers.length || "?"} membre${selectedMembers.length > 1 ? "s" : ""}`}
                </DaButton>
                <DaButton
                  variant="danger"
                  disabled={busy || !pillar || selectedMembers.length === 0}
                  onClick={() => runMulti("remove")}
                >
                  {busy
                    ? "..."
                    : `− Retirer à ${selectedMembers.length || "?"} membre${selectedMembers.length > 1 ? "s" : ""}`}
                </DaButton>
              </>
            )}
          </div>
        </div>
      </PageCard>

      {!multiMode && (
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
      )}
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
    queryKey: ["members", "", "active", "no-staff"],
    queryFn: () => listFn({ data: { excludeStaff: true } }),
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

// ─── EvolutionPanel ──────────────────────────────────────────────────────────

function EvolutionPanel({ target, setTarget }: PanelProps) {
  const listFn = useServerFn(listMembers);
  const timelineFn = useServerFn(getPointsTimeline);
  const comparisonFn = useServerFn(getComparisonTimelines);
  const fid = useId();

  const [mode, setMode] = useState<"single" | "comparison">("single");
  const [selected, setSelected] = useState<string[]>([]);

  const members = useQuery({
    queryKey: ["members", "", "active", "no-staff"],
    queryFn: () => listFn({ data: { excludeStaff: true } }),
  });

  const timeline = useQuery({
    queryKey: ["points-timeline", target],
    queryFn: () => timelineFn({ data: { memberDiscordId: target } }),
    enabled: mode === "single" && !!target,
    staleTime: 60_000,
  });

  const comparison = useQuery({
    queryKey: ["points-comparison"],
    queryFn: () => comparisonFn({ data: undefined }),
    enabled: mode === "comparison",
    staleTime: 60_000,
  });

  const toggleMember = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAll = () => setSelected((comparison.data?.timelines ?? []).map((t) => t.discord_id));

  const PALETTE = [
    "#8b5cf6",
    "#a78bfa",
    "#c4b5fd",
    "#7c3aed",
    "#6d28d9",
    "#5b21b6",
    "#ddd6fe",
    "#ede9fe",
  ];

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>mode</SectionLabel>
        <div className="flex gap-2 mt-2">
          <DaButton
            variant={mode === "single" ? "primary" : "ghost"}
            onClick={() => setMode("single")}
          >
            Ma courbe
          </DaButton>
          <DaButton
            variant={mode === "comparison" ? "primary" : "ghost"}
            onClick={() => setMode("comparison")}
          >
            Comparaison
          </DaButton>
        </div>
      </PageCard>

      {mode === "single" && (
        <>
          <PageCard>
            <SectionLabel>membre</SectionLabel>
            <DaSelect
              id={`${fid}-evo-member`}
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
          </PageCard>

          <PageCard>
            <SectionLabel>évolution cumulative</SectionLabel>
            {!target ? (
              <EmptyBlock label="Sélectionne un membre" />
            ) : timeline.isLoading ? (
              <div className="h-40 animate-pulse bg-muted" />
            ) : (
              <SinglePointsChart
                timeline={timeline.data?.timeline ?? []}
                label={
                  members.data?.members.find((m) => m.discord_id === target)?.ig_name ?? "Points"
                }
              />
            )}
          </PageCard>
        </>
      )}

      {mode === "comparison" && (
        <>
          <PageCard>
            <SectionLabel>membres à comparer</SectionLabel>
            {comparison.isLoading ? (
              <div className="h-10 animate-pulse bg-muted" />
            ) : (
              <>
                <div className="flex gap-2 mb-3 mt-1">
                  <DaButton variant="ghost" onClick={selectAll} className="text-[10px] px-2 py-0.5">
                    Tout sélectionner
                  </DaButton>
                  <DaButton
                    variant="ghost"
                    onClick={() => setSelected([])}
                    className="text-[10px] px-2 py-0.5"
                  >
                    Tout désélectionner
                  </DaButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  {comparison.data?.timelines.map((t, i) => {
                    const isOn = selected.includes(t.discord_id);
                    return (
                      <button
                        key={t.discord_id}
                        onClick={() => toggleMember(t.discord_id)}
                        className={`px-2 py-1 text-[11px] border-[2px] transition-colors ${
                          isOn
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                        style={{
                          fontFamily: "'Space Mono'",
                          borderColor: isOn ? PALETTE[i % PALETTE.length] : undefined,
                          color: isOn ? PALETTE[i % PALETTE.length] : undefined,
                        }}
                      >
                        {t.ig_name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </PageCard>

          <PageCard>
            <SectionLabel>comparaison cumulative</SectionLabel>
            {comparison.isLoading ? (
              <div className="h-60 animate-pulse bg-muted" />
            ) : (
              <ComparisonPointsChart
                timelines={comparison.data?.timelines ?? []}
                selected={selected}
              />
            )}
          </PageCard>
        </>
      )}
    </div>
  );
}
