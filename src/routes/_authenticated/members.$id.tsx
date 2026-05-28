import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";
import { ShieldX } from "lucide-react";

import { getMemberDetail, updateMember, addNote, addWarning, addAlt, removeAlt } from "@/lib/data/members.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/members/$id")({
  head: () => ({ meta: [{ title: "Profil membre · PunkAstik" }] }),
  component: MemberDetail,
});

function MemberDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const getDetail = useServerFn(getMemberDetail);
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

  const [note, setNote] = useState("");
  const [warn, setWarn] = useState("");
  const [alt, setAlt] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["member", id] });

  const mNote = useMutation({
    mutationFn: () => noteFn({ data: { memberDiscordId: id, body: note } }),
    onSuccess: () => { setNote(""); toast.success("Note ajoutée"); refresh(); },
  });
  const mWarn = useMutation({
    mutationFn: () => warnFn({ data: { memberDiscordId: id, body: warn } }),
    onSuccess: () => { setWarn(""); toast.success("Avertissement ajouté"); refresh(); },
  });
  const mAlt = useMutation({
    mutationFn: () => altAddFn({ data: { memberDiscordId: id, altName: alt } }),
    onSuccess: () => { setAlt(""); toast.success("Alt ajouté"); refresh(); },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
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
          <Button asChild variant="outline" size="sm"><Link to="/me">Retour à mon profil</Link></Button>
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
        {m.avatar_url ? <img src={m.avatar_url} className="size-16 rounded-full" alt="" /> : <div className="size-16 rounded-full bg-muted" />}
        <div>
          <h1 className="text-2xl font-bold">{m.ig_name ?? m.discord_username}</h1>
          <p className="text-sm text-muted-foreground">@{m.discord_username}{data.canEdit && ` · ${m.discord_id}`}</p>
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
        <Card>
          <CardHeader><CardTitle><h2 className="text-lg font-semibold m-0">Éditer</h2></CardTitle></CardHeader>
          <CardContent>
            <EditForm member={m} onSave={async (patch) => {
              await update({ data: { discordId: id, patch } });
              toast.success("Membre mis à jour"); refresh();
            }} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle><h2 className="text-lg font-semibold m-0">Comptes alts</h2></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1">
            {data.alts.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between text-sm border border-border rounded px-3 py-2">
                <span>{a.alt_name ?? a.alt_discord_id}</span>
                {data.canEdit && (
                  <button onClick={async () => { await altRmFn({ data: { id: a.id } }); refresh(); }} className="text-destructive text-xs">Supprimer</button>
                )}
              </li>
            ))}
            {data.alts.length === 0 && <li className="text-sm text-muted-foreground">Aucun alt.</li>}
          </ul>
          {data.canEdit && (
            <div className="flex gap-2">
              <Input placeholder="Nom alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
              <Button onClick={() => mAlt.mutate()} disabled={!alt}>Ajouter</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><h2 className="text-lg font-semibold m-0">Notes staff</h2></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {data.notes.map((n: any) => (
              <li key={n.id} className="text-sm border border-border rounded p-3">
                <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()} · {n.staff_username}</div>
                <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
            {data.notes.length === 0 && <li className="text-sm text-muted-foreground">Aucune note.</li>}
          </ul>
          <div className="flex flex-col gap-2">
            <Textarea placeholder="Nouvelle note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button onClick={() => mNote.mutate()} disabled={!note} className="self-end">Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><h2 className="text-lg font-semibold m-0">Avertissements</h2></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {data.warnings.map((w: any) => (
              <li key={w.id} className="text-sm border border-destructive/50 bg-destructive/10 rounded p-3">
                <div className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleString()} · {w.staff_username}</div>
                <div className="mt-1 whitespace-pre-wrap">{w.body}</div>
              </li>
            ))}
            {data.warnings.length === 0 && <li className="text-sm text-muted-foreground">Aucun avertissement.</li>}
          </ul>
          <div className="flex flex-col gap-2">
            <Textarea placeholder="Nouvel avertissement…" value={warn} onChange={(e) => setWarn(e.target.value)} />
            <Button variant="destructive" onClick={() => mWarn.mutate()} disabled={!warn} className="self-end">Avertir</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div></CardContent>
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
      {(["ig_name", "current_grade", "arrival_date", "last_rankup", "recruiter_discord_id"] as const).map((k) => {
        const fid = `${reactId}-${k}`;
        return (
          <div key={k}>
            <label htmlFor={fid} className="text-xs text-muted-foreground">{k}</label>
            <Input id={fid} value={(p as any)[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
          </div>
        );
      })}
      <div>
        <label htmlFor={`${reactId}-status`} className="text-xs text-muted-foreground">status</label>
        <select id={`${reactId}-status`} className="w-full bg-input rounded-md px-3 py-2 text-sm border border-border" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}>
          <option value="active">active</option>
          <option value="former">former</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Button onClick={() => onSave(p)}>Enregistrer</Button>
      </div>
    </div>
  );
}

