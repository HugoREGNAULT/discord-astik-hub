import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageCard } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  listLegacyApplications,
  getLegacyOverview,
  setLegacyContactStatus,
  importLegacyCsv,
  verifyLegacyMojang,
  verifyLegacyPaladium,
  type LegacyApplication,
  type ContactStatus,
} from "@/lib/data/legacy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paginator, getPagedSlice } from "@/components/Paginator";
import { CardListSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import {
  Clock,
  PhoneCall,
  Ban,
  Search,
  Users,
  Archive,
  Upload,
  Loader2,
  UserCheck,
  RefreshCw,
  Swords,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/backlog")({
  component: () => (
    <Guard perm="admin.access">
      <BacklogPage />
    </Guard>
  ),
});

const STATUSES: ContactStatus[] = ["to_contact", "contacted", "do_not_contact", "already_member"];
const STATUS_META: Record<
  ContactStatus,
  { label: string; short: string; icon: typeof Clock; btn: string; badge: string }
> = {
  to_contact: {
    label: "À contacter",
    short: "À contacter",
    icon: Clock,
    btn: "bg-amber-500 hover:bg-amber-600 text-black",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
  contacted: {
    label: "Contacté",
    short: "Contacté",
    icon: PhoneCall,
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  do_not_contact: {
    label: "Ne pas contacter",
    short: "Ne pas",
    icon: Ban,
    btn: "bg-red-600 hover:bg-red-700 text-white",
    badge: "bg-red-500/15 text-red-300 border-red-500/40",
  },
  already_member: {
    label: "Déjà membre",
    short: "Déjà membre",
    icon: UserCheck,
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  },
};

type SortKey = "date" | "age" | "name" | "paladium";
const PER_PAGE = 50;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

/** Paladium renvoie soit un epoch (s ou ms), soit une date ISO. */
function fmtPaladiumDate(v: string | null): string {
  if (!v) return "—";
  const n = Number(v);
  const d = Number.isFinite(n) && v.trim() !== "" ? new Date(n > 1e12 ? n : n * 1000) : new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("fr-FR");
}

function fmtPaladiumYear(v: string | null): string {
  if (!v) return "";
  const n = Number(v);
  const d = Number.isFinite(n) && v.trim() !== "" ? new Date(n > 1e12 ? n : n * 1000) : new Date(v);
  return isNaN(d.getTime()) ? "" : String(d.getFullYear());
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR") + " $";
}

function BacklogPage() {
  const listFn = useServerFn(listLegacyApplications);
  const overviewFn = useServerFn(getLegacyOverview);
  const setStatusFn = useServerFn(setLegacyContactStatus);
  const importFn = useServerFn(importLegacyCsv);
  const verifyFn = useServerFn(verifyLegacyMojang);
  const paladiumFn = useServerFn(verifyLegacyPaladium);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const [status, setStatus] = useState<ContactStatus | "all">("all");
  const [source, setSource] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LegacyApplication | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeV11Only, setActiveV11Only] = useState(false);

  const { data: overview } = useQuery({
    queryKey: ["legacy-overview"],
    queryFn: () => overviewFn(),
  });
  const { data: allItems, isLoading } = useQuery({
    queryKey: ["legacy"],
    queryFn: () => listFn({ data: {} }) as Promise<LegacyApplication[]>,
  });

  const mutation = useMutation({
    mutationFn: (v: { id: string; status: ContactStatus }) =>
      setStatusFn({ data: { id: v.id, status: v.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legacy"] });
      qc.invalidateQueries({ queryKey: ["legacy-overview"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const importMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const results: { source: string; count: number }[] = [];
      for (const file of files) {
        const content = await file.text();
        const res = await importFn({ data: { filename: file.name, content } });
        results.push({ source: res.source, count: res.count });
      }
      return results;
    },
    onSuccess: (results) => {
      const total = results.reduce((s, r) => s + r.count, 0);
      toast.success(`Import terminé : ${total} candidature(s) sur ${results.length} fichier(s).`);
      qc.invalidateQueries({ queryKey: ["legacy"] });
      qc.invalidateQueries({ queryKey: ["legacy-overview"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const mojangMutation = useMutation({
    mutationFn: async () => {
      let total = 0;
      let valid = 0;
      let notFound = 0;
      for (let i = 0; i < 40; i++) {
        const res = await verifyFn({ data: { limit: 150 } });
        total += res.processed;
        valid += res.valid;
        notFound += res.notFound;
        if (res.processed === 0 || res.remaining === 0) break;
      }
      return { total, valid, notFound };
    },
    onSuccess: (r) => {
      toast.success(
        r.total === 0
          ? "Tous les pseudos sont déjà vérifiés."
          : `Mojang : ${r.total} vérifiés (${r.valid} valides, ${r.notFound} introuvables).`,
      );
      qc.invalidateQueries({ queryKey: ["legacy"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const paladiumMutation = useMutation({
    mutationFn: async () => {
      let total = 0;
      let found = 0;
      const tid = toast.loading("Stats Paladium : démarrage…");
      try {
        for (let i = 0; i < 100; i++) {
          const res = await paladiumFn({ data: { limit: 10 } });
          total += res.processed;
          found += res.found;
          toast.loading(
            `Stats Paladium : ${total} traités · ${found} trouvés` +
              (res.remaining ? ` · ${res.remaining} restants…` : "…"),
            { id: tid },
          );
          // Rafraîchit la colonne toutes les ~5 passes (≈100 profils) sans surcharger.
          if (i % 5 === 4) qc.invalidateQueries({ queryKey: ["legacy"] });
          if (res.processed === 0 || res.remaining === 0) break;
          if (res.rateLimited) await new Promise((r) => setTimeout(r, 3000));
        }
      } finally {
        toast.dismiss(tid);
      }
      return { total, found };
    },
    onSuccess: (r) => {
      toast.success(
        r.total === 0
          ? "Stats Paladium déjà à jour."
          : `Paladium terminé : ${r.total} profils vérifiés (${r.found} trouvés sur le serveur).`,
      );
      qc.invalidateQueries({ queryKey: ["legacy"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    let r = allItems ?? [];
    if (status !== "all") r = r.filter((x) => x.contact_status === status);
    if (source !== "all") r = r.filter((x) => x.source === source);
    if (activeV11Only) r = r.filter((x) => x.paladium_played_v11);
    const s = search.trim().toLowerCase();
    if (s)
      r = r.filter(
        (x) =>
          (x.ig_name ?? "").toLowerCase().includes(s) ||
          (x.discord_name ?? "").toLowerCase().includes(s),
      );
    return r;
  }, [allItems, status, source, search, activeV11Only]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "age") cmp = (a.age ?? -1) - (b.age ?? -1);
      else if (sortKey === "name")
        cmp = (a.ig_name ?? a.discord_name ?? "").localeCompare(b.ig_name ?? b.discord_name ?? "");
      else if (sortKey === "paladium") {
        // Actifs V11 d'abord, puis en faction, puis par niveau total de métiers.
        const score = (x: LegacyApplication) =>
          (x.paladium_played_v11 ? 1e12 : 0) +
          (x.paladium_faction ? 1e8 : 0) +
          (x.paladium_job_total ?? 0) * 1e3 +
          Math.min(x.paladium_money ?? 0, 1e9) / 1e9;
        cmp = score(a) - score(b);
      } else cmp = (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paged = getPagedSlice(sorted, safePage, PER_PAGE);

  return (
    <div className="space-y-5 max-w-6xl">
      <PageHeader
        code="// recruitment.backlog"
        title="Backlog candidatures"
        description="Anciennes candidatures importées (multi-formulaires). Suis tes prises de contact et ouvre chaque candidature au clic."
      />

      {/* Outils temporaires (import + vérif Mojang) */}
      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground max-w-xl">
          <span className="font-medium text-foreground">Import CSV</span> — dépose tes exports
          Google Forms (.csv, plusieurs à la fois).{" "}
          <span className="italic">Outils temporaires.</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={(e) => {
              const arr = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              if (arr.length > 0) {
                toast.info(`Lecture de ${arr.length} fichier(s)…`);
                importMutation.mutate(arr);
              }
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importMutation.isPending}>
            {importMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Importer des CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => mojangMutation.mutate()}
            disabled={mojangMutation.isPending}
          >
            {mojangMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Vérifier les pseudos
          </Button>
          <Button
            variant="outline"
            onClick={() => paladiumMutation.mutate()}
            disabled={paladiumMutation.isPending}
          >
            {paladiumMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Swords className="w-4 h-4 mr-2" />
            )}
            Stats Paladium
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Archive} label="Total" value={overview?.total ?? 0} />
        {STATUSES.map((st) => {
          const M = STATUS_META[st];
          return (
            <StatCard
              key={st}
              icon={M.icon}
              label={M.label}
              value={overview?.statuses?.[st] ?? 0}
              tone={M.badge}
            />
          );
        })}
      </div>

      <PageCard>
        {/* Filtres */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un pseudo (IG ou Discord)…"
              className="pl-8"
            />
          </div>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Toutes les sources</option>
            {(overview?.sources ?? []).map((s) => (
              <option key={s.source} value={s.source}>
                {s.source} ({s.count})
              </option>
            ))}
          </select>
          <div className="flex gap-1 flex-wrap">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              Tous
            </FilterChip>
            {STATUSES.map((st) => (
              <FilterChip
                key={st}
                active={status === st}
                onClick={() => {
                  setStatus(st);
                  setPage(1);
                }}
              >
                {STATUS_META[st].short}
              </FilterChip>
            ))}
            <FilterChip
              active={activeV11Only}
              onClick={() => {
                setActiveV11Only((v) => !v);
                setPage(1);
              }}
            >
              ⚡ Actif V11
            </FilterChip>
          </div>
        </div>

        {isLoading ? (
          <CardListSkeleton count={6} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucune candidature"
            description="Aucune ancienne candidature ne correspond à ces filtres."
          />
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              {sorted.length} candidature{sorted.length > 1 ? "s" : ""}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <SortTh
                      label="Pseudo"
                      k="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortTh
                      label="Âge"
                      k="age"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      className="hidden sm:table-cell"
                    />
                    <th className="px-3 py-2 font-medium hidden md:table-cell">Source</th>
                    <SortTh
                      label="Date"
                      k="date"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      className="hidden lg:table-cell"
                    />
                    <SortTh
                      label="Paladium"
                      k="paladium"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      className="hidden md:table-cell"
                    />
                    <th className="px-3 py-2 font-medium">Statut / action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="text-left group flex items-start gap-2"
                        >
                          <img
                            src={`https://mc-heads.net/avatar/${encodeURIComponent(row.mojang_uuid || row.ig_name || row.discord_name || "MHF_Steve")}/28`}
                            alt=""
                            loading="lazy"
                            className="w-7 h-7 rounded-sm border border-border shrink-0 mt-0.5"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "https://mc-heads.net/avatar/MHF_Steve/28";
                            }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground group-hover:text-primary group-hover:underline">
                                {row.ig_name || row.discord_name || "—"}
                              </span>
                              {row.mojang_current_name &&
                                row.ig_name &&
                                row.mojang_current_name.toLowerCase() !==
                                  row.ig_name.toLowerCase() && (
                                  <span className="text-xs text-muted-foreground italic">
                                    ({row.mojang_current_name})
                                  </span>
                                )}
                              {row.is_blacklisted && (
                                <Badge className="bg-red-500/15 text-red-300 border-red-500/40 text-[9px] px-1.5">
                                  🚫 BL
                                </Badge>
                              )}
                              {row.mojang_status === "not_found" && !row.mojang_current_name && (
                                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/40 text-[9px] px-1.5">
                                  pseudo introuvable
                                </Badge>
                              )}
                              {row.mojang_status === "not_found" && row.mojang_current_name && (
                                <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/40 text-[9px] px-1.5">
                                  pseudo changé
                                </Badge>
                              )}
                              {row.is_member && (
                                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[9px] px-1.5">
                                  ✓ Membre
                                </Badge>
                              )}
                              {row.paladium_played_v11 && (
                                <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-[9px] px-1.5">
                                  ⚡ Actif V11
                                </Badge>
                              )}
                            </div>
                            {row.discord_name && row.ig_name && (
                              <div className="text-xs text-muted-foreground">
                                @{row.discord_name}
                              </div>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                        {row.age ?? "—"}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {row.source}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                        {fmtDate(row.submitted_at)}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-xs whitespace-nowrap">
                        {row.paladium_played_v11 ? (
                          <span className="text-green-300">
                            ⚡ {row.paladium_faction || "Actif V11"}
                            {row.paladium_job_total != null && row.paladium_job_total > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {row.paladium_job_total} niv.
                              </span>
                            )}
                          </span>
                        ) : row.paladium_status === "found" ? (
                          <span className="text-muted-foreground/70">
                            {row.paladium_first_join
                              ? `depuis ${fmtPaladiumYear(row.paladium_first_join)}`
                              : "a déjà joué"}
                          </span>
                        ) : row.paladium_status === "not_found" ? (
                          <span className="text-muted-foreground/50">hors serveur</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((st) => {
                            const M = STATUS_META[st];
                            const active = row.contact_status === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                disabled={mutation.isPending}
                                onClick={() => mutation.mutate({ id: row.id, status: st })}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                                  active
                                    ? M.btn + " border-transparent"
                                    : "bg-transparent border-border text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {M.short}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <Paginator page={safePage} pageCount={pageCount} onPageChange={setPage} />
            </div>
          </>
        )}
      </PageCard>

      <DetailDialog app={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SortTh({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <th
      className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-foreground ${className ?? ""}`}
      onClick={() => onSort(k)}
    >
      {label} {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
    </th>
  );
}

function FilterChip({
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
      className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className={`p-2 rounded-md ${tone ?? "bg-primary/10 text-primary"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xl font-bold leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function DetailDialog({ app, onClose }: { app: LegacyApplication | null; onClose: () => void }) {
  const entries = app ? Object.entries(app.raw ?? {}) : [];
  return (
    <Dialog open={app !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {app && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {app.ig_name || app.discord_name || "Candidature"}
                <Badge variant="outline" className="text-[10px]">
                  {app.source}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${STATUS_META[app.contact_status].badge}`}
                >
                  {STATUS_META[app.contact_status].label}
                </Badge>
                {app.is_blacklisted && (
                  <Badge className="bg-red-500/15 text-red-300 border-red-500/40 text-[10px]">
                    🚫 Blacklist
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-muted-foreground -mt-2 mb-2 space-y-1">
              <div>
                {app.discord_name && <>Discord : {app.discord_name} · </>}
                {app.age != null && <>{app.age} ans · </>}
                Candidaté le {fmtDate(app.submitted_at)}
                {app.contact_updated_by_username && (
                  <> · dernier statut par {app.contact_updated_by_username}</>
                )}
              </div>
              {app.mojang_status === "valid" && app.mojang_uuid && (
                <div>
                  ✅ Pseudo Mojang valide :{" "}
                  <a
                    href={`https://fr.namemc.com/profile/${app.mojang_uuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    {app.mojang_current_name ?? app.ig_name}
                  </a>
                </div>
              )}
              {app.mojang_status === "not_found" && (
                <div className="text-amber-400">
                  ⚠️ Pseudo introuvable sur Mojang (changé ou compte supprimé).
                </div>
              )}
              {app.is_member && (
                <div className="text-emerald-400">
                  ✓ Déjà membre actif de la PunkAstik (pseudo ou UUID reconnu).
                </div>
              )}
              {app.paladium_played_v11 && (
                <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2 space-y-1 text-foreground">
                  <div className="font-medium text-green-300">⚡ Actif cette saison (V11)</div>
                  {app.paladium_faction && (
                    <div>
                      Faction : <span className="font-medium">{app.paladium_faction}</span>
                    </div>
                  )}
                  {app.paladium_money != null && <div>Argent : {fmtMoney(app.paladium_money)}</div>}
                  {app.paladium_jobs && Object.keys(app.paladium_jobs).length > 0 && (
                    <div>
                      Métiers :{" "}
                      {Object.entries(app.paladium_jobs)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, lvl]) => `${name} ${lvl}`)
                        .join(" · ")}
                    </div>
                  )}
                  {app.paladium_first_join && (
                    <div className="text-muted-foreground">
                      Joue depuis {fmtPaladiumDate(app.paladium_first_join)}
                    </div>
                  )}
                </div>
              )}
              {app.paladium_status === "found" && !app.paladium_played_v11 && (
                <div className="text-muted-foreground">
                  ⚔ Compte Paladium existant mais aucune activité cette saison (V11)
                  {app.paladium_first_join && (
                    <> · joue depuis {fmtPaladiumDate(app.paladium_first_join)}</>
                  )}
                  .
                </div>
              )}
              {app.paladium_status === "not_found" && (
                <div className="text-muted-foreground">
                  ⚔ Jamais vu sur Paladium (pseudo introuvable sur le serveur).
                </div>
              )}
            </div>
            <div className="space-y-3">
              {entries.length === 0 && (
                <div className="text-sm text-muted-foreground">Aucune réponse enregistrée.</div>
              )}
              {entries.map(([q, a]) => (
                <div key={q}>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                    {q}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{String(a)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
