import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageCard } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  listLegacyApplications,
  getLegacyOverview,
  setLegacyContactStatus,
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
import { Clock, PhoneCall, Ban, Search, Users, Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backlog")({
  component: () => (
    <Guard perm="admin.access">
      <BacklogPage />
    </Guard>
  ),
});

const STATUSES: ContactStatus[] = ["to_contact", "contacted", "do_not_contact"];
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
};

const PER_PAGE = 50;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

function BacklogPage() {
  const listFn = useServerFn(listLegacyApplications);
  const overviewFn = useServerFn(getLegacyOverview);
  const setStatusFn = useServerFn(setLegacyContactStatus);
  const qc = useQueryClient();

  const [status, setStatus] = useState<ContactStatus | "all">("all");
  const [source, setSource] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LegacyApplication | null>(null);

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

  const filtered = useMemo(() => {
    let r = allItems ?? [];
    if (status !== "all") r = r.filter((x) => x.contact_status === status);
    if (source !== "all") r = r.filter((x) => x.source === source);
    const s = search.trim().toLowerCase();
    if (s)
      r = r.filter(
        (x) =>
          (x.ig_name ?? "").toLowerCase().includes(s) ||
          (x.discord_name ?? "").toLowerCase().includes(s),
      );
    return r;
  }, [allItems, status, source, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paged = getPagedSlice(filtered, safePage, PER_PAGE);

  return (
    <div className="space-y-5 max-w-6xl">
      <PageHeader
        code="// recruitment.backlog"
        title="Backlog candidatures"
        description="Anciennes candidatures importées (multi-formulaires). Suis tes prises de contact et ouvre chaque candidature au clic."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <div className="flex gap-1">
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
          </div>
        </div>

        {isLoading ? (
          <CardListSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucune candidature"
            description="Aucune ancienne candidature ne correspond à ces filtres."
          />
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              {filtered.length} candidature{filtered.length > 1 ? "s" : ""}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Pseudo</th>
                    <th className="px-3 py-2 font-medium hidden sm:table-cell">Âge</th>
                    <th className="px-3 py-2 font-medium hidden md:table-cell">Source</th>
                    <th className="px-3 py-2 font-medium hidden lg:table-cell">Date</th>
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
                          className="text-left group"
                        >
                          <div className="font-medium text-foreground group-hover:text-primary group-hover:underline">
                            {row.ig_name || row.discord_name || "—"}
                          </div>
                          {row.discord_name && row.ig_name && (
                            <div className="text-xs text-muted-foreground">@{row.discord_name}</div>
                          )}
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
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-muted-foreground -mt-2 mb-2">
              {app.discord_name && <>Discord : {app.discord_name} · </>}
              {app.age != null && <>{app.age} ans · </>}
              Candidaté le {fmtDate(app.submitted_at)}
              {app.contact_updated_by_username && (
                <> · dernier statut par {app.contact_updated_by_username}</>
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
