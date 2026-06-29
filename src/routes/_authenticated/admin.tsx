import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageCard, SectionLabel, DaButton } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Pencil, ExternalLink } from "lucide-react";

import { getAdminOverview, backfillArrivalDates } from "@/lib/data/admin.functions";
import { syncMembersFromDiscord } from "@/lib/data/members-sync.functions";
import { listMembers, updateMember } from "@/lib/data/members.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MinecraftSkin } from "@/components/MinecraftSkin";
import { MemberRowsSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Users as UsersIcon, FileText as FileTextIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · PunkAstik" }] }),
  component: () => (
    <Guard perm="admin.access">
      <AdminPage />
    </Guard>
  ),
});

function AdminPage() {
  const fn = useServerFn(getAdminOverview);
  const { data } = useQuery({
    queryKey: ["admin"],
    queryFn: () => fn(),
    staleTime: 0,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        code="// admin"
        title="Admin"
        description="Console d'administration de la faction."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Membres" value={data?.profilesCount ?? "—"} />
        <Stat label="Paniers actifs" value={data?.activeCarts ?? "—"} />
        <Stat
          label="Discord API"
          value={data?.discord.ok ? `OK ${data.discord.latencyMs}ms` : "DOWN"}
          ok={data?.discord.ok}
        />
        <Stat
          label="Dernier refresh rôles"
          value={data?.lastRoleRefresh ? new Date(data.lastRoleRefresh).toLocaleTimeString() : "—"}
        />
      </div>

      <MembersAdminSection />

      <MaintenanceCard />

      <Card>
        <CardHeader>
          <CardTitle>Erreurs récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <LogList items={data?.recentErrors ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs récents</CardTitle>
        </CardHeader>
        <CardContent>
          <LogList items={data?.recentLogs ?? []} />
        </CardContent>
      </Card>

      <SyncPanel />
    </div>
  );
}

/* ---------- Maintenance ---------- */

function MaintenanceCard() {
  const queryClient = useQueryClient();
  const backfillFn = useServerFn(backfillArrivalDates);
  const mutation = useMutation({
    mutationFn: () => backfillFn(),
    onSuccess: (r) => {
      toast.success(
        `Dates d'arrivée : ${r.updated} corrigée(s), ${r.notFound} introuvable(s), ${r.failed} échec(s) sur ${r.scanned} membre(s).`,
      );
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Corriger les dates d'arrivée</div>
            <p className="text-xs text-muted-foreground">
              Renseigne la date d'arrivée manquante de chaque membre faction depuis son entrée sur
              le serveur privé (Discord faction). N'écrase jamais une date déjà définie.
            </p>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Correction…" : "Corriger"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Sync membres Discord ---------- */

function SyncPanel() {
  const syncFn = useServerFn(syncMembersFromDiscord);
  const qc = useQueryClient();
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
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <PageCard>
      <SectionLabel>synchronisation membres</SectionLabel>
      <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "'Space Mono'" }}>
        Compare la table membres avec le rôle Discord{" "}
        <span className="text-primary font-mono">MEMBER_FACTION</span> sur le serveur faction.
        Ajoute les absents, archive ceux qui n'ont plus le rôle, met à jour les pseudos.
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        <DaButton variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Synchronisation…" : "↻ Resynchroniser les membres"}
        </DaButton>
        {result && !mutation.isPending && (
          <div className="flex gap-4 text-sm flex-wrap" style={{ fontFamily: "'Space Mono'" }}>
            <span className="text-emerald-400">+{result.added} ajoutés</span>
            <span className="text-amber-400">⤴ {result.reactivated} réactivés</span>
            <span className="text-sky-400">~ {result.updated} mis à jour</span>
            <span className="text-red-400">✕ {result.archived} archivés</span>
            {result.failed > 0 && <span className="text-red-400">⚠ {result.failed} échecs</span>}
          </div>
        )}
      </div>
    </PageCard>
  );
}

/* ---------- Gestion membres ---------- */

type MemberRow = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  mc_uuid: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  arrival_date: string | null;
  last_rankup: string | null;
  recruiter_discord_id: string | null;
  status: string;
  astik_points: number;
};

function MembersAdminSection() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "former" | "all">("all");
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const fn = useServerFn(listMembers);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-members", q, status],
    queryFn: () => fn({ data: { q, status } }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Gestion membres</span>
          <Badge variant="secondary">{data?.members.length ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Rechercher (pseudo, IG, Discord ID)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-1">
            {(["active", "former", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  status === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {s === "active" ? "Actifs" : s === "former" ? "Anciens" : "Tous"}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <MemberRowsSkeleton count={6} />}

        <div className="grid gap-1.5 max-h-[480px] overflow-y-auto pr-1">
          {data?.members.map((m) => (
            <div
              key={m.discord_id}
              className="flex items-center gap-3 border border-border rounded-md p-2 hover:border-primary/40 transition"
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="size-9 rounded-full" />
              ) : (
                <div className="size-9 rounded-full bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {m.ig_name ?? m.discord_username ?? m.discord_id}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  @{m.discord_username ?? "—"} · {m.current_grade ?? "—"} · {m.discord_id}
                </div>
              </div>
              <Badge variant={m.status === "active" ? "secondary" : "outline"}>{m.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => setEditing(m as MemberRow)}>
                <Pencil className="size-3.5 mr-1" /> Éditer
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/members/$id" params={{ id: m.discord_id }}>
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </div>
          ))}
          {data && data.members.length === 0 && (
            <EmptyState
              icon={UsersIcon}
              title="Aucun membre"
              description="Aucun membre ne correspond à ta recherche."
              variant="compact"
            />
          )}
        </div>
      </CardContent>

      <EditMemberDialog member={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function EditMemberDialog({ member, onClose }: { member: MemberRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateMember);

  const [patch, setPatch] = useState<Record<string, string>>({});

  // Reset local state when opening a new member
  const open = !!member;
  if (member && Object.keys(patch).length === 0) {
    // initialize once per opening
    // (cheap pattern: rely on key prop below to reset)
  }

  const mutation = useMutation({
    mutationFn: (p: Record<string, any>) =>
      updateFn({ data: { discordId: member!.discord_id, patch: p } }),
    onSuccess: () => {
      toast.success("Membre mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member", member?.discord_id] });
      onClose();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (!member) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPatch({});
          onClose();
        }
      }}
    >
      <DialogContent
        // Reset state when member changes
        key={member.discord_id}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            Éditer {member.ig_name ?? member.discord_username ?? member.discord_id}
          </DialogTitle>
          <DialogDescription>
            Modifications appliquées immédiatement. Une trace est gardée dans les logs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 items-start">
          <MinecraftSkin
            uuid={(patch.mc_uuid ?? member.mc_uuid) || undefined}
            username={(patch.ig_name ?? member.ig_name) || undefined}
            alt={`Skin ${member.ig_name ?? ""}`}
            className="h-40 w-auto object-contain shrink-0"
          />
          <div className="flex-1 grid sm:grid-cols-2 gap-3">
            <FormField
              label="Pseudo IG"
              defaultValue={member.ig_name ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, ig_name: v }))}
            />
            <FormField
              label="Pseudo Discord"
              defaultValue={member.discord_username ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, discord_username: v }))}
            />
            <FormField
              label="UUID Minecraft"
              defaultValue={member.mc_uuid ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, mc_uuid: v }))}
            />
            <FormField
              label="Grade"
              defaultValue={member.current_grade ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, current_grade: v }))}
            />
            <FormField
              label="Date d'arrivée"
              type="date"
              defaultValue={member.arrival_date ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, arrival_date: v }))}
            />
            <FormField
              label="Dernier rankup"
              type="date"
              defaultValue={member.last_rankup ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, last_rankup: v }))}
            />
            <FormField
              label="Recruteur (Discord ID)"
              defaultValue={member.recruiter_discord_id ?? ""}
              onChange={(v) => setPatch((p) => ({ ...p, recruiter_discord_id: v }))}
            />
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <select
                defaultValue={member.status}
                className="w-full bg-input rounded-md px-3 py-2 text-sm border border-border"
                onChange={(e) => setPatch((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="active">Actif</option>
                <option value="former">Ancien</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={Object.keys(patch).length === 0 || mutation.isPending}
            onClick={() => {
              // Normalize empty strings to null for nullable fields
              const cleaned: Record<string, any> = {};
              for (const [k, v] of Object.entries(patch)) {
                cleaned[k] = v === "" ? null : v;
              }
              mutation.mutate(cleaned);
            }}
          >
            {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  defaultValue,
  type = "text",
  onChange,
}: {
  label: string;
  defaultValue: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type={type} defaultValue={defaultValue} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- bas: stats & logs ---------- */

function Stat({ label, value, ok }: { label: string; value: any; ok?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-xl font-bold ${
            ok === false ? "text-destructive" : ok ? "text-success" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function LogList({ items }: { items: any[] }) {
  if (!items.length)
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Aucun log"
        description="Aucune entrée pour ce filtre."
        variant="compact"
      />
    );
  return (
    <ul className="divide-y divide-border text-sm">
      {items.map((l) => (
        <li key={l.id} className="py-2 flex items-start gap-2">
          <Badge
            variant={
              l.level === "error" ? "destructive" : l.level === "warn" ? "secondary" : "default"
            }
          >
            {l.level}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">
              {new Date(l.created_at).toLocaleString()} · {l.actor_discord_id ?? "system"}
            </div>
            <div className="font-mono text-xs truncate">
              {l.action}{" "}
              {l.payload && Object.keys(l.payload).length > 0 ? JSON.stringify(l.payload) : ""}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
