import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StickyNote, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { addNote, addWarning } from "@/lib/data/members.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { toUserMessage } from "@/lib/errors";

type Severity = "verbal" | "minor" | "major" | "severe";

type Props = {
  memberDiscordId: string;
  memberLabel: string;
};

export function MemberQuickActions({ memberDiscordId, memberLabel }: Props) {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const noteFn = useServerFn(addNote);
  const warnFn = useServerFn(addWarning);

  const [noteOpen, setNoteOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [warnBody, setWarnBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [category, setCategory] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");

  const canNote = hasPerm(me, "notes.write");
  const canWarn = hasPerm(me, "warnings.write");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["member", memberDiscordId] });
  };

  const mNote = useMutation({
    mutationFn: () =>
      noteFn({ data: { memberDiscordId, body: noteBody.trim() } }),
    onSuccess: () => {
      toast.success("Note ajoutée");
      setNoteBody("");
      setNoteOpen(false);
      refresh();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const mWarn = useMutation({
    mutationFn: () => {
      const days = expiresInDays.trim()
        ? Number.parseInt(expiresInDays, 10)
        : undefined;
      return warnFn({
        data: {
          memberDiscordId,
          body: warnBody.trim(),
          severity,
          category: category.trim() || undefined,
          expiresInDays: days && days > 0 ? days : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Avertissement envoyé");
      setWarnBody("");
      setCategory("");
      setExpiresInDays("");
      setSeverity("minor");
      setWarnOpen(false);
      refresh();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  if (!canNote && !canWarn) return null;

  return (
    <div className="flex items-center gap-1" onClick={stop} onKeyDown={stop}>
      {canNote && (
        <button
          type="button"
          aria-label={`Ajouter une note interne sur ${memberLabel}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setNoteOpen(true);
          }}
          className="size-8 inline-flex items-center justify-center border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-pink-400 hover:border-pink-500/60 transition"
          title="Note interne"
        >
          <StickyNote className="size-4" />
        </button>
      )}
      {canWarn && (
        <button
          type="button"
          aria-label={`Avertir ${memberLabel}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWarnOpen(true);
          }}
          className="size-8 inline-flex items-center justify-center border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-amber-400 hover:border-amber-500/60 transition"
          title="Avertir"
        >
          <ShieldAlert className="size-4" />
        </button>
      )}

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent onClick={stop}>
          <DialogHeader>
            <DialogTitle>Note interne · {memberLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="note-body">Contenu (visible uniquement par le staff)</Label>
            <Textarea
              id="note-body"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Comportement, contexte, suivi…"
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{noteBody.length}/2000</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={noteBody.trim().length === 0 || mNote.isPending}
              onClick={() => mNote.mutate()}
            >
              {mNote.isPending ? "Enregistrement…" : "Ajouter la note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent onClick={stop}>
          <DialogHeader>
            <DialogTitle>Avertir · {memberLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="warn-body">Motif (envoyé en DM au membre)</Label>
              <Textarea
                id="warn-body"
                value={warnBody}
                onChange={(e) => setWarnBody(e.target.value)}
                placeholder="Décris précisément le manquement…"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">{warnBody.length}/2000</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Gravité</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verbal">Verbal (0 pt)</SelectItem>
                    <SelectItem value="minor">Mineur (1 pt)</SelectItem>
                    <SelectItem value="major">Majeur (3 pts)</SelectItem>
                    <SelectItem value="severe">Sévère (5 pts)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warn-expires">Expire dans (jours, optionnel)</Label>
                <Input
                  id="warn-expires"
                  type="number"
                  min={1}
                  max={3650}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="ex. 30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warn-category">Catégorie (optionnel)</Label>
              <Input
                id="warn-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="ex. inactivité, comportement, règles"
                maxLength={64}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWarnOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={warnBody.trim().length === 0 || mWarn.isPending}
              onClick={() => mWarn.mutate()}
            >
              {mWarn.isPending ? "Envoi…" : "Avertir le membre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
