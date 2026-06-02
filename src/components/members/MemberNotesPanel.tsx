import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import type { MemberNote } from "./types";

interface Props {
  notes: MemberNote[];
  canWrite: boolean;
  noteInput: string;
  onNoteInputChange: (v: string) => void;
  onAdd: () => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}

export function MemberNotesPanel({
  notes,
  canWrite,
  noteInput,
  onNoteInputChange,
  onAdd,
  onDelete,
  deletingId,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold m-0">Notes staff</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="text-sm border border-border rounded p-3 flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()} · {n.staff_username}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
              </div>
              {canWrite && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer la note"
                  title="Supprimer la note"
                  disabled={deletingId === n.id}
                  onClick={() => {
                    if (confirm("Supprimer cette note interne ?")) onDelete(n.id);
                  }}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
          {notes.length === 0 && (
            <li>
              <EmptyState
                title="Aucune note"
                description="Les notes staff sur ce membre apparaîtront ici."
                variant="compact"
              />
            </li>
          )}
        </ul>
        {canWrite && (
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Nouvelle note…"
              value={noteInput}
              onChange={(e) => onNoteInputChange(e.target.value)}
            />
            <Button onClick={onAdd} disabled={!noteInput} className="self-end">
              Ajouter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
