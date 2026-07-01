import { createFileRoute, Link } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  getProject,
  listProjectMaterials,
  upsertProject,
  upsertMaterial,
  recordContribution,
  listProjectContributions,
  searchConfigValues,
  type Project,
  type ProjectMaterial,
} from "@/lib/data/projects.functions";
import { listMembers } from "@/lib/data/members.functions";
import {
  PageHeader,
  PageCard,
  SectionLabel,
  DaButton,
  DaInput,
  DaSelect,
  DaChip,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projets/$id")({
  head: () => ({ meta: [{ title: "Projet · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <ProjetDetailPage />
    </Guard>
  ),
});

// ── Barre de progression style XP violet ──────────────────────────────────────

function ProgressBar({ pct: p, className = "" }: { pct: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, p));
  return (
    <div className={`h-2 bg-secondary border border-border relative overflow-hidden ${className}`}>
      <div
        className="h-full bg-primary transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function calcPct(gathered: number, required: number) {
  if (required <= 0) return 0;
  return Math.round((gathered / required) * 100);
}

function globalPct(materials: ProjectMaterial[]) {
  const totalRequired = materials.reduce((s, m) => s + m.quantity_required, 0);
  const totalGathered = materials.reduce((s, m) => s + m.quantity_gathered, 0);
  return calcPct(totalGathered, totalRequired);
}

// ── Page principale ───────────────────────────────────────────────────────────

function ProjetDetailPage() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const isStaff = hasPerm(me, "points.manage");
  const qc = useQueryClient();

  const getProjectFn = useServerFn(getProject);
  const listMaterialsFn = useServerFn(listProjectMaterials);
  const listContribFn = useServerFn(listProjectContributions);

  const {
    data: projData,
    isLoading: projLoading,
    error: projErr,
  } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProjectFn({ data: { id } }),
  });

  const { data: matsData, isLoading: matsLoading } = useQuery({
    queryKey: ["project-materials", id],
    queryFn: () => listMaterialsFn({ data: { projectId: id } }),
  });

  const { data: contribData } = useQuery({
    queryKey: ["project-contributions", id],
    queryFn: () => listContribFn({ data: { projectId: id } }),
  });

  if (projLoading || matsLoading) return <LoadingBlock label="Chargement projet…" />;
  if (projErr) return <ErrorBlock message={toUserMessage(projErr)} />;

  const project = projData?.project;
  if (!project) return <ErrorBlock message="Projet introuvable" />;
  const materials = matsData?.materials ?? [];
  const top = contribData?.top ?? [];
  const gPct = globalPct(materials);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Retour */}
      <Link
        to="/projets"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="size-3" />
        Projets
      </Link>

      <PageHeader code="// projet" title={project.name} description={project.description ?? ""} />

      {/* Infos + progression globale */}
      <PageCard>
        <div className="flex flex-wrap gap-4 items-start justify-between mb-4">
          {project.dimensions && (
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              // dimensions : {project.dimensions}
            </span>
          )}
          <DaChip accent={project.status === "actif" ? "green" : "zinc"}>{project.status}</DaChip>
        </div>
        <SectionLabel>Progression globale</SectionLabel>
        <div className="flex items-center gap-3">
          <ProgressBar pct={gPct} className="flex-1" />
          <span
            className="text-primary font-bold text-sm shrink-0"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {gPct}%
          </span>
        </div>
      </PageCard>

      {/* Édition projet (staff) */}
      {isStaff && (
        <EditProjectForm
          project={project}
          onSaved={() => qc.invalidateQueries({ queryKey: ["project", id] })}
        />
      )}

      {/* Matériaux */}
      <PageCard>
        <SectionLabel>Matériaux</SectionLabel>
        {materials.length === 0 ? (
          <EmptyBlock label="Aucun matériau défini" />
        ) : (
          <div className="space-y-4">
            {materials.map((mat) => (
              <MaterialRow key={mat.id} material={mat} />
            ))}
          </div>
        )}
      </PageCard>

      {/* Ajouter matériau (staff) */}
      {isStaff && (
        <AddMaterialForm
          projectId={id}
          onSaved={() => qc.invalidateQueries({ queryKey: ["project-materials", id] })}
        />
      )}

      {/* Enregistrer un don (staff) */}
      {isStaff && materials.length > 0 && (
        <RecordContributionForm
          projectId={id}
          materials={materials}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["project-materials", id] });
            qc.invalidateQueries({ queryKey: ["project-contributions", id] });
          }}
        />
      )}

      {/* Top contributeurs */}
      {top.length > 0 && (
        <PageCard>
          <SectionLabel>Top contributeurs</SectionLabel>
          <div className="space-y-2">
            {top.map((c, i) => (
              <div key={c.discordId} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground text-xs">
                  #{i + 1} <span className="text-foreground">{c.discordId}</span>
                </span>
                <span className="font-bold text-primary font-mono text-xs">{c.pts} pts</span>
              </div>
            ))}
          </div>
        </PageCard>
      )}
    </div>
  );
}

// ── Ligne matériau ────────────────────────────────────────────────────────────

function MaterialRow({ material }: { material: ProjectMaterial }) {
  const p = calcPct(material.quantity_gathered, material.quantity_required);
  const done = material.quantity_gathered >= material.quantity_required;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {material.item_image_url && (
          <img
            src={material.item_image_url}
            alt={material.item_name}
            className="size-8 object-contain border border-border bg-secondary shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-xs font-bold uppercase tracking-wide text-foreground"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {material.item_name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {done && <DaChip accent="green">Complet</DaChip>}
              <span className="text-[10px] font-mono text-muted-foreground">
                {material.points_per_unit} pts/u
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ProgressBar pct={p} className="flex-1" />
            <span className="text-[10px] font-mono text-primary shrink-0">
              {material.quantity_gathered}/{material.quantity_required} ({p}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire édition projet ─────────────────────────────────────────────────

function EditProjectForm({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    dimensions: project.dimensions ?? "",
    status: project.status,
  });
  const upsertFn = useServerFn(upsertProject);

  const mut = useMutation({
    mutationFn: () => upsertFn({ data: { id: project.id, ...form, status: form.status } } as any),
    onSuccess: () => {
      toast.success("Projet mis à jour");
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <DaButton variant="ghost" onClick={() => setOpen(true)}>
          Éditer projet
        </DaButton>
      </div>
    );
  }

  return (
    <PageCard>
      <SectionLabel>Éditer le projet</SectionLabel>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Nom
            </label>
            <DaInput
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Dimensions
            </label>
            <DaInput
              value={form.dimensions}
              onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
              placeholder="64x64x32"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            Description
          </label>
          <DaInput
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            Statut
          </label>
          <DaSelect
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as Project["status"] }))
            }
          >
            <option value="actif">Actif</option>
            <option value="terminé">Terminé</option>
            <option value="archivé">Archivé</option>
          </DaSelect>
        </div>
        <div className="flex gap-2 pt-1">
          <DaButton type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Enregistrement…" : "Enregistrer"}
          </DaButton>
          <DaButton variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </DaButton>
        </div>
      </form>
    </PageCard>
  );
}

// ── Formulaire ajout matériau ─────────────────────────────────────────────────

function AddMaterialForm({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    item_image_url: "",
    unit_type: "item" as "item" | "liquide" | "divers",
    quantity_required: "",
    points_per_unit: "",
    display_order: "0",
  });
  const [suggestion, setSuggestion] = useState<{
    name: string;
    points: number;
    image_url: string | null;
  } | null>(null);

  const upsertFn = useServerFn(upsertMaterial);
  const searchFn = useServerFn(searchConfigValues);

  const searchQuery = useQuery({
    queryKey: ["config-values-search", form.item_name],
    queryFn: () => searchFn({ data: { q: form.item_name } }),
    enabled: form.item_name.length >= 2,
  });

  useEffect(() => {
    const values = searchQuery.data?.values ?? [];
    const exact = values.find((v) => v.name.toLowerCase() === form.item_name.toLowerCase());
    setSuggestion(exact ?? null);
  }, [searchQuery.data, form.item_name]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setForm((f) => ({
      ...f,
      points_per_unit: String(suggestion.points),
      item_image_url: suggestion.image_url ?? f.item_image_url,
    }));
  };

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          project_id: projectId,
          item_name: form.item_name,
          item_image_url: form.item_image_url || null,
          unit_type: form.unit_type,
          quantity_required: parseFloat(form.quantity_required),
          points_per_unit: parseFloat(form.points_per_unit),
          display_order: parseInt(form.display_order, 10) || 0,
        },
      } as any),
    onSuccess: () => {
      toast.success("Matériau ajouté");
      setForm({
        item_name: "",
        item_image_url: "",
        unit_type: "item",
        quantity_required: "",
        points_per_unit: "",
        display_order: "0",
      });
      setSuggestion(null);
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <DaButton variant="ghost" onClick={() => setOpen(true)}>
          + Ajouter matériau
        </DaButton>
      </div>
    );
  }

  return (
    <PageCard>
      <SectionLabel>Ajouter un matériau</SectionLabel>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Nom item
            </label>
            <DaInput
              value={form.item_name}
              onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
              placeholder="Stone Bricks"
              required
            />
            {suggestion && (
              <button
                type="button"
                onClick={applySuggestion}
                className="text-[10px] font-mono text-primary hover:underline text-left"
              >
                // Pré-remplir depuis config : {suggestion.points} pts/u
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Type
            </label>
            <DaSelect
              value={form.unit_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  unit_type: e.target.value as "item" | "liquide" | "divers",
                }))
              }
            >
              <option value="item">Item</option>
              <option value="liquide">Liquide</option>
              <option value="divers">Divers</option>
            </DaSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Quantité requise
            </label>
            <DaInput
              type="number"
              min="1"
              value={form.quantity_required}
              onChange={(e) => setForm((f) => ({ ...f, quantity_required: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Points / unité
            </label>
            <DaInput
              type="number"
              min="0.01"
              step="0.01"
              value={form.points_per_unit}
              onChange={(e) => setForm((f) => ({ ...f, points_per_unit: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            Image URL (optionnel)
          </label>
          <DaInput
            value={form.item_image_url}
            onChange={(e) => setForm((f) => ({ ...f, item_image_url: e.target.value }))}
            placeholder="https://…"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <DaButton
            type="submit"
            disabled={
              mut.isPending || !form.item_name || !form.quantity_required || !form.points_per_unit
            }
          >
            {mut.isPending ? "Ajout…" : "Ajouter"}
          </DaButton>
          <DaButton variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </DaButton>
        </div>
      </form>
    </PageCard>
  );
}

// ── Formulaire enregistrer un don ─────────────────────────────────────────────

function RecordContributionForm({
  projectId,
  materials,
  onSaved,
}: {
  projectId: string;
  materials: ProjectMaterial[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    materialId: materials[0]?.id ?? "",
    memberDiscordId: "",
    quantity: "",
  });

  const listMembersFn = useServerFn(listMembers);
  const recordFn = useServerFn(recordContribution);

  const { data: membersData } = useQuery({
    queryKey: ["members-no-staff"],
    queryFn: () => listMembersFn({ data: { excludeStaff: true, status: "active" } }),
    enabled: open,
  });
  const members = membersData?.members ?? [];

  const selectedMat = materials.find((m) => m.id === form.materialId);

  const mut = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          projectId,
          materialId: form.materialId,
          memberDiscordId: form.memberDiscordId,
          quantity: parseFloat(form.quantity),
        },
      } as any),
    onSuccess: (res: any) => {
      toast.success(`+${res.points} pts attribués — nouveau solde : ${res.newBalance}`);
      setForm((f) => ({ ...f, memberDiscordId: "", quantity: "" }));
      onSaved();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <DaButton onClick={() => setOpen(true)}>Enregistrer un don</DaButton>
      </div>
    );
  }

  const previewPts =
    selectedMat && form.quantity && !isNaN(parseFloat(form.quantity))
      ? Math.round(parseFloat(form.quantity) * selectedMat.points_per_unit)
      : null;

  return (
    <PageCard className="border-primary/40">
      <SectionLabel>Enregistrer un don</SectionLabel>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Matériau
            </label>
            <DaSelect
              value={form.materialId}
              onChange={(e) => setForm((f) => ({ ...f, materialId: e.target.value }))}
              required
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.item_name} ({m.points_per_unit} pts/u)
                </option>
              ))}
            </DaSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Quantité donnée
            </label>
            <DaInput
              type="number"
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            Membre donneur
          </label>
          <DaSelect
            value={form.memberDiscordId}
            onChange={(e) => setForm((f) => ({ ...f, memberDiscordId: e.target.value }))}
            required
          >
            <option value="">— Sélectionner un membre —</option>
            {members.map((m) => (
              <option key={m.discord_id} value={m.discord_id}>
                {m.ig_name ?? m.discord_username ?? m.discord_id}
              </option>
            ))}
          </DaSelect>
        </div>
        {previewPts !== null && (
          <div className="text-xs font-mono text-primary border border-primary/30 bg-primary/5 px-3 py-2">
            // {form.quantity} × {selectedMat?.points_per_unit} pts/u ={" "}
            <strong>{previewPts} AstikPoints</strong> (pilier ig_investment)
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <DaButton
            type="submit"
            disabled={mut.isPending || !form.materialId || !form.memberDiscordId || !form.quantity}
          >
            {mut.isPending ? "Enregistrement…" : "Valider le don"}
          </DaButton>
          <DaButton variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </DaButton>
        </div>
      </form>
    </PageCard>
  );
}
