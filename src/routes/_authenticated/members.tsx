import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listMembers } from "@/lib/data/members.functions";
import { Paginator, getPagedSlice } from "@/components/Paginator";
import { MemberRowsSkeleton } from "@/components/Skeletons";
import { PageHeader, PageCard, EmptyBlock, DaChip, ErrorBlock } from "@/components/tools/ToolsUi";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Membres · PunkAstik" }] }),
  component: () => (
    <Guard perm="members.view">
      <MembersPage />
    </Guard>
  ),
});

const PER_PAGE = 30;

function MembersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "former" | "away" | "all">("active");
  const [page, setPage] = useState(1);
  const navigate = useNavigate({ from: Route.fullPath });
  const fn = useServerFn(listMembers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["members", q, status],
    queryFn: () => fn({ data: { q, status } }),
  });

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  const members = data?.members ?? [];
  const pageCount = Math.max(1, Math.ceil(members.length / PER_PAGE));
  const paged = useMemo(() => getPagedSlice(members, page, PER_PAGE), [members, page]);

  return (
    <div className="space-y-5">
      <PageHeader
        code="// members.list"
        title={`Membres [${members.length}]`}
        description="Annuaire des membres de la faction — filtres par statut + recherche pseudo/IG/ID."
      />

      <PageCard>
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Rechercher (pseudo, IG, ID)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-pink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/60 font-mono"
          />
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
                      ? "bg-pink-500 text-white border-pink-500"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                  }`}
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </PageCard>

      {isLoading && <MemberRowsSkeleton count={8} />}

      <div className="grid gap-2">
        {paged.map((m, i) => (
          <Link
            key={m.discord_id}
            to="/members/$id"
            params={{ id: m.discord_id }}
            preload="intent"
            aria-label={`Ouvrir le profil de ${m.ig_name ?? m.discord_username ?? m.discord_id}`}
            className="relative flex items-center gap-3 border border-zinc-800 bg-zinc-900/70 p-3 backdrop-blur transition hover:border-pink-500/60 active:border-pink-500/80 active:bg-zinc-900 touch-manipulation"
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
              className="text-[9px] text-zinc-600 w-8 shrink-0"
              style={{ fontFamily: "'Space Mono'" }}
            >
              [{String((page - 1) * PER_PAGE + i + 1).padStart(2, "0")}]
            </span>
            {m.avatar_url ? (
              <img src={m.avatar_url} className="size-10 border border-zinc-700" alt="" />
            ) : (
              <div className="size-10 bg-zinc-800 border border-zinc-700" />
            )}
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-bold uppercase tracking-tight text-white truncate"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {m.ig_name ?? m.discord_username ?? m.discord_id}
              </div>
              <div className="text-[11px] text-zinc-400 truncate flex items-center gap-2 mt-0.5">
                <span className="font-mono">@{m.discord_username}</span>
                {m.current_grade && <DaChip accent="blurple">{m.current_grade}</DaChip>}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-pink-400 font-bold text-lg"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {m.astik_points}
              </div>
              <div
                className="text-[11px] text-zinc-400 uppercase tracking-[0.2em]"
                style={{ fontFamily: "'Space Mono'" }}
              >
                AstikPoints
              </div>
            </div>
          </Link>
        ))}
        {members.length === 0 && !isLoading && <EmptyBlock label="Aucun membre — ajuste filtres" />}
      </div>

      <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
