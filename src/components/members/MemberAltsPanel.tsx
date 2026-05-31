import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import type { MemberAlt } from "./types";

interface Props {
  alts: MemberAlt[];
  canEdit: boolean;
  altInput: string;
  onAltInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (alt: MemberAlt) => Promise<void> | void;
}

export function MemberAltsPanel({
  alts,
  canEdit,
  altInput,
  onAltInputChange,
  onAdd,
  onRemove,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold m-0">Comptes alts</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {alts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-sm border border-border rounded px-3 py-2"
            >
              <span>{a.alt_name ?? a.alt_discord_id}</span>
              {canEdit && (
                <ConfirmDialog
                  title={`Retirer l'alt "${a.alt_name ?? a.alt_discord_id}" ?`}
                  description="Le compte secondaire sera détaché de ce membre."
                  confirmLabel="Retirer"
                  onConfirm={async () => {
                    await onRemove(a);
                  }}
                  trigger={<Button variant="ghost" size="sm" className="text-destructive">Supprimer</Button>}
                />
              )}
            </li>
          ))}
          {alts.length === 0 && (
            <li>
              <EmptyState
                title="Aucun alt"
                description="Aucun compte secondaire déclaré."
                variant="compact"
              />
            </li>
          )}
        </ul>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="Nom alt"
              value={altInput}
              onChange={(e) => onAltInputChange(e.target.value)}
            />
            <Button onClick={onAdd} disabled={!altInput}>
              Ajouter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
