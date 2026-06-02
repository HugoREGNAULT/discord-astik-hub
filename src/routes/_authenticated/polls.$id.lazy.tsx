import { createLazyFileRoute, Link, useRouter } from "@tanstack/react-router";
import { MonoLabel } from "@/components/tools/ToolsUi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Check,
  HelpCircle,
  X,
  Lock,
  Crown,
  RefreshCw,
  Upload,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPoll,
  castVote,
  closePoll,
  reopenPoll,
  importPollVotes,
  listPollEligibleVoters,
} from "@/lib/data/polls.functions";
import { listMembers } from "@/lib/data/members.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { DetailPageSkeleton } from "@/components/Skeletons";
import { parsePollCsv, type MatrixResult, type Choice as CsvChoice } from "@/lib/csv/poll-csv";

type Choice = "yes" | "maybe" | "no";

export const Route = createLazyFileRoute("/_authenticated/polls/$id")({
  component: PollDetail,
  errorComponent: PollDetailError,
  notFoundComponent: () => {
    const { id } = Route.useParams();
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sondage introuvable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Le sondage <code className="font-mono">{id}</code> n&apos;existe pas ou a été
              supprimé.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/polls">
                <ArrowLeft className="size-4" /> Retour aux sondages
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  },
});

function PollDetailError({ error, reset }: { error: Error; reset: () => void }) {
  const { id } = Route.useParams();
  const router = useRouter();
  useEffect(() => {
    console.error("[polls/$id] render error", {
      pollId: id,
      message: error?.message,
      stack: error?.stack,
    });
  }, [error, id]);
  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impossible d&apos;afficher ce sondage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Une erreur est survenue en affichant le sondage. Tu peux réessayer ou revenir à la
            liste.
          </p>
          {error?.message && (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{error.message}</pre>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              <RefreshCw className="size-4" /> Réessayer
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/polls">
                <ArrowLeft className="size-4" /> Retour aux sondages
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PollDetail() {
  const { id } = Route.useParams();
  const { data: me, isLoading: meLoading } = useCurrentUser();
  // Garde-fou d'autorisation explicite côté UI.
  // Source de vérité = serveur (requireSession + isFactionMember), mais on
  // vérifie aussi côté client pour masquer vote/édition aux rôles non autorisés.
  const canVote = hasPerm(me, "profile.self"); // accordée aux membres faction
  const canManage = hasPerm(me, "members.edit"); // staff faction uniquement
  const qc = useQueryClient();

  const getFn = useServerFn(getPoll);
  const voteFn = useServerFn(castVote);
  const closeFn = useServerFn(closePoll);
  const reopenFn = useServerFn(reopenPoll);

  const { data, isLoading, error } = useQuery({
    queryKey: ["poll", id],
    queryFn: () => getFn({ data: { id } }),
    retry: false,
    enabled: !meLoading && canVote,
    staleTime: 0,
  });

  const [myVotes, setMyVotes] = useState<Record<string, Choice>>({});
  const isQuestion = data?.poll?.kind === "question";

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
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const mClose = useMutation({
    mutationFn: (winningOptionId: string | null) =>
      closeFn({ data: { pollId: id, winningOptionId } }),
    onSuccess: () => {
      toast.success("Sondage clôturé");
      qc.invalidateQueries({ queryKey: ["poll", id] });
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const mReopen = useMutation({
    mutationFn: () => reopenFn({ data: { pollId: id } }),
    onSuccess: () => {
      toast.success("Sondage rouvert");
      qc.invalidateQueries({ queryKey: ["poll", id] });
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const tallies = useMemo(() => {
    if (!data)
      return {} as Record<string, { yes: number; maybe: number; no: number; score: number }>;
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
    if (!data) return [] as { id: string; name: string; choice?: Choice }[];
    const map = new Map<string, { name: string; choice?: Choice }>();
    for (const v of data.votes as any[]) {
      map.set(v.voter_discord_id, {
        name: v.voter_username ?? v.voter_discord_id,
        choice: v.choice as Choice,
      });
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, name: v.name, choice: v.choice }));
  }, [data]);

  // Liste des membres faction (utilisée pour l'import CSV des sondages planification).
  const membersFn = useServerFn(listMembers);
  const { data: membersData } = useQuery({
    queryKey: ["members", "active"],
    queryFn: () => membersFn({ data: { status: "active" } }),
    enabled: canManage,
  });
  const activeMembers = (membersData?.members ?? []) as any[];

  // Liste des membres du Discord privé pour calculer les non-votants.
  const eligibleFn = useServerFn(listPollEligibleVoters);
  const { data: eligibleData } = useQuery({
    queryKey: ["poll-eligible-voters"],
    queryFn: () => eligibleFn(),
    enabled: canManage,
    staleTime: 5 * 60 * 1000,
  });
  const eligibleMembers = (eligibleData?.members ?? []) as {
    discord_id: string;
    username: string;
  }[];

  const voterIds = useMemo(() => new Set(voters.map((v) => v.id)), [voters]);
  const nonVoters = useMemo(
    () => eligibleMembers.filter((m) => !voterIds.has(m.discord_id)),
    [eligibleMembers, voterIds],
  );

  if (meLoading || (isLoading && canVote)) return <DetailPageSkeleton />;

  // Garde UI : utilisateur connecté mais sans le rôle requis.
  if (!canVote) {
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4" /> Accès restreint
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Les sondages sont réservés aux membres de la faction. Si tu penses que c&apos;est une
              erreur, contacte un membre du staff sur Discord.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" /> Retour à l&apos;accueil
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const msg = String((error as any)?.message ?? "");
    const isForbidden = /FORBIDDEN|403|unauthor/i.test(msg);
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4" />
              {isForbidden ? "Accès restreint" : "Impossible de charger le sondage"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isForbidden
                ? "Ce sondage est réservé aux membres de la faction. Si tu penses que c'est une erreur, contacte un membre du staff."
                : "Une erreur est survenue en chargeant ce sondage. Réessaie dans un instant."}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={isForbidden ? "/" : "/polls"}>
                  <ArrowLeft className="size-4" />{" "}
                  {isForbidden ? "Retour à l'accueil" : "Retour aux sondages"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.poll) {
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sondage introuvable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ce sondage n&apos;existe plus ou a été supprimé.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/polls">
                <ArrowLeft className="size-4" /> Retour aux sondages
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const p = data.poll;
  const isOpen = p.status === "open";
  const winnerId = p.winning_option_id;
  const bestScore = Math.max(0, ...Object.values(tallies).map((t) => t.score));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/polls">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-pink-500 mb-1">
            <MonoLabel>// poll</MonoLabel>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk'" }}>
              {p.title}
            </h1>
            {isOpen ? (
              <Badge variant="secondary">Ouvert</Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" /> Clos
              </Badge>
            )}
          </div>
          {p.description && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {p.description}
            </p>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            Créé par {p.created_by_username ?? "—"} ·{" "}
            {new Date(p.created_at).toLocaleString("fr-FR")}
            {p.location && ` · 📍 ${p.location}`}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 justify-end">
            {isOpen && (
              <VotesImportDialog
                pollId={id}
                options={data.options as any[]}
                members={activeMembers}
                onDone={() => qc.invalidateQueries({ queryKey: ["poll", id] })}
              />
            )}
            {isOpen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => mClose.mutate(null)}
                disabled={mClose.isPending}
              >
                <Lock className="size-4" /> Clôturer
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => mReopen.mutate()}
                disabled={mReopen.isPending}
              >
                <RefreshCw className="size-4" /> Rouvrir
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isQuestion ? "Réponses possibles" : "Créneaux proposés"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">{isQuestion ? "Réponse" : "Créneau"}</th>
                  {isQuestion ? (
                    <th className="py-2 px-2 text-center">Votes</th>
                  ) : (
                    <>
                      <th className="py-2 px-2 text-center">Oui</th>
                      <th className="py-2 px-2 text-center">Peut-être</th>
                      <th className="py-2 px-2 text-center">Non</th>
                      <th className="py-2 px-2 text-center">Score</th>
                    </>
                  )}
                  {isOpen && <th className="py-2 pl-3 text-right">Mon vote</th>}
                  {!isOpen && canManage && <th className="py-2 pl-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {data.options.map((o: any) => {
                  const t = tallies[o.id] ?? { yes: 0, maybe: 0, no: 0, score: 0 };
                  const isWinner = winnerId === o.id;
                  const totalForOption = t.yes + t.maybe + t.no;
                  const isBest = !winnerId && t.score === bestScore && bestScore > 0;
                  const isMyChoice = isQuestion && Boolean(myVotes[o.id]);
                  return (
                    <tr
                      key={o.id}
                      className={`border-b border-border/50 ${isWinner ? "bg-primary/10" : ""}`}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          {isWinner && <Crown className="size-4 text-primary" />}
                          <div>
                            <div className="font-medium">
                              {isQuestion
                                ? o.label || "—"
                                : new Date(o.starts_at).toLocaleString("fr-FR", {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                            </div>
                            {!isQuestion && (
                              <div className="text-xs text-muted-foreground">
                                {o.duration_minutes} min
                                {isBest && !isWinner && " · meilleur score"}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {isQuestion ? (
                        <td className="text-center font-mono font-semibold">{totalForOption}</td>
                      ) : (
                        <>
                          <td className="text-center text-green-500 font-mono">{t.yes}</td>
                          <td className="text-center text-amber-500 font-mono">{t.maybe}</td>
                          <td className="text-center text-destructive font-mono">{t.no}</td>
                          <td className="text-center font-mono font-semibold">{t.score}</td>
                        </>
                      )}
                      {isOpen && (
                        <td className="py-2 pl-3">
                          <div className="flex gap-1 justify-end">
                            {isQuestion ? (
                              <Button
                                size="sm"
                                variant={isMyChoice ? "default" : "outline"}
                                onClick={() => setMyVotes({ [o.id]: "yes" })}
                              >
                                {isMyChoice ? (
                                  <>
                                    <Check className="size-4" /> Choisi
                                  </>
                                ) : (
                                  "Choisir"
                                )}
                              </Button>
                            ) : (
                              <>
                                <ChoiceBtn
                                  current={myVotes[o.id]}
                                  value="yes"
                                  onClick={() => setMyVotes({ ...myVotes, [o.id]: "yes" })}
                                />
                                <ChoiceBtn
                                  current={myVotes[o.id]}
                                  value="maybe"
                                  onClick={() => setMyVotes({ ...myVotes, [o.id]: "maybe" })}
                                />
                                <ChoiceBtn
                                  current={myVotes[o.id]}
                                  value="no"
                                  onClick={() => setMyVotes({ ...myVotes, [o.id]: "no" })}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      )}
                      {!isOpen && canManage && (
                        <td className="py-2 pl-3 text-right">
                          {!isWinner && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => mClose.mutate(o.id)}
                              disabled={mClose.isPending}
                            >
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
              <Button
                onClick={() => mVote.mutate()}
                disabled={Object.keys(myVotes).length === 0 || mVote.isPending}
              >
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
                <Badge key={v.id} variant="secondary" className="text-xs">
                  {v.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && nonVoters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="size-4" /> N&apos;ont pas encore voté ({nonVoters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {nonVoters.map((m) => (
                <Badge key={m.discord_id} variant="outline" className="text-xs">
                  {m.username || m.discord_id}
                </Badge>
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

/* ------------------------- Votes import (matrix CSV) --------------------- */

type ImportRow = {
  name: string;
  email: string | null;
  /** undefined = pas encore choisi, "" = ignorer ce nom, sinon discord_id */
  memberId: string | undefined;
  choices: { optionId: string; choice: CsvChoice }[];
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function VotesImportDialog({
  pollId,
  options,
  members,
  onDone,
}: {
  pollId: string;
  options: any[];
  members: any[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<MatrixResult | null>(null);
  const [matched, setMatched] = useState<{ slotIdx: number; optionId: string }[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const importFn = useServerFn(importPollVotes);

  const reset = () => {
    setParsed(null);
    setMatched([]);
    setRows([]);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const p = parsePollCsv(text);
      if (p.mode !== "matrix") {
        toast.error("CSV non reconnu — attendu : Nom, E-mail, créneau 1, créneau 2…");
        return;
      }
      // Match slots to options
      const optByTs = new Map<number, string>();
      for (const o of options) {
        optByTs.set(new Date(o.starts_at).getTime(), o.id);
      }
      const m: { slotIdx: number; optionId: string }[] = [];
      p.slots.forEach((s, idx) => {
        const ts = new Date(s.isoLocal).getTime();
        const oid = optByTs.get(ts);
        if (oid) m.push({ slotIdx: idx, optionId: oid });
      });
      if (!m.length) {
        toast.error("Aucun créneau du CSV ne correspond aux créneaux du sondage");
        return;
      }

      // Auto-map voters by name
      const memberByKey = new Map<string, any>();
      for (const mem of members) {
        if (mem.ig_name) memberByKey.set(normalize(mem.ig_name), mem);
        if (mem.discord_username) memberByKey.set(normalize(mem.discord_username), mem);
      }

      const importRows: ImportRow[] = p.rows.map((r) => {
        const key = normalize(r.name);
        const guess = memberByKey.get(key);
        const choices = m
          .map(({ slotIdx, optionId }) => {
            const c = r.choices[slotIdx];
            return c ? { optionId, choice: c } : null;
          })
          .filter((x): x is { optionId: string; choice: CsvChoice } => x !== null);
        return {
          name: r.name,
          email: r.email,
          memberId: guess?.discord_id,
          choices,
        };
      });

      setParsed(p);
      setMatched(m);
      setRows(importRows);
      toast.success(
        `${m.length}/${p.slots.length} créneaux matchés, ${importRows.length} votants à mapper`,
      );
    };
    reader.readAsText(file);
  };

  const submit = async () => {
    const voters = rows
      .filter((r) => r.memberId && r.choices.length > 0)
      .map((r) => {
        const mem = members.find((m) => m.discord_id === r.memberId)!;
        return {
          discordId: r.memberId!,
          username: mem.discord_username || mem.ig_name || r.name,
          choices: r.choices,
        };
      });
    if (!voters.length) {
      toast.error("Aucun votant mappé à un membre");
      return;
    }
    setSubmitting(true);
    try {
      const res = await importFn({ data: { pollId, voters } });
      toast.success(`${res.voters} membres importés (${res.votes} votes)`);
      setOpen(false);
      reset();
      onDone();
    } catch (e: any) {
      toast.error(toUserMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const mappedCount = rows.filter((r) => r.memberId && r.choices.length > 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" /> Importer votes CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer les votes depuis un CSV</DialogTitle>
          <DialogDescription>
            Accepte un export Framadate / Google Forms (matrice <code>Nom, E-mail, créneau 1…</code>
            ). Les créneaux sont matchés automatiquement, à toi d&apos;associer chaque ligne du CSV
            à un membre de la faction.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="py-6 text-center">
            <input
              id="votes-csv"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => document.getElementById("votes-csv")?.click()}>
              <Upload className="size-4" /> Choisir un fichier CSV
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {matched.length}/{parsed.slots.length} créneaux matchés · {mappedCount}/{rows.length}{" "}
              votants prêts à importer
            </div>
            <div className="max-h-[50vh] overflow-y-auto border border-border rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 px-3">Nom CSV</th>
                    <th className="py-2 px-3">Membre faction</th>
                    <th className="py-2 px-3 text-right">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        <div className="font-medium">{r.name}</div>
                        {r.email && (
                          <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <Select
                          value={r.memberId ?? "__skip__"}
                          onValueChange={(v) => {
                            const next = [...rows];
                            next[i] = { ...next[i], memberId: v === "__skip__" ? undefined : v };
                            setRows(next);
                          }}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">
                              <span className="text-muted-foreground">Ignorer</span>
                            </SelectItem>
                            {members.map((m) => (
                              <SelectItem key={m.discord_id} value={m.discord_id}>
                                {m.ig_name || m.discord_username || m.discord_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{r.choices.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          {parsed && (
            <Button onClick={submit} disabled={submitting || mappedCount === 0}>
              Importer {mappedCount} votant{mappedCount > 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
