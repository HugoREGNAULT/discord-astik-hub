import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  PageHeader,
  PageCard,
  LoadingBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import {
  listTrials,
  getTrialPanel,
  setMentor,
  castTrialVote,
  decideTrial,
} from "@/lib/data/trial.functions";

export const Route = createFileRoute("/_authenticated/trials")({
  head: () => ({ meta: [{ title: "Périodes d'essai · Staff" }] }),
  component: () => (
    <Guard perm="recruit.access">
      <TrialsPage />
    </Guard>
  ),
});

function TrialsPage() {
  const ls = useServerFn(listTrials);
  const { data, isLoading } = useQuery({
    queryKey: ["trials"],
    queryFn: () => ls(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const trials = data?.trials ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        code="// staff / trials"
        title="Périodes d'essai"
        description="Recrues en cours de période d'essai, votes et titularisation."
      />

      {isLoading ? (
        <LoadingBlock />
      ) : trials.length === 0 ? (
        <PageCard>
          <EmptyBlock label="Aucune recrue en période d'essai" />
        </PageCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trials.map((t) => {
            const pct =
              t.tasks.total > 0
                ? Math.round((t.tasks.done / t.tasks.total) * 100)
                : 0;
            return (
              <Card
                key={t.discord_id}
                className={
                  selected === t.discord_id ? "border-pink-500" : undefined
                }
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  {t.avatar_url ? (
                    <img
                      src={t.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800" />
                  )}
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {t.ig_name ?? t.discord_username ?? t.discord_id}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {t.days_left !== null
                        ? `${t.days_left} j restants`
                        : "—"}
                      {t.mentor_discord_id
                        ? ` · mentor <@${t.mentor_discord_id}>`
                        : " · pas de mentor"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="secondary">✅ {t.votes.keep}</Badge>
                    <Badge variant="destructive">❌ {t.votes.reject}</Badge>
                    <Badge variant="outline">— {t.votes.abstain}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Onboarding : {t.tasks.done}/{t.tasks.total}
                    </div>
                    <Progress value={pct} />
                  </div>
                  <Button
                    size="sm"
                    variant={selected === t.discord_id ? "default" : "outline"}
                    onClick={() =>
                      setSelected(
                        selected === t.discord_id ? null : t.discord_id,
                      )
                    }
                  >
                    {selected === t.discord_id ? "Fermer" : "Ouvrir le panneau"}
                  </Button>
                  {selected === t.discord_id && (
                    <TrialPanel memberDiscordId={t.discord_id} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrialPanel({ memberDiscordId }: { memberDiscordId: string }) {
  const qc = useQueryClient();
  const getPanel = useServerFn(getTrialPanel);
  const voteFn = useServerFn(castTrialVote);
  const decideFn = useServerFn(decideTrial);
  const mentorFn = useServerFn(setMentor);
  const user = useCurrentUser().data;

  const { data, isLoading } = useQuery({
    queryKey: ["trial-panel", memberDiscordId],
    queryFn: () => getPanel({ data: { memberDiscordId } }),
  });

  const [vote, setVote] = useState<"keep" | "reject" | "abstain">("keep");
  const [comment, setComment] = useState("");
  const [mentor, setMentorVal] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["trials"] });
    qc.invalidateQueries({ queryKey: ["trial-panel", memberDiscordId] });
  };

  const voteMut = useMutation({
    mutationFn: () =>
      voteFn({ data: { memberDiscordId, vote, comment: comment || undefined } }),
    onSuccess: () => {
      toast.success("Vote enregistré");
      setComment("");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const decideMut = useMutation({
    mutationFn: (outcome: "keep" | "reject") =>
      decideFn({ data: { memberDiscordId, outcome } }),
    onSuccess: () => {
      toast.success("Décision enregistrée");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const mentorMut = useMutation({
    mutationFn: () =>
      mentorFn({
        data: { memberDiscordId, mentorDiscordId: mentor.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Mentor mis à jour");
      setMentor("");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (isLoading || !data) return <LoadingBlock />;

  const isStaffFaction =
    !!user && hasPerm(user, "members.edit"); // proxy permission gate (UI only)

  return (
    <div className="space-y-4 pt-2 border-t border-zinc-800">
      {/* Onboarding tasks */}
      <div>
        <div className="text-xs uppercase text-zinc-500 mb-2">Tâches</div>
        <ul className="space-y-1 text-sm">
          {data.tasks.map((t: any) => (
            <li key={t.id} className="flex items-center gap-2">
              <span>{t.done ? "✅" : "⬜"}</span>
              <span className={t.done ? "line-through text-zinc-500" : ""}>
                {t.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Mentor */}
      <div className="flex gap-2">
        <Input
          placeholder="Discord ID du mentor"
          value={mentor}
          onChange={(e) => setMentorVal(e.target.value)}
        />
        <Button
          size="sm"
          onClick={() => mentorMut.mutate()}
          disabled={mentorMut.isPending}
        >
          Mentor
        </Button>
      </div>

      {/* Vote panel — staff faction only */}
      {isStaffFaction && (
        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Voter</div>
          <div className="flex gap-1">
            {(["keep", "reject", "abstain"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={vote === v ? "default" : "outline"}
                onClick={() => setVote(v)}
              >
                {v === "keep" ? "Keep" : v === "reject" ? "Reject" : "Abstain"}
              </Button>
            ))}
          </div>
          <Textarea
            placeholder="Commentaire (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <Button
            size="sm"
            onClick={() => voteMut.mutate()}
            disabled={voteMut.isPending}
          >
            Soumettre vote
          </Button>
        </div>
      )}

      {/* Votes aggregate */}
      <div>
        <div className="text-xs uppercase text-zinc-500 mb-2">Votes</div>
        {data.votes.length === 0 ? (
          <p className="text-xs text-zinc-500">Aucun vote pour l'instant.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {data.votes.map((v: any) => (
              <li key={v.id} className="flex gap-2">
                <Badge variant="outline">{v.vote}</Badge>
                <span className="font-medium">{v.voter_username}</span>
                {v.comment && (
                  <span className="text-zinc-500">— {v.comment}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Final decision */}
      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <Button
          size="sm"
          onClick={() => decideMut.mutate("keep")}
          disabled={decideMut.isPending}
        >
          Titulariser
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => decideMut.mutate("reject")}
          disabled={decideMut.isPending}
        >
          Refuser
        </Button>
      </div>
    </div>
  );
}
