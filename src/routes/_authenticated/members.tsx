import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { X, Pencil, Check, RefreshCw } from "lucide-react";
import { listMembers, resolveAndUpdateIgName } from "@/lib/data/members.functions";
import { syncMembersFromDiscord } from "@/lib/data/members-sync.functions";
import { Paginator, getPagedSlice } from "@/components/Paginator";
import { MemberRowsSkeleton } from "@/components/Skeletons";
import {
  PageHeader,
  PageCard,
  EmptyBlock,
  DaChip,
  ErrorBlock,
  DaButton,
} from "@/components/tools/ToolsUi";
import { MemberQuickActions } from "@/components/members/MemberQuickActions";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Membres · PunkAstik" }] }),
  component: () => (
    <Guard perm="members.view">
      <MembersPage />
    </Guard>
  ),
});

const PER_PAGE = 30;

type SortKey = "name" | "points";

function StatusBadge({ status }: { status?: string | null }) {
  switch (status) {
    case "away":
      return <DaChip accent="red">Absent</DaChip>;
    case "former":
      return <DaChip accent="zinc">Ancien</DaChip>;
    case "trial":
      return <DaChip accent="pink">Essai</DaChip>;
    case "active":
      return <DaChip accent="green">Actif</DaChip>;
    default:
      return null;
  }
}

function SyncButton({ onDone }: { onDone: () => void }) {
  const syncFn = useServerFn(syncMembersFromDiscord);
  const [result, setResult] = useState<{
    added: number;
    archived: number;
    updated: number;
    reactivated: number;
    failed: number;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: () => syncFn({ data: undefined }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("Synchronisation terminée");
      onDone();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <DaButton variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        <RefreshCw className={`size-3.5 mr-1.5 ${mutation.isPending ? "animate-spin" : ""}`} />
        {mutation.isPending ? "Synchronisation…" : "Actualiser les membres"}
      </DaButton>
      {result && !mutation.isPending && (
        <span className="text-xs font-mono text-muted-foreground">
          +{result.added} · ⤴{result.reactivated} · ~{result.updated} · ✕{result.archived}
          {result.failed > 0 && <span className="text-red-400 ml-2">⚠ {result.failed} échecs</span>}
        </span>
      )}
    </div>
  );
}

function InlineIgEdit({
  discordId,
  igName,
  onSaved,
}: {
  discordId: string;
  igName: string | null;
  onSaved: (newIgName: string, newUuid: string) => void;
}) {
  const resolveFn = useServerFn(resolveAndUpdateIgName);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(igName ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => resolveFn({ data: { discordId, igName: value.trim() } }),
    onSuccess: (data) => {
      setEditing(false);
      setError(null);
      toast.success(`Pseudo lié : ${data.ig_name} (${data.mc_uuid.slice(0, 8)}…)`);
      onSaved(data.ig_name, data.mc_uuid);
    },
    onError: (e: Error) => setError(toUserMessage(e)),
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
          setValue(igName ?? "");
          setError(null);
        }}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors ml-1"
        title="Modifier le pseudo IG"
      >
        <Pencil className="size-3" />
      </button>
    );
  }

  return (
    <span
      className="inline-flex flex-col gap-0.5"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") mutation.mutate();
            if (e.key === "Escape") {
              setEditing(false);
              setError(null);
            }
          }}
          className="w-32 bg-background border border-primary px-1.5 py-0.5 text-xs font-mono text-white focus:outline-none"
          placeholder="pseudo IG"
          disabled={mutation.isPending}
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="text-muted-foreground hover:text-primary"
        >
          <X className="size-3.5" />
        </button>
      </span>
      {error && <span className="text-[10px] text-red-400 font-mono">{error}</span>}
    </span>
  );
}

function MembersPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<"active" | "former" | "away" | "all">("active");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const navigate = useNavigate({ from: Route.fullPath });
  const fn = useServerFn(listMembers);
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  // Debounce de la recherche : évite un appel serveur à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["members", debouncedQ, status],
    queryFn: () => fn({ data: { q: debouncedQ, status } }),
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, sort]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const sorted = useMemo(() => {
    const arr = [...members];
    if (sort === "points") {
      arr.sort((a, b) => (b.astik_points ?? 0) - (a.astik_points ?? 0));
    } else {
      arr.sort((a, b) =>
        (a.ig_name ?? a.discord_username ?? a.discord_id).localeCompare(
          b.ig_name ?? b.discord_username ?? b.discord_id,
          "fr",
          { sensitivity: "base" },
        ),
      );
    }
    return arr;
  }, [members, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paged = useMemo(() => getPagedSlice(sorted, page, PER_PAGE), [sorted, page]);

  return (
    <div className="space-y-5">
      <PageHeader
        code="// members.list"
        title={`Membres [${members.length}]`}
        description="Annuaire des membres de la faction — filtres par statut + recherche pseudo/IG/ID."
      />

      <PageCard>
        <div className="space-y-3">
          <div className="relative max-w-md">
            <input
              placeholder="Rechercher (pseudo, IG, ID)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 pr-9 text-sm text-white placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 font-mono"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-5 text-muted-foreground hover:text-primary transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {hasPerm(user, "admin.access") && (
            <SyncButton onDone={() => qc.invalidateQueries({ queryKey: ["members"] })} />
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-between">
            <div className="flex gap-1">
              {(["active", "away", "former", "all"] as const).map((s) => {
                const active = status === s;
                const label =
                  s === "active"
                    ? "Actifs"
                    : s === "away"
                      ? "Absents"
                      : s === "former"
                        ? "Anciens"
                        : "Tous";
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-4 py-2 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
                      active
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-border hover:text-white"
                    }`}
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <span
                className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/70 mr-1"
                style={{ fontFamily: "'Space Mono'" }}
              >
                Tri
              </span>
              {(["name", "points"] as const).map((s) => {
                const active = sort === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    aria-pressed={active}
                    className={`px-3 py-2 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
                      active
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-border hover:text-white"
                    }`}
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {s === "name" ? "Nom" : "Points"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PageCard>

      {isLoading && <MemberRowsSkeleton count={8} />}

      {error && <ErrorBlock message={(error as Error).message} hint="Réessaie dans un instant." />}

      <div className="grid gap-2" aria-live="polite" aria-busy={isLoading}>
        <p className="sr-only" aria-live="polite">
          {isLoading ? "Chargement des membres…" : `${members.length} membre(s)`}
        </p>
        {paged.map((m, i) => {
          const rank = (page - 1) * PER_PAGE + i + 1;
          const medal =
            sort === "points"
              ? rank === 1
                ? "text-yellow-400"
                : rank === 2
                  ? "text-foreground/80"
                  : rank === 3
                    ? "text-amber-600"
                    : "text-muted-foreground/70"
              : "text-muted-foreground/70";
          return (
            <Link
              key={m.discord_id}
              to="/members/$id"
              params={{ id: m.discord_id }}
              preload="intent"
              aria-label={`Ouvrir le profil de ${m.ig_name ?? m.discord_username ?? m.discord_id}`}
              className="relative flex items-center gap-3 border border-border bg-secondary/70 p-3 backdrop-blur transition hover:border-primary/60 active:border-primary/80 active:bg-secondary touch-manipulation"
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.shiftKey
                ) {
                  return;
                }

                event.preventDefault();
                navigate({ to: "/members/$id", params: { id: m.discord_id } });
              }}
            >
              <span
                className={`text-[9px] w-8 shrink-0 ${medal}`}
                style={{ fontFamily: "'Space Mono'" }}
              >
                [{String(rank).padStart(2, "0")}]
              </span>
              {m.avatar_url ? (
                <img src={m.avatar_url} className="size-10 border border-border" alt="" />
              ) : (
                <div className="size-10 bg-secondary border border-border" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-bold uppercase tracking-tight text-white truncate"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {m.ig_name ?? m.discord_username ?? m.discord_id}
                  {hasPerm(user, "members.edit") && (
                    <InlineIgEdit
                      discordId={m.discord_id}
                      igName={m.ig_name}
                      onSaved={() => qc.invalidateQueries({ queryKey: ["members"] })}
                    />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                  <span className="font-mono">@{m.discord_username}</span>
                  {m.current_grade && <DaChip accent="blurple">{m.current_grade}</DaChip>}
                  {status === "all" && <StatusBadge status={m.status} />}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-primary font-bold text-lg"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {m.astik_points}
                </div>
                <div
                  className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  AstikPoints
                </div>
              </div>
              <MemberQuickActions
                memberDiscordId={m.discord_id}
                memberLabel={m.ig_name ?? m.discord_username ?? m.discord_id}
              />
            </Link>
          );
        })}
        {members.length === 0 && !isLoading && !error && (
          <EmptyBlock label="Aucun membre — ajuste filtres" />
        )}
      </div>

      <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
