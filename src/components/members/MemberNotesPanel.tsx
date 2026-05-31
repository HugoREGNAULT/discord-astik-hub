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
}

export function MemberNotesPanel({
  notes,
  canWrite,
  noteInput,
  onNoteInputChange,
  onAdd,
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
            <li key={n.id} className="text-sm border border-border rounded p-3">
              <div className="text-[11px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString()} · {n.staff_username}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
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
