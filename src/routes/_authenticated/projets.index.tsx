import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listProjects, upsertProject, type Project } from "@/lib/data/projects.functions";
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

export const Route = createFileRoute("/_authenticated/projets/")({
  head: () => ({ meta: [{ title: "Projets Build · PunkAstik" }] }),
  component: ProjetsPage,
});

const STATUS_LABEL: Record<string, string> = {
  actif: "Actif",
  terminé: "Terminé",
  archivé: "Archivé",
};
const STATUS_ACCENT: Record<string, "green" | "zinc" | "pink"> = {
  actif: "green",
  terminé: "zinc",
  archivé: "zinc",
};

function ProjetsPage() {
  const { data: me } = useCurrentUser();
  const isStaff = hasPerm(me, "points.manage");
  const qc = useQueryClient();

  const listFn = useServerFn(listProjects);
  const upsertFn = useServerFn(upsertProject);

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(undefined as any),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    dimensions: "",
    status: "actif" as Project["status"],
  });

  const createMut = useMutation({
    mutationFn: (payload: typeof form) => upsertFn({ data: payload } as any),
    onSuccess: () => {
      toast.success("Projet créé");
      setShowCreate(false);
      setForm({ name: "", description: "", dimensions: "", status: "actif" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (isLoading) return <LoadingBlock label="Chargement projets…" />;
  if (error) return <ErrorBlock message={toUserMessage(error)} />;

  const projects = data?.projects ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        code="// projets"
        title="Projets Build"
        description="Suivez la progression des projets de construction de la faction."
      />

      {isStaff && (
        <div className="flex justify-end">
          <DaButton onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Annuler" : "+ Nouveau projet"}
          </DaButton>
        </div>
      )}

      {showCreate && isStaff && (
        <PageCard>
          <SectionLabel>Nouveau projet</SectionLabel>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate(form);
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
                  placeholder="Base Claim Tempo"
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
                  placeholder="ex: 64x64x32"
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
                placeholder="Description courte du projet…"
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
            <div className="flex items-center gap-3 pt-1">
              <DaButton type="submit" disabled={createMut.isPending || !form.name}>
                {createMut.isPending ? "Création…" : "Créer"}
              </DaButton>
            </div>
          </form>
        </PageCard>
      )}

      {projects.length === 0 ? (
        <EmptyBlock label="Aucun projet actif" />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to="/projets/$id" params={{ id: project.id }} className="block group">
      <PageCard className="hover:border-primary/60 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className="text-base font-bold uppercase tracking-tight text-foreground group-hover:text-primary transition-colors"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {project.name}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {project.description}
              </p>
            )}
            {project.dimensions && (
              <p className="text-[10px] font-mono text-muted-foreground/70 mt-1 uppercase tracking-wider">
                // {project.dimensions}
              </p>
            )}
          </div>
          <DaChip accent={STATUS_ACCENT[project.status] ?? "zinc"}>
            {STATUS_LABEL[project.status] ?? project.status}
          </DaChip>
        </div>
      </PageCard>
    </Link>
  );
}
