import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import type { MemberWarning } from "./types";

interface Props {
  warnings: MemberWarning[];
  canWrite: boolean;
  warnInput: string;
  onWarnInputChange: (v: string) => void;
  onAdd: () => void;
}

export function MemberWarningsPanel({
  warnings,
  canWrite,
  warnInput,
  onWarnInputChange,
  onAdd,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold m-0">Avertissements</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {warnings.map((w) => (
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
          {warnings.length === 0 && (
            <li>
              <EmptyState
                title="Aucun avertissement"
                description="Aucune sanction enregistrée."
                variant="compact"
              />
            </li>
          )}
        </ul>
        {canWrite && (
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Nouvel avertissement…"
              value={warnInput}
              onChange={(e) => onWarnInputChange(e.target.value)}
            />
            <Button
              variant="destructive"
              onClick={onAdd}
              disabled={!warnInput}
              className="self-end"
            >
              Avertir
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
