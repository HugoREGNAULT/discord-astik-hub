/**
 * Modal au clic sur une cellule du calendrier : liste TOUTES les absences couvrant ce jour,
 * avec avatar + type + dates + motif + drill-down vers /members/:id (si perm).
 */
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { avatarUrl } from "@/lib/paladium/api";
import {
  TYPE_META,
  parseISODate,
  type AbsenceRow,
  type AbsenceType,
} from "@/components/absences/types";

export function DayDetailsDialog({
  day,
  absences,
  onClose,
}: {
  day: Date | null;
  absences: AbsenceRow[];
  onClose: () => void;
}) {
  const { data: me } = useCurrentUser();
  const canDrillDown = hasPerm(me, "members.view");
  const open = day !== null;
  const label = day?.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{label ?? ""}</DialogTitle>
          <DialogDescription>
            {absences.length === 0
              ? "Personne d'absent ce jour."
              : `${absences.length} membre${absences.length > 1 ? "s" : ""} absent${absences.length > 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>
        {absences.length > 0 && (
          <ul className="divide-y divide-border max-h-96 overflow-y-auto">
            {absences.map((a) => {
              const meta = TYPE_META[a.type as AbsenceType] ?? TYPE_META.other;
              const Icon = meta.icon;
              const nameEl = <span className="text-sm font-medium truncate">{a.member_name}</span>;
              return (
                <li key={a.id} className="py-2 flex items-center gap-3">
                  {a.member_mc_uuid ? (
                    <img
                      src={avatarUrl(a.member_mc_uuid, 32)}
                      alt=""
                      className="size-8 rounded shrink-0 bg-muted"
                    />
                  ) : (
                    <div className="size-8 rounded shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    {canDrillDown ? (
                      <Link
                        to="/members/$id"
                        params={{ id: a.member_discord_id }}
                        className="hover:underline truncate"
                        onClick={onClose}
                      >
                        {nameEl}
                      </Link>
                    ) : (
                      nameEl
                    )}
                    <div className="text-xs text-muted-foreground">
                      {parseISODate(a.starts_on).toLocaleDateString("fr-FR")} →{" "}
                      {parseISODate(a.ends_on).toLocaleDateString("fr-FR")}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className={`gap-1 shrink-0 ${meta.cls}`}>
                    <Icon className="size-3" /> {meta.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
