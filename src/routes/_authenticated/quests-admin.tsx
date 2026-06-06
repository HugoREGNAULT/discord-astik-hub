import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import {
  listQuestTemplates,
  upsertQuestTemplate,
  deleteQuestTemplate,
} from "@/lib/data/quests.functions";
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

export const Route = createFileRoute("/_authenticated/quests-admin")({
  head: () => ({ meta: [{ title: "Quêtes hebdo · PunkAstik" }] }),
  component: () => (
    <Guard perm="quests.manage">
      <QuestsAdminPage />
    </Guard>
  ),
});

const QUEST_TYPE_LABELS: Record<string, string> = {
  messages: "Messages (7j)",
  voice_hours: "Heures vocal (7j)",
  donation_points: "AP donnés (semaine)",
  points_earned: "AP gagnés (semaine)",
};

interface FormState {
  id?: string;
  title: string;
  description: string;
  quest_type: string;
  target_value: string;
  reward_points: string;
  active: boolean;
  display_order: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  quest_type: "messages",
  target_value: "100",
  reward_points: "50",
  active: true,
  display_order: "0",
};

function QuestsAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listQuestTemplates);
  const upsertFn = useServerFn(upsertQuestTemplate);
  const deleteFn = useServerFn(deleteQuestTemplate);

  const { data } = useQuery({
    queryKey: ["quests", "templates"],
    queryFn: () => listFn(),
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quests", "templates"] });

  const upsertMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: form.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          quest_type: form.quest_type as
            | "messages"
            | "voice_hours"
            | "donation_points"
            | "points_earned",
          target_value: Number(form.target_value),
          reward_points: Number(form.reward_points),
          active: form.active,
          display_order: Number(form.display_order),
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Quête mise à jour" : "Quête créée");
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Quête supprimée");
      invalidate();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const onSubmit = () => {
    if (form.title.trim().length < 1) {
      toast.error("Titre requis");
      return;
    }
    if (!Number(form.target_value) || Number(form.target_value) < 1) {
      toast.error("Objectif invalide");
      return;
    }
    upsertMut.mutate();
  };

  const templates = data?.templates ?? [];

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        code="// quests.manage"
        title="Quêtes hebdomadaires"
        description="Définis les quêtes proposées chaque semaine aux membres. La progression et les récompenses sont automatiques."
      />

      <PageCard>
        <SectionLabel>{form.id ? "Modifier la quête" : "Nouvelle quête"}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-zinc-400">Titre</span>
            <DaInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ex: Bavard de la semaine"
              maxLength={120}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-zinc-400">Description (optionnel)</span>
            <DaInput
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="ex: Envoie 500 messages sur le Discord"
              maxLength={500}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Type</span>
            <DaSelect
              value={form.quest_type}
              onChange={(e) => setForm((f) => ({ ...f, quest_type: e.target.value }))}
            >
              {Object.entries(QUEST_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </DaSelect>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Objectif (valeur à atteindre)</span>
            <DaInput
              type="number"
              min={1}
              value={form.target_value}
              onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Récompense (AstikPoints)</span>
            <DaInput
              type="number"
              min={0}
              value={form.reward_points}
              onChange={(e) => setForm((f) => ({ ...f, reward_points: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Ordre d'affichage</span>
            <DaInput
              type="number"
              min={0}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="text-sm text-zinc-300">Active</span>
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          <DaButton onClick={onSubmit} disabled={upsertMut.isPending}>
            {upsertMut.isPending ? "Enregistrement…" : form.id ? "Mettre à jour" : "Créer"}
          </DaButton>
          {form.id && (
            <DaButton variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
              Annuler
            </DaButton>
          )}
        </div>
      </PageCard>

      <PageCard>
        <SectionLabel>Quêtes existantes</SectionLabel>
        {templates.length === 0 ? (
          <EmptyBlock label="Aucune quête définie" />
        ) : (
          <ul className="divide-y divide-zinc-800">
            {templates.map((t) => (
              <li key={t.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{t.title}</span>
                    {!t.active && (
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                        inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {QUEST_TYPE_LABELS[t.quest_type] ?? t.quest_type} · objectif {t.target_value} ·
                    +{t.reward_points} AP
                  </div>
                </div>
                <DaButton
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      id: t.id,
                      title: t.title,
                      description: t.description ?? "",
                      quest_type: t.quest_type,
                      target_value: String(t.target_value),
                      reward_points: String(t.reward_points),
                      active: t.active,
                      display_order: String(t.display_order),
                    })
                  }
                >
                  Éditer
                </DaButton>
                <DaButton
                  variant="danger"
                  onClick={() => deleteMut.mutate(t.id)}
                  disabled={deleteMut.isPending}
                >
                  Suppr.
                </DaButton>
              </li>
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}
