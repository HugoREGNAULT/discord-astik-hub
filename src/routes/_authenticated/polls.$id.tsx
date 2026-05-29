import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Check, HelpCircle, X, Lock, Crown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPoll, castVote, closePoll, reopenPoll } from "@/lib/data/polls.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { DetailPageSkeleton } from "@/components/Skeletons";

type Choice = "yes" | "maybe" | "no";

export const Route = createFileRoute("/_authenticated/polls/$id")({
  head: () => ({ meta: [{ title: "Sondage · PunkAstik" }] }),
  component: PollDetail,
});

function PollDetail() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const canManage = hasPerm(me, "members.edit");
  const qc = useQueryClient();

  const getFn = useServerFn(getPoll);
  const voteFn = useServerFn(castVote);
  const closeFn = useServerFn(closePoll);
  const reopenFn = useServerFn(reopenPoll);

  const { data, isLoading } = useQuery({
    queryKey: ["poll", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [myVotes, setMyVotes] = useState<Record<string, Choice>>({});

  useEffect(() => {
    if (!data) return;
    const mine: Record<string, Choice> = {};
    data.votes
      .filter((v: any) => v.voter_discord_id === data.myDiscordId)
      .forEach((v: any) => {
        mine[v.option_id] = v.choice as Choice;
      });
    setMyVotes(mine);
  }, [data]);

  const mVote = useMutation({
    mutationFn: () =>
      voteFn({
        data: {
          pollId: id,
          votes: Object.entries(myVotes).map(([optionId, choice]) => ({ optionId, choice })),
        },
      }),
    onSuccess: () => {
      toast.success("Vote enregistré");
      qc.invalidateQueries({ queryKey: ["poll", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const mClose = useMutation({
    mutationFn: (winningOptionId: string | null) =>
      closeFn({ data: { pollId: id, winningOptionId } }),
    onSuccess: () => {
      toast.success("Sondage clôturé");
      qc.invalidateQueries({ queryKey: ["poll", id] });
    },
  });

  const mReopen = useMutation({
    mutationFn: () => reopenFn({ data: { pollId: id } }),
    onSuccess: () => {
      toast.success("Sondage rouvert");
      qc.invalidateQueries({ queryKey: ["poll", id] });
    },
  });

  const tallies = useMemo(() => {
    if (!data) return {} as Record<string, { yes: number; maybe: number; no: number; score: number }>;
    const t: Record<string, { yes: number; maybe: number; no: number; score: number }> = {};
    for (const o of data.options) t[o.id] = { yes: 0, maybe: 0, no: 0, score: 0 };
    for (const v of data.votes as any[]) {
      const row = t[v.option_id];
      if (!row) continue;
      if (v.choice === "yes") row.yes++;
      else if (v.choice === "maybe") row.maybe++;
      else row.no++;
    }
    for (const k of Object.keys(t)) t[k].score = t[k].yes * 2 + t[k].maybe;
    return t;
  }, [data]);

  const voters = useMemo(() => {
    if (!data) return [] as { id: string; name: string }[];
    const map = new Map<string, string>();
    for (const v of data.votes as any[]) {
      map.set(v.voter_discord_id, v.voter_username ?? v.voter_discord_id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  if (isLoading) return <DetailPageSkeleton />;
  if (!data?.poll) return <p>Sondage introuvable.</p>;

  const p = data.poll;
  const isOpen = p.status === "open";
  const winnerId = p.winning_option_id;
  const bestScore = Math.max(0, ...Object.values(tallies).map((t) => t.score));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/polls"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{p.title}</h1>
            {isOpen ? (
              <Badge variant="secondary">Ouvert</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><Lock className="size-3" /> Clos</Badge>
            )}
          </div>
          {p.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{p.description}</p>}
          <div className="text-xs text-muted-foreground mt-1">
            Créé par {p.created_by_username ?? "—"} · {new Date(p.created_at).toLocaleString("fr-FR")}
            {p.location && ` · 📍 ${p.location}`}
          </div>
        </div>
        {canManage && (
          isOpen ? (
            <Button variant="outline" size="sm" onClick={() => mClose.mutate(null)}>
              <Lock className="size-4" /> Clôturer
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => mReopen.mutate()}>
              <RefreshCw className="size-4" /> Rouvrir
            </Button>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créneaux proposés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Créneau</th>
                  <th className="py-2 px-2 text-center">Oui</th>
                  <th className="py-2 px-2 text-center">Peut-être</th>
                  <th className="py-2 px-2 text-center">Non</th>
                  <th className="py-2 px-2 text-center">Score</th>
                  {isOpen && <th className="py-2 pl-3 text-right">Mon vote</th>}
                  {!isOpen && canManage && <th className="py-2 pl-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {data.options.map((o: any) => {
                  const t = tallies[o.id] ?? { yes: 0, maybe: 0, no: 0, score: 0 };
                  const isWinner = winnerId === o.id;
                  const isBest = !winnerId && t.score === bestScore && bestScore > 0;
                  return (
                    <tr key={o.id} className={`border-b border-border/50 ${isWinner ? "bg-primary/10" : ""}`}>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          {isWinner && <Crown className="size-4 text-primary" />}
                          <div>
                            <div className="font-medium">
                              {new Date(o.starts_at).toLocaleString("fr-FR", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {o.duration_minutes} min
                              {isBest && !isWinner && " · meilleur score"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center text-green-500 font-mono">{t.yes}</td>
                      <td className="text-center text-amber-500 font-mono">{t.maybe}</td>
                      <td className="text-center text-destructive font-mono">{t.no}</td>
                      <td className="text-center font-mono font-semibold">{t.score}</td>
                      {isOpen && (
                        <td className="py-2 pl-3">
                          <div className="flex gap-1 justify-end">
                            <ChoiceBtn current={myVotes[o.id]} value="yes" onClick={() => setMyVotes({ ...myVotes, [o.id]: "yes" })} />
                            <ChoiceBtn current={myVotes[o.id]} value="maybe" onClick={() => setMyVotes({ ...myVotes, [o.id]: "maybe" })} />
                            <ChoiceBtn current={myVotes[o.id]} value="no" onClick={() => setMyVotes({ ...myVotes, [o.id]: "no" })} />
                          </div>
                        </td>
                      )}
                      {!isOpen && canManage && (
                        <td className="py-2 pl-3 text-right">
                          {!isWinner && (
                            <Button size="sm" variant="ghost" onClick={() => mClose.mutate(o.id)}>
                              <Crown className="size-4" /> Choisir
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {isOpen && (
            <div className="mt-4 flex justify-end">
              <Button onClick={() => mVote.mutate()} disabled={Object.keys(myVotes).length === 0 || mVote.isPending}>
                Enregistrer mon vote
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {voters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participants ({voters.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {voters.map((v) => (
                <Badge key={v.id} variant="secondary" className="text-xs">{v.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChoiceBtn({
  current,
  value,
  onClick,
}: {
  current: Choice | undefined;
  value: Choice;
  onClick: () => void;
}) {
  const active = current === value;
  const Icon = value === "yes" ? Check : value === "maybe" ? HelpCircle : X;
  const cls =
    value === "yes"
      ? active
        ? "bg-green-500/20 text-green-500 border-green-500/50"
        : "hover:bg-green-500/10 hover:text-green-500"
      : value === "maybe"
        ? active
          ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
          : "hover:bg-amber-500/10 hover:text-amber-500"
        : active
          ? "bg-destructive/20 text-destructive border-destructive/50"
          : "hover:bg-destructive/10 hover:text-destructive";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`size-8 grid place-items-center rounded border border-border transition ${cls}`}
      title={value}
    >
      <Icon className="size-4" />
    </button>
  );
}
