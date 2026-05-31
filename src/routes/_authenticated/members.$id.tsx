import { createFileRoute, Link } from "@tanstack/react-router";
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
import { MemberPointsHistory } from "@/components/members/MemberPointsHistory";
import { MemberDonationsPanel } from "@/components/members/MemberDonationsPanel";
import type {
  MemberPointsEntry,
  MemberDonationEntry,
  MemberRow,
} from "@/components/members/types";

export const Route = createFileRoute("/_authenticated/members/$id")({
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
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerHasMore, setLedgerHasMore] = useState(false);
  const [donations, setDonations] = useState<any[]>([]);
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
            <Link to="/me">Retour à mon profil</Link>
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
      <div className="flex items-center gap-4">
        {m.avatar_url ? (
          <img src={m.avatar_url} className="size-16 rounded-full" alt="" />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <div>
          <div className="text-pink-500 mb-1">
            <MonoLabel>// member</MonoLabel>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk'" }}>
            {m.ig_name ?? m.discord_username}
          </h1>
          <p className="text-sm text-muted-foreground">
            @{m.discord_username}
            {data.canEdit && ` · ${m.discord_id}`}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {isSelf && <Badge variant="outline">Toi</Badge>}
          <Badge variant="secondary">{m.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="AstikPoints" value={m.astik_points} accent />
        <Stat label="Grade" value={m.current_grade ?? "—"} />
        <Stat label="Arrivée" value={m.arrival_date ?? "—"} />
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold m-0">Comptes alts</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1">
            {data.alts.map((a: any) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-sm border border-border rounded px-3 py-2"
              >
                <span>{a.alt_name ?? a.alt_discord_id}</span>
                {data.canEdit && (
                  <ConfirmDialog
                    title={`Retirer l'alt "${a.alt_name ?? a.alt_discord_id}" ?`}
                    description="Le compte secondaire sera détaché de ce membre."
                    confirmLabel="Retirer"
                    onConfirm={async () => {
                      try {
                        await altRmFn({ data: { id: a.id } });
                        toast.success("Alt retiré");
                        refresh();
                      } catch (e) {
                        toast.error(toUserMessage(e));
                        throw e;
                      }
                    }}
                    trigger={
                      <button className="text-destructive text-xs">Supprimer</button>
                    }
                  />
                )}
              </li>
            ))}
            {data.alts.length === 0 && (
              <li>
                <EmptyState
                  title="Aucun alt"
                  description="Aucun compte secondaire déclaré."
                  variant="compact"
                />
              </li>
            )}
          </ul>
          {data.canEdit && (
            <div className="flex gap-2">
              <Input placeholder="Nom alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
              <Button onClick={() => mAlt.mutate()} disabled={!alt}>
                Ajouter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canViewNotes && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-semibold m-0">Notes staff</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {data.notes.map((n: any) => (
                <li key={n.id} className="text-sm border border-border rounded p-3">
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()} · {n.staff_username}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
                </li>
              ))}
              {data.notes.length === 0 && (
                <li>
                  <EmptyState
                    title="Aucune note"
                    description="Les notes staff sur ce membre apparaîtront ici."
                    variant="compact"
                  />
                </li>
              )}
            </ul>
            {canWriteNotes && (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Nouvelle note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button onClick={() => mNote.mutate()} disabled={!note} className="self-end">
                  Ajouter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewWarnings && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-semibold m-0">Avertissements</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {data.warnings.map((w: any) => (
                <li
                  key={w.id}
                  className="text-sm border border-destructive/50 bg-destructive/10 rounded p-3"
                >
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(w.created_at).toLocaleString()} · {w.staff_username}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{w.body}</div>
                </li>
              ))}
              {data.warnings.length === 0 && (
                <li>
                  <EmptyState
                    title="Aucun avertissement"
                    description="Aucune sanction enregistrée."
                    variant="compact"
                  />
                </li>
              )}
            </ul>
            {canWriteWarnings && (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Nouvel avertissement…"
                  value={warn}
                  onChange={(e) => setWarn(e.target.value)}
                />
                <Button
                  variant="destructive"
                  onClick={() => mWarn.mutate()}
                  disabled={!warn}
                  className="self-end"
                >
                  Avertir
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Coins className="size-4 text-primary" /> Historique points
              </span>
              <Badge variant="outline">{ledger.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ledger.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Coins}
                  title="Aucun mouvement"
                  description="L'historique de points apparaîtra ici."
                  variant="compact"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                {ledger.map((p: any) => (
                  <li key={p.id} className="px-4 py-2 text-sm flex items-center gap-3">
                    <span
                      className={`font-mono font-semibold w-16 text-right ${
                        p.amount >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {p.amount >= 0 ? "+" : ""}
                      {p.amount}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">
                        {p.action_type}
                        {p.reason ? ` · ${p.reason}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Par {p.staff_username ?? p.staff_discord_id} ·{" "}
                        {new Date(p.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      → {p.total_after}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ledgerHasMore && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => loadMorePoints.mutate()}
                  disabled={loadMorePoints.isPending}
                >
                  <ChevronDown className="size-4 mr-1" />
                  {loadMorePoints.isPending ? "Chargement…" : "Charger plus"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.canViewStaffData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-primary" /> Donations
              </span>
              <Badge variant="outline">{donations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {donations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={ShoppingCart}
                  title="Aucune donation"
                  description="Les donations valides s'afficheront ici."
                  variant="compact"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                {donations.map((d: any) => (
                  <li key={d.id} className="px-4 py-2 text-sm flex items-center gap-3">
                    <Badge
                      variant={
                        d.status === "validated"
                          ? "secondary"
                          : d.status === "active"
                            ? "default"
                            : "outline"
                      }
                    >
                      {d.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">
                        Brut {d.total_brut} · Bonus {Number(d.bonus_pct ?? 0)}% → final{" "}
                        <span className="font-semibold text-primary">{d.total_final}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {d.staff_username ?? "?"} · {new Date(d.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {donationsHasMore && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => loadMoreDonations.mutate()}
                  disabled={loadMoreDonations.isPending}
                >
                  <ChevronDown className="size-4 mr-1" />
                  {loadMoreDonations.isPending ? "Chargement…" : "Charger plus"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
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
