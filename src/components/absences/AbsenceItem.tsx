/**
 * Ligne d'absence réutilisable (Mes / Staff / Liste).
 * - Avatar tête Minecraft (fallback bloc gris).
 * - Pseudo cliquable vers /members/:id si l'utilisateur a la perm members.view.
 * - Badge « En cours » pulsé pour les absences couvrant aujourd'hui.
 * - Boutons : Reprendre aujourd'hui (si owner+en cours), Modifier, Supprimer (si canManage).
 */
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { avatarUrl } from "@/lib/paladium/api";
import { toUserMessage } from "@/lib/errors";
import { deleteAbsence, endAbsenceToday } from "@/lib/data/absences.functions";
import { CreateOrEditDialog } from "@/components/absences/CreateOrEditDialog";
import {
  TYPE_META,
  type AbsenceRow,
  type AbsenceType,
  isActiveOn,
  parseISODate,
} from "@/components/absences/types";

export function AbsenceItem({
  absence: a,
  canManage,
  myDiscordId,
  onChanged,
}: {
  absence: AbsenceRow;
  canManage: boolean;
  myDiscordId?: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const canDrillDown = hasPerm(me, "members.view");
  const delFn = useServerFn(deleteAbsence);
  const endFn = useServerFn(endAbsenceToday);

  const meta = TYPE_META[a.type as AbsenceType] ?? TYPE_META.other;
  const Icon = meta.icon;
  const active = isActiveOn(a, new Date());
  const isMine = a.member_discord_id === myDiscordId;

  const mDel = useMutation({
    mutationFn: () => delFn({ data: { id: a.id } }),
    onSuccess: () => {
      toast.success("Absence supprimée");
      qc.invalidateQueries({ queryKey: ["absences"] });
      onChanged();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const mEnd = useMutation({
    mutationFn: () => endFn({ data: { id: a.id } }),
    onSuccess: () => {
      toast.success("Bon retour parmi nous !");
      qc.invalidateQueries({ queryKey: ["absences"] });
      onChanged();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const nameEl = <span className="text-sm font-medium truncate">{a.member_name}</span>;

  return (
    <li className="py-3 flex items-center gap-3">
      {a.member_mc_uuid ? (
        <img
          src={avatarUrl(a.member_mc_uuid, 32)}
          alt=""
          className="size-8 rounded shrink-0 bg-muted"
        />
      ) : (
        <div className="size-8 rounded shrink-0 bg-muted" />
      )}

      <Badge variant="outline" className={`gap-1 ${meta.cls}`}>
        <Icon className="size-3" /> {meta.label}
      </Badge>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {canDrillDown ? (
            <Link
              to="/members/$id"
              params={{ id: a.member_discord_id }}
              className="hover:underline truncate"
            >
              {nameEl}
            </Link>
          ) : (
            nameEl
          )}
          {active && (
            <Badge variant="secondary" className="gap-1.5 shrink-0">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              <span>En cours</span>
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {parseISODate(a.starts_on).toLocaleDateString("fr-FR")} →{" "}
          {parseISODate(a.ends_on).toLocaleDateString("fr-FR")}
          {a.reason && ` · ${a.reason}`}
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-1 shrink-0">
          {active && isMine && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => mEnd.mutate()}
              disabled={mEnd.isPending}
              title="Clore mon absence aujourd'hui"
            >
              <CalendarCheck className="size-4" /> Reprendre
            </Button>
          )}
          <CreateOrEditDialog mode="edit" absence={a} onDone={onChanged} />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" aria-label="Supprimer">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            }
            title="Supprimer cette absence ?"
            description="Cette action est irréversible."
            confirmLabel="Supprimer"
            onConfirm={async () => {
              await mDel.mutateAsync();
            }}
          />
        </div>
      )}
    </li>
  );
}
