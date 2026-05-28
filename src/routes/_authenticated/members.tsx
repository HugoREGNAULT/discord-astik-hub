import { createFileRoute, Link } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listMembers } from "@/lib/data/members.functions";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Paginator, usePagedSlice } from "@/components/Paginator";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Membres · PunkAstik" }] }),
  component: () => (<Guard perm="members.view"><MembersPage /></Guard>),
});

const PER_PAGE = 30;

function MembersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "former" | "all">("active");
  const [page, setPage] = useState(1);
  const fn = useServerFn(listMembers);
  const { data, isLoading } = useQuery({
    queryKey: ["members", q, status],
    queryFn: () => fn({ data: { q, status } }),
  });

  useEffect(() => { setPage(1); }, [q, status]);

  const members = data?.members ?? [];
  const pageCount = Math.max(1, Math.ceil(members.length / PER_PAGE));
  const paged = useMemo(() => usePagedSlice(members, page, PER_PAGE), [members, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Membres</h1>
        <Badge variant="secondary">{members.length}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Rechercher (pseudo, IG, ID)…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex gap-1">
          {(["active", "former", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs border ${status === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {s === "active" ? "Actifs" : s === "former" ? "Anciens" : "Tous"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      <div className="grid gap-2">
        {paged.map((m) => (
          <Link key={m.discord_id} to="/members/$id" params={{ id: m.discord_id }}>
            <Card className="p-3 flex items-center gap-3 hover:border-primary/60 transition">
              {m.avatar_url ? (
                <img src={m.avatar_url} className="size-10 rounded-full" alt="" />
              ) : (
                <div className="size-10 rounded-full bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.ig_name ?? m.discord_username ?? m.discord_id}</div>
                <div className="text-xs text-muted-foreground truncate">@{m.discord_username} · {m.current_grade ?? "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-primary font-bold">{m.astik_points}</div>
                <div className="text-[10px] text-muted-foreground">AstikPoints</div>
              </div>
            </Card>
          </Link>
        ))}
        {members.length === 0 && !isLoading && <p className="text-sm text-muted-foreground">Aucun membre.</p>}
      </div>

      <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

