import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId, useEffect } from "react";
import {
  ShieldX,
  Coins,
  Activity,
  UserCheck,
  MessageSquare,
  Clock,
  UserX,
  UserPlus,
  Copy,
  ExternalLink,
} from "lucide-react";

import {
  getMemberDetail,
  updateMember,
  addNote,
  addWarning,
  addAlt,
  removeAlt,
  getMemberPointsHistory,
  getMemberDonations,
  markMemberAway,
  dmMember,
} from "@/lib/data/members.functions";
import { addPoints } from "@/lib/data/points.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GamificationCard } from "@/components/GamificationCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { DetailPageSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { MemberHeader } from "@/components/members/MemberHeader";
import { MemberAltsPanel } from "@/components/members/MemberAltsPanel";
import { MemberNotesPanel } from "@/components/members/MemberNotesPanel";
import { MemberWarningsPanel } from "@/components/members/MemberWarningsPanel";
import { DisciplinarySummaryCard } from "@/components/members/DisciplinarySummaryCard";
import { McStatsCard } from "@/components/members/McStatsCard";
import { MemberPointsHistory } from "@/components/members/MemberPointsHistory";
import { MemberDonationsPanel } from "@/components/members/MemberDonationsPanel";
import type {
  MemberPointsEntry,
  MemberDonationEntry,
} from "@/components/members/types";

export const Route = createFileRoute("/_authenticated/members/$id")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Profil membre · PunkAstik" }] }),
  component: MemberDetail,
});

function MemberDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const getDetail = useServerFn(getMemberDetail);
  const getPointsHistory = useServerFn(getMemberPointsHistory);
  const getDonationsFn = useServerFn(getMemberDonations);
  const update = useServerFn(updateMember);
  const noteFn = useServerFn(addNote);
  const warnFn = useServerFn(addWarning);
  const altAddFn = useServerFn(addAlt);
  const altRmFn = useServerFn(removeAlt);

  const { data, isLoading, error } = useQuery({
    queryKey: ["member", id],
    queryFn: () => getDetail({ data: { discordId: id } }),
    retry: false,
  });

  // Pagination states
  const [ledger, setLedger] = useState<MemberPointsEntry[]>([]);
  const [ledgerHasMore, setLedgerHasMore] = useState(false);
  const [donations, setDonations] = useState<MemberDonationEntry[]>([]);
  const [donationsHasMore, setDonationsHasMore] = useState(false);

  useEffect(() => {
    if (data) {
      setLedger(data.pointsLedger);
      setLedgerHasMore(data.pointsLedger.length >= 10);
      setDonations(data.donations);
      setDonationsHasMore(data.donations.length >= 10);
    }
  }, [data]);

  const [note, setNote] = useState("");
  const [warn, setWarn] = useState("");
  const [alt, setAlt] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["member", id] });

  const mNote = useMutation({
    mutationFn: () => noteFn({ data: { memberDiscordId: id, body: note } }),
    onSuccess: () => {
      setNote("");
      toast.success("Note ajoutée");
      refresh();
    },
  });
  const mWarn = useMutation({
    mutationFn: () => warnFn({ data: { memberDiscordId: id, body: warn } }),
    onSuccess: () => {
      setWarn("");
      toast.success("Avertissement ajouté");
      refresh();
    },
  });
  const mAlt = useMutation({
    mutationFn: () => altAddFn({ data: { memberDiscordId: id, altName: alt } }),
    onSuccess: () => {
      setAlt("");
      toast.success("Alt ajouté");
      refresh();
    },
  });

  const loadMorePoints = useMutation({
    mutationFn: () => getPointsHistory({ data: { discordId: id, offset: ledger.length } }),
    onSuccess: (res) => {
      setLedger((prev) => [...prev, ...res.items]);
      setLedgerHasMore(res.hasMore);
    },
  });
  const loadMoreDonations = useMutation({
    mutationFn: () => getDonationsFn({ data: { discordId: id, offset: donations.length } }),
    onSuccess: (res) => {
      setDonations((prev) => [...prev, ...res.items]);
      setDonationsHasMore(res.hasMore);
    },
  });

  if (isLoading) return <DetailPageSkeleton />;
  if (error) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldX className="size-5" /> Accès refusé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tu n'as pas les permissions pour consulter ce profil membre.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Retour au classement</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!data?.member) return <p>Membre introuvable.</p>;

  const m = data.member;
  const isSelf = me?.discordId === m.discord_id;
  const canViewNotes = hasPerm(me, "notes.view");
  const canWriteNotes = hasPerm(me, "notes.write");
  const canViewWarnings = hasPerm(me, "warnings.view");
  const canWriteWarnings = hasPerm(me, "warnings.write");

  return (
    <div className="space-y-6 max-w-4xl">
      <MemberHeader member={m} isSelf={isSelf} canShowDiscordId={!!data.canEdit} />

      {data.canEdit && (
        <MemberActions member={m} canManagePoints={!!data.canManagePoints} onChanged={refresh} />
      )}

      {data.canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-semibold m-0">Éditer</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditForm
              member={m}
              onSave={async (patch) => {
                try {
                  await update({ data: { discordId: id, patch } });
                  toast.success("Membre mis à jour");
                  refresh();
                } catch (e) {
                  toast.error(toUserMessage(e));
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      <MemberAltsPanel
        alts={data.alts}
        canEdit={!!data.canEdit}
        altInput={alt}
        onAltInputChange={setAlt}
        onAdd={() => mAlt.mutate()}
        onRemove={async (a) => {
          try {
            await altRmFn({ data: { id: a.id } });
            toast.success("Alt retiré");
            refresh();
          } catch (e) {
            toast.error(toUserMessage(e));
            throw e;
          }
        }}
      />

      {canViewNotes && (
        <MemberNotesPanel
          notes={data.notes}
          canWrite={canWriteNotes}
          noteInput={note}
          onNoteInputChange={setNote}
          onAdd={() => mNote.mutate()}
        />
      )}

      {canViewWarnings && (
        <>
          <MemberWarningsPanel
            warnings={data.warnings}
            canWrite={canWriteWarnings}
            warnInput={warn}
            onWarnInputChange={setWarn}
            onAdd={() => mWarn.mutate()}
          />
          <DisciplinarySummaryCard discordId={data.member.discord_id} />
        </>
      )}

      <GamificationCard scope="member" discordId={data.member.discord_id} />

      {data.canViewStaffData && data.recruiter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCheck className="size-4 text-primary" /> Recruteur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/members/$id"
              params={{ id: data.recruiter.discord_id }}
              className="text-sm hover:text-primary"
            >
              {data.recruiter.ig_name ??
                data.recruiter.discord_username ??
                data.recruiter.discord_id}
              <span className="text-xs text-muted-foreground ml-2">
                @{data.recruiter.discord_username ?? "—"}
              </span>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.canViewStaffData && (
        <MemberPointsHistory
          items={ledger}
          hasMore={ledgerHasMore}
          onLoadMore={() => loadMorePoints.mutate()}
          isLoadingMore={loadMorePoints.isPending}
        />
      )}

      {data.canViewStaffData && (
        <MemberDonationsPanel
          items={donations}
          hasMore={donationsHasMore}
          onLoadMore={() => loadMoreDonations.mutate()}
          isLoadingMore={loadMoreDonations.isPending}
        />
      )}

      {data.canViewStaffData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Activité staff sur ce membre
              </span>
              <Badge variant="outline">{data.staffActivity.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.staffActivity.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Activity}
                  title="Aucune action enregistrée"
                  description="Les actions du staff sur ce membre apparaîtront ici."
                  variant="compact"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                {data.staffActivity.map((l: any) => (
                  <li key={l.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono">{l.action}</code>
                      {l.actor_discord_id && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          par {l.actor_discord_id}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(l.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    {l.payload && Object.keys(l.payload).length > 0 && (
                      <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {JSON.stringify(l.payload)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}



function EditForm({ member, onSave }: { member: any; onSave: (p: any) => void }) {
  const reactId = useId();
  const [p, setP] = useState({
    ig_name: member.ig_name ?? "",
    arrival_date: member.arrival_date ?? "",
    current_grade: member.current_grade ?? "",
    last_rankup: member.last_rankup ?? "",
    recruiter_discord_id: member.recruiter_discord_id ?? "",
    status: member.status,
  });
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {(
        ["ig_name", "current_grade", "arrival_date", "last_rankup", "recruiter_discord_id"] as const
      ).map((k) => {
        const fid = `${reactId}-${k}`;
        return (
          <div key={k}>
            <label htmlFor={fid} className="text-xs text-muted-foreground">
              {k}
            </label>
            <Input
              id={fid}
              value={(p as any)[k] ?? ""}
              onChange={(e) => setP({ ...p, [k]: e.target.value })}
            />
          </div>
        );
      })}
      <div>
        <label htmlFor={`${reactId}-status`} className="text-xs text-muted-foreground">
          status
        </label>
        <select
          id={`${reactId}-status`}
          className="w-full bg-input rounded-md px-3 py-2 text-sm border border-border"
          value={p.status}
          onChange={(e) => setP({ ...p, status: e.target.value })}
        >
          <option value="active">active</option>
          <option value="away">away</option>
          <option value="former">former</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Button onClick={() => onSave(p)}>Enregistrer</Button>
      </div>
    </div>
  );
}

function MemberActions({
  member,
  canManagePoints,
  onChanged,
}: {
  member: any;
  canManagePoints: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const dmFn = useServerFn(dmMember);
  const awayFn = useServerFn(markMemberAway);
  const updateFn = useServerFn(updateMember);
  const pointsFn = useServerFn(addPoints);

  const [dmOpen, setDmOpen] = useState(false);
  const [dmContent, setDmContent] = useState(
    `Salut ${member.ig_name ?? member.discord_username ?? ""} 👋\n\n`,
  );
  const [pointsAmount, setPointsAmount] = useState<string>("");
  const [pointsReason, setPointsReason] = useState<string>("");
  const [grade, setGrade] = useState<string>(member.current_grade ?? "");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["member", member.discord_id] });
    onChanged();
  };

  const mDm = useMutation({
    mutationFn: () => dmFn({ data: { memberDiscordId: member.discord_id, content: dmContent } }),
    onSuccess: () => {
      toast.success("MP envoyé");
      setDmOpen(false);
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const mAway = useMutation({
    mutationFn: () => awayFn({ data: { memberDiscordId: member.discord_id } }),
    onSuccess: () => {
      toast.success("Marqué en absence");
      refresh();
    },
  });

  const mStatus = useMutation({
    mutationFn: (status: "active" | "away" | "former") =>
      updateFn({ data: { discordId: member.discord_id, patch: { status } } }),
    onSuccess: (_d, status) => {
      toast.success(`Statut: ${status}`);
      refresh();
    },
  });

  const mPoints = useMutation({
    mutationFn: (amount: number) =>
      pointsFn({
        data: {
          memberDiscordId: member.discord_id,
          amount,
          reason: pointsReason || undefined,
          bonusPct: 0,
        },
      }),
    onSuccess: (_r, amount) => {
      toast.success(`${amount > 0 ? "+" : ""}${amount} points`);
      setPointsAmount("");
      setPointsReason("");
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const mGrade = useMutation({
    mutationFn: () =>
      updateFn({ data: { discordId: member.discord_id, patch: { current_grade: grade || null } } }),
    onSuccess: () => {
      toast.success("Grade mis à jour");
      refresh();
    },
  });

  const copyId = () => {
    navigator.clipboard.writeText(member.discord_id);
    toast.success("ID Discord copié");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Actions staff</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Dialog open={dmOpen} onOpenChange={setDmOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="default">
              <MessageSquare className="size-4 mr-1.5" /> Envoyer un MP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>MP à {member.ig_name ?? member.discord_username}</DialogTitle>
            </DialogHeader>
            <Textarea
              rows={8}
              value={dmContent}
              onChange={(e) => setDmContent(e.target.value)}
              placeholder="Message…"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDmOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => mDm.mutate()} disabled={!dmContent.trim() || mDm.isPending}>
                {mDm.isPending ? "Envoi…" : "Envoyer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {member.status !== "away" && (
          <ConfirmDialog
            title="Marquer ce membre en absence ?"
            description="Le statut passera à 'absent'."
            confirmLabel="Marquer absent"
            destructive={false}
            onConfirm={async () => {
              await mAway.mutateAsync();
            }}
            trigger={
              <Button size="sm" variant="outline" disabled={mAway.isPending}>
                <Clock className="size-4 mr-1.5" /> Marquer en absence
              </Button>
            }
          />
        )}

        {member.status !== "active" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => mStatus.mutate("active")}
            disabled={mStatus.isPending}
          >
            <UserPlus className="size-4 mr-1.5" /> Réactiver
          </Button>
        )}

        {member.status !== "former" && (
          <ConfirmDialog
            title="Marquer ce membre comme ancien ?"
            description="Le membre sera déplacé dans la liste des anciens."
            confirmLabel="Marquer ancien"
            onConfirm={async () => {
              await mStatus.mutateAsync("former");
            }}
            trigger={
              <Button
                size="sm"
                variant="outline"
                disabled={mStatus.isPending}
                className="text-destructive hover:text-destructive"
              >
                <UserX className="size-4 mr-1.5" /> Marquer ancien
              </Button>
            }
          />
        )}

        <Button size="sm" variant="ghost" onClick={copyId}>
          <Copy className="size-4 mr-1.5" /> Copier ID
        </Button>

        <Button size="sm" variant="ghost" asChild>
          <a
            href={`discord://discordapp.com/users/${member.discord_id}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4 mr-1.5" /> Ouvrir dans Discord
          </a>
        </Button>

        <div className="w-full flex flex-wrap items-end gap-2 pt-3 mt-2 border-t border-border">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Grade
            </label>
            <Input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="ex: Vétéran"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mGrade.mutate()}
            disabled={mGrade.isPending || grade === (member.current_grade ?? "")}
          >
            {mGrade.isPending ? "…" : "Changer grade"}
          </Button>
        </div>

        {canManagePoints && (
          <div className="w-full flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Points
              </label>
              <Input
                type="number"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="±N"
                className="h-9"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Raison
              </label>
              <Input
                value={pointsReason}
                onChange={(e) => setPointsReason(e.target.value)}
                placeholder="optionnel"
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                const n = parseInt(pointsAmount, 10);
                if (!Number.isFinite(n) || n === 0) {
                  toast.error("Montant invalide");
                  return;
                }
                mPoints.mutate(n);
              }}
              disabled={mPoints.isPending || !pointsAmount}
            >
              <Coins className="size-4 mr-1.5" />
              {mPoints.isPending ? "…" : "Appliquer"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
