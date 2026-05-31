import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  DaButton,
  DaInput,
  DaChip,
  SectionLabel,
} from "@/components/tools/ToolsUi";
import {
  listGradeThresholds,
  upsertThreshold,
  deleteThreshold,
  computeGradeSuggestions,
  confirmRankup,
  listBadges,
  upsertBadge,
  deleteBadge,
  awardBadge,
  revokeBadge,
  runAutoBadges,
} from "@/lib/data/grades.functions";

export const Route = createFileRoute("/_authenticated/staff/grades")({
  head: () => ({ meta: [{ title: "Grades & badges · Staff" }] }),
  component: Page,
});

type Threshold = {
  id: string;
  grade_label: string;
  display_order: number;
  min_points: number;
  min_days_in_faction: number;
  min_messages_7d: number;
  min_voice_7d_seconds: number;
  min_days_since_rankup: number;
  active: boolean;
};

type Badge = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  auto_rule: { metric: string; gte: number } | null;
};

function Page() {
  const [tab, setTab] = useState<"suggestions" | "thresholds" | "badges">("suggestions");
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <ToolHeader
        code="// staff.grades"
        title="Grades & badges"
        description="Suggestions de rang-up automatiques, seuils par grade et catalogue de badges."
      />
      <div className="flex gap-2 mb-4">
        {(["suggestions", "thresholds", "badges"] as const).map((t) => (
          <DaButton key={t} variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)}>
            {t === "suggestions" ? "Suggestions" : t === "thresholds" ? "Seuils" : "Badges"}
          </DaButton>
        ))}
      </div>
      {tab === "suggestions" && <SuggestionsTab />}
      {tab === "thresholds" && <ThresholdsTab />}
      {tab === "badges" && <BadgesTab />}
    </div>
  );
}

// ---------------- Suggestions ----------------
function SuggestionsTab() {
  const fn = useServerFn(computeGradeSuggestions);
  const confirm = useServerFn(confirmRankup);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["grade-suggestions"], queryFn: () => fn() });
  const mut = useMutation({
    mutationFn: (v: { memberDiscordId: string; gradeLabel: string }) => confirm({ data: v }),
    onSuccess: (r) => {
      toast.success("Rang-up confirmé", { description: r.reminder });
      qc.invalidateQueries({ queryKey: ["grade-suggestions"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock message={(q.error as Error).message} />;
  const list = q.data?.suggestions ?? [];
  if (list.length === 0) return <EmptyBlock label="Aucune suggestion en attente" />;
  return (
    <ToolCard>
      <SectionLabel>suggestions de rang-up</SectionLabel>
      <div className="space-y-2">
        {list.map((s) => (
          <div
            key={s.discord_id}
            className="border border-zinc-800 bg-zinc-950/60 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="text-white text-sm font-bold">{s.name}</div>
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <DaChip accent="zinc">{s.current_grade ?? "—"}</DaChip>
                <span>→</span>
                <DaChip accent="pink">{s.suggested_grade}</DaChip>
              </div>
              <div className="text-xs text-zinc-500">{s.reasons.join(" · ")}</div>
            </div>
            <DaButton
              onClick={() =>
                mut.mutate({ memberDiscordId: s.discord_id, gradeLabel: s.suggested_grade })
              }
              disabled={mut.isPending}
            >
              Confirmer
            </DaButton>
          </div>
        ))}
      </div>
    </ToolCard>
  );
}

// ---------------- Thresholds ----------------
const emptyThreshold = (): Partial<Threshold> => ({
  grade_label: "",
  display_order: 0,
  min_points: 0,
  min_days_in_faction: 0,
  min_messages_7d: 0,
  min_voice_7d_seconds: 0,
  min_days_since_rankup: 0,
  active: true,
});

function ThresholdsTab() {
  const fn = useServerFn(listGradeThresholds);
  const up = useServerFn(upsertThreshold);
  const del = useServerFn(deleteThreshold);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["grade-thresholds"], queryFn: () => fn() });
  const [editing, setEditing] = useState<Partial<Threshold> | null>(null);
  const mUp = useMutation({
    mutationFn: (v: Partial<Threshold>) =>
      up({
        data: {
          id: v.id,
          grade_label: v.grade_label!,
          display_order: Number(v.display_order ?? 0),
          min_points: Number(v.min_points ?? 0),
          min_days_in_faction: Number(v.min_days_in_faction ?? 0),
          min_messages_7d: Number(v.min_messages_7d ?? 0),
          min_voice_7d_seconds: Number(v.min_voice_7d_seconds ?? 0),
          min_days_since_rankup: Number(v.min_days_since_rankup ?? 0),
          active: v.active ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Seuil sauvegardé");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["grade-thresholds"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grade-thresholds"] }),
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock message={(q.error as Error).message} />;
  const list = (q.data?.thresholds ?? []) as Threshold[];

  return (
    <div className="space-y-4">
      <ToolCard>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>seuils par grade</SectionLabel>
          <DaButton onClick={() => setEditing(emptyThreshold())}>+ Nouveau</DaButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-300">
            <thead className="text-zinc-500 uppercase tracking-[0.2em]">
              <tr>
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Grade</th>
                <th className="text-right py-2">Pts</th>
                <th className="text-right py-2">Jrs fac.</th>
                <th className="text-right py-2">Msg/7j</th>
                <th className="text-right py-2">Voc/7j (s)</th>
                <th className="text-right py-2">Jrs s/up</th>
                <th className="text-center py-2">Actif</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800">
                  <td className="py-2">{t.display_order}</td>
                  <td className="py-2 text-white font-bold">{t.grade_label}</td>
                  <td className="py-2 text-right">{t.min_points}</td>
                  <td className="py-2 text-right">{t.min_days_in_faction}</td>
                  <td className="py-2 text-right">{t.min_messages_7d}</td>
                  <td className="py-2 text-right">{t.min_voice_7d_seconds}</td>
                  <td className="py-2 text-right">{t.min_days_since_rankup}</td>
                  <td className="py-2 text-center">{t.active ? "✓" : "—"}</td>
                  <td className="py-2 text-right space-x-2">
                    <DaButton variant="ghost" onClick={() => setEditing(t)}>
                      Éditer
                    </DaButton>
                    <DaButton variant="danger" onClick={() => mDel.mutate(t.id)}>
                      Suppr.
                    </DaButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ToolCard>

      {editing && (
        <ToolCard>
          <SectionLabel>{editing.id ? "éditer le seuil" : "nouveau seuil"}</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Grade">
              <DaInput
                value={editing.grade_label ?? ""}
                onChange={(e) => setEditing({ ...editing, grade_label: e.target.value })}
              />
            </Field>
            <NumField label="Ordre" value={editing.display_order} onChange={(v) => setEditing({ ...editing, display_order: v })} />
            <NumField label="Min points" value={editing.min_points} onChange={(v) => setEditing({ ...editing, min_points: v })} />
            <NumField label="Min jours faction" value={editing.min_days_in_faction} onChange={(v) => setEditing({ ...editing, min_days_in_faction: v })} />
            <NumField label="Min msg/7j" value={editing.min_messages_7d} onChange={(v) => setEditing({ ...editing, min_messages_7d: v })} />
            <NumField label="Min voc/7j (s)" value={editing.min_voice_7d_seconds} onChange={(v) => setEditing({ ...editing, min_voice_7d_seconds: v })} />
            <NumField label="Min jrs depuis up" value={editing.min_days_since_rankup} onChange={(v) => setEditing({ ...editing, min_days_since_rankup: v })} />
            <Field label="Actif">
              <select
                value={String(editing.active ?? true)}
                onChange={(e) => setEditing({ ...editing, active: e.target.value === "true" })}
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
              >
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <DaButton onClick={() => mUp.mutate(editing)} disabled={mUp.isPending}>
              Enregistrer
            </DaButton>
            <DaButton variant="ghost" onClick={() => setEditing(null)}>
              Annuler
            </DaButton>
          </div>
        </ToolCard>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">{label}</label>
      {children}
    </div>
  );
}
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <DaInput
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

// ---------------- Badges ----------------
function BadgesTab() {
  const lb = useServerFn(listBadges);
  const up = useServerFn(upsertBadge);
  const del = useServerFn(deleteBadge);
  const award = useServerFn(awardBadge);
  const revoke = useServerFn(revokeBadge);
  const runAuto = useServerFn(runAutoBadges);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["badges"], queryFn: () => lb() });

  const [editing, setEditing] = useState<Partial<Badge> | null>(null);
  const [awardForm, setAwardForm] = useState<{ badgeId: string; memberDiscordId: string } | null>(
    null,
  );

  const mUp = useMutation({
    mutationFn: (v: Partial<Badge>) =>
      up({
        data: {
          id: v.id,
          code: v.code!,
          name: v.name!,
          description: v.description ?? null,
          icon: v.icon ?? null,
          color: v.color ?? null,
          auto_rule: v.auto_rule ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Badge sauvegardé");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badges"] }),
  });
  const mAward = useMutation({
    mutationFn: (v: { badgeId: string; memberDiscordId: string }) => award({ data: v }),
    onSuccess: () => {
      toast.success("Badge attribué");
      setAwardForm(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const mRevoke = useMutation({
    mutationFn: (v: { badgeId: string; memberDiscordId: string }) => revoke({ data: v }),
    onSuccess: () => toast.success("Badge retiré"),
    onError: (e) => toast.error((e as Error).message),
  });
  const mRun = useMutation({
    mutationFn: () => runAuto({}),
    onSuccess: (r) => toast.success(`Auto-badges: ${r.awarded} attribution(s)`),
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock message={(q.error as Error).message} />;
  const list = (q.data?.badges ?? []) as Badge[];

  return (
    <div className="space-y-4">
      <ToolCard>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>catalogue de badges</SectionLabel>
          <div className="flex gap-2">
            <DaButton variant="ghost" onClick={() => mRun.mutate()} disabled={mRun.isPending}>
              Lancer auto-badges
            </DaButton>
            <DaButton onClick={() => setEditing({ icon: "🏅", color: "#ec4899" })}>+ Badge</DaButton>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyBlock label="Aucun badge" />
        ) : (
          <div className="space-y-2">
            {list.map((b) => (
              <div
                key={b.id}
                className="border border-zinc-800 bg-zinc-950/60 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{b.icon ?? "🏅"}</span>
                  <div>
                    <div className="text-white font-bold text-sm">{b.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{b.code}</div>
                    {b.description && (
                      <div className="text-xs text-zinc-400 mt-1">{b.description}</div>
                    )}
                    {b.auto_rule && (
                      <DaChip accent="blurple">
                        auto: {b.auto_rule.metric} ≥ {b.auto_rule.gte}
                      </DaChip>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <DaButton
                    variant="ghost"
                    onClick={() => setAwardForm({ badgeId: b.id, memberDiscordId: "" })}
                  >
                    Attribuer
                  </DaButton>
                  <DaButton variant="ghost" onClick={() => setEditing(b)}>
                    Éditer
                  </DaButton>
                  <DaButton variant="danger" onClick={() => mDel.mutate(b.id)}>
                    Suppr.
                  </DaButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </ToolCard>

      {editing && (
        <ToolCard>
          <SectionLabel>{editing.id ? "éditer badge" : "nouveau badge"}</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Code (a-z_)">
              <DaInput value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
            </Field>
            <Field label="Nom">
              <DaInput value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Icône (emoji)">
              <DaInput value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
            </Field>
            <Field label="Couleur (hex)">
              <DaInput value={editing.color ?? ""} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
            </Field>
            <Field label="Description">
              <DaInput value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <Field label="Auto: métrique">
              <select
                value={editing.auto_rule?.metric ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    auto_rule: e.target.value
                      ? { metric: e.target.value, gte: editing.auto_rule?.gte ?? 0 }
                      : null,
                  })
                }
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
              >
                <option value="">— (manuel)</option>
                <option value="astik_points">astik_points</option>
                <option value="messages_total">messages_total</option>
                <option value="messages_7d">messages_7d</option>
                <option value="voice_total_seconds">voice_total_seconds</option>
                <option value="voice_7d_seconds">voice_7d_seconds</option>
                <option value="days_in_faction">days_in_faction</option>
              </select>
            </Field>
            {editing.auto_rule && (
              <NumField
                label="Auto: seuil ≥"
                value={editing.auto_rule.gte}
                onChange={(v) =>
                  setEditing({
                    ...editing,
                    auto_rule: { metric: editing.auto_rule!.metric, gte: v },
                  })
                }
              />
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <DaButton onClick={() => mUp.mutate(editing)} disabled={mUp.isPending}>
              Enregistrer
            </DaButton>
            <DaButton variant="ghost" onClick={() => setEditing(null)}>
              Annuler
            </DaButton>
          </div>
        </ToolCard>
      )}

      {awardForm && (
        <ToolCard>
          <SectionLabel>attribuer / retirer</SectionLabel>
          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <Field label="Discord ID du membre">
              <DaInput
                value={awardForm.memberDiscordId}
                onChange={(e) => setAwardForm({ ...awardForm, memberDiscordId: e.target.value })}
                placeholder="123456789012345678"
              />
            </Field>
            <DaButton
              onClick={() => mAward.mutate(awardForm)}
              disabled={!awardForm.memberDiscordId || mAward.isPending}
            >
              Attribuer
            </DaButton>
            <DaButton
              variant="danger"
              onClick={() => mRevoke.mutate(awardForm)}
              disabled={!awardForm.memberDiscordId || mRevoke.isPending}
            >
              Retirer
            </DaButton>
            <DaButton variant="ghost" onClick={() => setAwardForm(null)}>
              Fermer
            </DaButton>
          </div>
        </ToolCard>
      )}
    </div>
  );
}
