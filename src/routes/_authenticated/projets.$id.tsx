import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getProject,
  listProjectMaterials,
  upsertProject,
  upsertMaterial,
  recordContribution,
  listProjectContributions,
  searchConfigValues,
  reverseContribution,
  deleteMaterial,
  deleteOrArchiveProject,
  type Project,
  type ProjectMaterial,
  type ProjectContribution,
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
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projets/$id")({
  head: () => ({ meta: [{ title: "Projet · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <ProjetDetailPage />
    </Guard>
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// ── Page principale ───────────────────────────────────────────────────────────

function ProjetDetailPage() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const isStaff = hasPerm(me, "points.manage");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const getProjectFn = useServerFn(getProject);
  const listMaterialsFn = useServerFn(listProjectMaterials);
  const listContribFn = useServerFn(listProjectContributions);
  const listMembersFn = useServerFn(listMembers);

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

  const { data: membersData } = useQuery({
    queryKey: ["members-all-active"],
    queryFn: () => listMembersFn({ data: { status: "active" } }),
    enabled: isStaff,
  });

  if (projLoading || matsLoading) return <LoadingBlock label="Chargement projet…" />;
  if (projErr) return <ErrorBlock message={toUserMessage(projErr)} />;

  const project = projData?.project;
  if (!project) return <ErrorBlock message="Projet introuvable" />;
  const materials = matsData?.materials ?? [];
  const contributions = contribData?.contributions ?? [];
  const top = contribData?.top ?? [];
  const gPct = globalPct(materials);

  const membersMap: Record<string, string> = {};
  for (const m of membersData?.members ?? []) {
    membersMap[m.discord_id] = m.ig_name ?? m.discord_username ?? m.discord_id;
  }

  const invalidateMaterials = () => qc.invalidateQueries({ queryKey: ["project-materials", id] });
  const invalidateContribs = () =>
    qc.invalidateQueries({ queryKey: ["project-contributions", id] });

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
              <MaterialCard
                key={mat.id}
                material={mat}
                isStaff={isStaff}
                onDeleted={invalidateMaterials}
              />
            ))}
          </div>
        )}
      </PageCard>

      {/* Ajouter matériau (staff) */}
      {isStaff && <AddMaterialForm projectId={id} onSaved={invalidateMaterials} />}

      {/* Enregistrer un don (staff) */}
      {isStaff && materials.length > 0 && (
        <RecordContributionForm
          projectId={id}
          materials={materials}
          onSaved={() => {
            invalidateMaterials();
            invalidateContribs();
          }}
        />
      )}

      {/* Journal des dons (staff) */}
      {isStaff && contributions.length > 0 && (
        <ContributionsLog
          contributions={contributions}
          materials={materials}
          membersMap={membersMap}
          onReversed={() => {
            invalidateMaterials();
            invalidateContribs();
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
                  #{i + 1}{" "}
                  <span className="text-foreground">{membersMap[c.discordId] ?? c.discordId}</span>
                </span>
                <span className="font-bold text-primary font-mono text-xs">{c.pts} pts</span>
              </div>
            ))}
          </div>
        </PageCard>
      )}

      {/* Zone dangereuse (staff) */}
      {isStaff && (
        <DangerZone
          projectId={id}
          projectName={project.name}
          onDone={(action) => {
            if (action === "deleted") {
              navigate({ to: "/projets" });
            } else {
              qc.invalidateQueries({ queryKey: ["project", id] });
              qc.invalidateQueries({ queryKey: ["projects"] });
            }
          }}
        />
      )}
    </div>
  );
}

// ── Carte matériau avec suppression ──────────────────────────────────────────

function MaterialCard({
  material,
  isStaff,
  onDeleted,
}: {
  material: ProjectMaterial;
  isStaff: boolean;
  onDeleted: () => void;
}) {
  const deleteFn = useServerFn(deleteMaterial);
  const mut = useMutation({
    mutationFn: () => deleteFn({ data: { materialId: material.id } } as any),
    onSuccess: () => {
      toast.success(`Matériau "${material.item_name}" supprimé`);
      onDeleted();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

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
              {isStaff && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                      disabled={mut.isPending}
                      title="Supprimer ce matériau"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  }
                  title={`Supprimer « ${material.item_name} » ?`}
                  description="Impossible si des dons sont déjà enregistrés sur ce matériau — annulez-les d'abord dans le journal des dons."
                  confirmLabel="Supprimer"
                  onConfirm={() => mut.mutateAsync().then(() => {})}
                />
              )}
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

// ── Journal des dons (staff) ──────────────────────────────────────────────────

function ContributionsLog({
  contributions,
  materials,
  membersMap,
  onReversed,
}: {
  contributions: ProjectContribution[];
  materials: ProjectMaterial[];
  membersMap: Record<string, string>;
  onReversed: () => void;
}) {
  const matMap: Record<string, string> = {};
  for (const m of materials) matMap[m.id] = m.item_name;

  return (
    <PageCard>
      <SectionLabel>Journal des dons ({contributions.length})</SectionLabel>
      <div className="divide-y divide-border/50">
        {contributions.map((c) => (
          <ContributionRow
            key={c.id}
            contribution={c}
            materialName={matMap[c.material_id] ?? "—"}
            memberName={membersMap[c.member_discord_id] ?? c.member_discord_id}
            onReversed={onReversed}
          />
        ))}
      </div>
    </PageCard>
  );
}

function ContributionRow({
  contribution,
  materialName,
  memberName,
  onReversed,
}: {
  contribution: ProjectContribution;
  materialName: string;
  memberName: string;
  onReversed: () => void;
}) {
  const reverseFn = useServerFn(reverseContribution);
  const mut = useMutation({
    mutationFn: () => reverseFn({ data: { contributionId: contribution.id } } as any),
    onSuccess: (res: any) => {
      toast.success(
        `Don annulé — ${contribution.points_awarded} pts retirés. Nouveau solde : ${res.newBalance}`,
      );
      onReversed();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
        <span className="font-mono text-muted-foreground shrink-0">
          {fmtDate(contribution.created_at)}
        </span>
        <span className="font-bold text-foreground truncate">{memberName}</span>
        <span className="text-muted-foreground">→ {materialName}</span>
        <span className="font-mono text-primary shrink-0">
          ×{contribution.quantity} = +{contribution.points_awarded} pts
        </span>
      </div>
      <ConfirmDialog
        trigger={
          <button
            type="button"
            className="shrink-0 text-[10px] font-mono text-destructive border border-destructive/40 px-2 py-0.5 hover:bg-destructive/10 transition-colors disabled:opacity-50 whitespace-nowrap"
            disabled={mut.isPending}
          >
            {mut.isPending ? "…" : "Annuler"}
          </button>
        }
        title="Annuler ce don ?"
        description={
          <span>
            Retire <strong>{contribution.points_awarded} pts</strong> à{" "}
            <strong>{memberName}</strong> et décrémente ×{contribution.quantity}{" "}
            <strong>{materialName}</strong>.
            <br />
            La trace reste conservée dans le ledger de points.
          </span>
        }
        confirmLabel="Confirmer l'annulation"
        onConfirm={() => mut.mutateAsync()}
      />
    </div>
  );
}

// ── Zone dangereuse ───────────────────────────────────────────────────────────

function DangerZone({
  projectId,
  projectName,
  onDone,
}: {
  projectId: string;
  projectName: string;
  onDone: (action: "archived" | "deleted") => void;
}) {
  const archiveFn = useServerFn(deleteOrArchiveProject);
  const mut = useMutation({
    mutationFn: () => archiveFn({ data: { projectId } } as any),
    onSuccess: (res: any) => {
      if (res.action === "deleted") {
        toast.success(`Projet "${projectName}" supprimé définitivement`);
      } else {
        toast.success(`Projet "${projectName}" archivé (historique de points préservé)`);
      }
      onDone(res.action);
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <PageCard className="border-destructive/30">
      <SectionLabel>Zone dangereuse</SectionLabel>
      <p className="text-xs text-muted-foreground mb-3">
        Si le projet a des dons enregistrés, il sera <strong>archivé</strong> pour préserver
        l'historique de points. S'il n'en a aucun, il sera <strong>supprimé définitivement</strong>.
      </p>
      <ConfirmDialog
        trigger={
          <DaButton variant="danger" disabled={mut.isPending}>
            {mut.isPending ? "…" : "Supprimer / Archiver le projet"}
          </DaButton>
        }
        title={`Supprimer ou archiver « ${projectName} » ?`}
        description="Le projet sera archivé si des dons existent, supprimé sinon. Cette action est irréversible."
        confirmLabel="Confirmer"
        onConfirm={() => mut.mutateAsync()}
      />
    </PageCard>
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

type ConfigValue = { id: string; name: string; points: number; image_url: string | null };

type UnitType = "item" | "liquide" | "divers";

const BLANK_MANUAL = {
  item_name: "",
  item_image_url: "",
  unit_type: "item" as UnitType,
  quantity_required: "",
  points_per_unit: "",
};

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] border transition-colors",
        active
          ? "border-primary text-primary bg-primary/10"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function AddMaterialForm({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"config" | "manual">("config");

  // config mode
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ConfigValue | null>(null);
  const [configQty, setConfigQty] = useState("");
  const [configUnitType, setConfigUnitType] = useState<UnitType>("item");

  // manual mode
  const [manual, setManual] = useState(BLANK_MANUAL);

  const upsertFn = useServerFn(upsertMaterial);
  const searchFn = useServerFn(searchConfigValues);

  const searchQuery = useQuery({
    queryKey: ["config-values-search", search],
    queryFn: () => searchFn({ data: { q: search } }),
    enabled: open && mode === "config" && !selected,
    staleTime: 30_000,
  });
  const results = searchQuery.data?.values ?? [];

  function resetConfig() {
    setSearch("");
    setSelected(null);
    setConfigQty("");
    setConfigUnitType("item");
  }

  function resetManual() {
    setManual(BLANK_MANUAL);
  }

  function switchMode(m: "config" | "manual") {
    setMode(m);
    resetConfig();
    resetManual();
  }

  const mut = useMutation({
    mutationFn: () => {
      if (mode === "config" && selected) {
        return upsertFn({
          data: {
            project_id: projectId,
            item_name: selected.name,
            item_image_url: selected.image_url,
            unit_type: configUnitType,
            quantity_required: parseFloat(configQty),
            points_per_unit: selected.points,
            display_order: 0,
          },
        } as any);
      }
      return upsertFn({
        data: {
          project_id: projectId,
          item_name: manual.item_name,
          item_image_url: manual.item_image_url || null,
          unit_type: manual.unit_type,
          quantity_required: parseFloat(manual.quantity_required),
          points_per_unit: parseFloat(manual.points_per_unit),
          display_order: 0,
        },
      } as any);
    },
    onSuccess: () => {
      const name = mode === "config" ? selected?.name : manual.item_name;
      toast.success(`"${name}" ajouté — continuez ou fermez`);
      resetConfig();
      resetManual();
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
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Ajouter des matériaux</SectionLabel>
        <div className="flex gap-1">
          <ModeTab active={mode === "config"} onClick={() => switchMode("config")}>
            Depuis config
          </ModeTab>
          <ModeTab active={mode === "manual"} onClick={() => switchMode("manual")}>
            Manuel
          </ModeTab>
        </div>
      </div>

      {mode === "config" ? (
        <ConfigPicker
          search={search}
          setSearch={setSearch}
          results={results}
          isLoading={searchQuery.isFetching}
          selected={selected}
          onSelect={setSelected}
          onDeselect={resetConfig}
          qty={configQty}
          setQty={setConfigQty}
          unitType={configUnitType}
          setUnitType={setConfigUnitType}
          onSubmit={() => mut.mutate()}
          isPending={mut.isPending}
          onClose={() => setOpen(false)}
        />
      ) : (
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
                value={manual.item_name}
                onChange={(e) => setManual((f) => ({ ...f, item_name: e.target.value }))}
                placeholder="Stone Bricks"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
                Type
              </label>
              <DaSelect
                value={manual.unit_type}
                onChange={(e) =>
                  setManual((f) => ({ ...f, unit_type: e.target.value as UnitType }))
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
                value={manual.quantity_required}
                onChange={(e) => setManual((f) => ({ ...f, quantity_required: e.target.value }))}
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
                value={manual.points_per_unit}
                onChange={(e) => setManual((f) => ({ ...f, points_per_unit: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Image URL (optionnel)
            </label>
            <DaInput
              value={manual.item_image_url}
              onChange={(e) => setManual((f) => ({ ...f, item_image_url: e.target.value }))}
              placeholder="https://…"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <DaButton
              type="submit"
              disabled={
                mut.isPending ||
                !manual.item_name ||
                !manual.quantity_required ||
                !manual.points_per_unit
              }
            >
              {mut.isPending ? "Ajout…" : "Ajouter"}
            </DaButton>
            <DaButton variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </DaButton>
          </div>
        </form>
      )}
    </PageCard>
  );
}

function ConfigPicker({
  search,
  setSearch,
  results,
  isLoading,
  selected,
  onSelect,
  onDeselect,
  qty,
  setQty,
  unitType,
  setUnitType,
  onSubmit,
  isPending,
  onClose,
}: {
  search: string;
  setSearch: (v: string) => void;
  results: ConfigValue[];
  isLoading: boolean;
  selected: ConfigValue | null;
  onSelect: (v: ConfigValue) => void;
  onDeselect: () => void;
  qty: string;
  setQty: (v: string) => void;
  unitType: UnitType;
  setUnitType: (v: UnitType) => void;
  onSubmit: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  if (selected) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {/* Item sélectionné */}
        <div className="flex items-center gap-3 border border-primary/40 bg-primary/5 px-3 py-2">
          {selected.image_url ? (
            <img
              src={selected.image_url}
              alt={selected.name}
              className="size-8 object-contain border border-border bg-secondary shrink-0"
            />
          ) : (
            <div className="size-8 border border-border bg-secondary shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-foreground truncate">{selected.name}</div>
            <div className="text-[10px] font-mono text-primary">
              {selected.points} pts/u — figé à l'ajout
            </div>
          </div>
          <button
            type="button"
            onClick={onDeselect}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
          >
            ✕ Changer
          </button>
        </div>

        {/* Quantité + type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Quantité requise
            </label>
            <DaInput
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Type
            </label>
            <DaSelect value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
              <option value="item">Item</option>
              <option value="liquide">Liquide</option>
              <option value="divers">Divers</option>
            </DaSelect>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <DaButton type="submit" disabled={isPending || !qty}>
            {isPending ? "Ajout…" : "Ajouter"}
          </DaButton>
          <DaButton variant="ghost" onClick={onClose}>
            Fermer
          </DaButton>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <DaInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Chercher un item dans le catalogue…"
        autoFocus
      />
      <div className="border border-border divide-y divide-border/40 max-h-64 overflow-y-auto">
        {results.length === 0 && !isLoading && (
          <div className="px-3 py-3 text-xs text-muted-foreground font-mono">
            {search.length === 0
              ? "// Tapez pour chercher un item"
              : "// Aucun résultat — essayez le mode Manuel"}
          </div>
        )}
        {isLoading && results.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground font-mono">// Chargement…</div>
        )}
        {results.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left group"
          >
            {v.image_url ? (
              <img
                src={v.image_url}
                alt={v.name}
                className="size-6 object-contain border border-border bg-secondary shrink-0"
              />
            ) : (
              <div className="size-6 border border-border bg-secondary shrink-0" />
            )}
            <span className="flex-1 font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {v.name}
            </span>
            <span className="font-mono text-primary shrink-0">{v.points} pts/u</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <DaButton variant="ghost" onClick={onClose}>
          Fermer
        </DaButton>
      </div>
    </div>
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
