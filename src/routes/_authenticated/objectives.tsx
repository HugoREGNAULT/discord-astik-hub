import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listObjectives,
  createObjective,
  toggleObjective,
  deleteObjective,
} from "@/lib/data/objectives.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Target } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/objectives")({
  head: () => ({ meta: [{ title: "Objectifs · PunkAstik" }] }),
  component: ObjectivesPage,
});

function ObjectivesPage() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const canEdit = hasPerm(user, "objectives.edit");

  const ls = useServerFn(listObjectives);
  const cr = useServerFn(createObjective);
  const tog = useServerFn(toggleObjective);
  const del = useServerFn(deleteObjective);

  const { data } = useQuery({ queryKey: ["objectives"], queryFn: () => ls() });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["objectives"] });

  const add = useMutation({
    mutationFn: () => cr({ data: { title, description: desc } }),
    onSuccess: () => {
      setTitle("");
      setDesc("");
      refresh();
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        code="// objectives"
        title="Objectifs faction"
        description="Les buts en cours pour la faction."
      />

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nouvel objectif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Description (optionnel)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <Button onClick={() => add.mutate()} disabled={!title}>
              Créer
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {data?.objectives.map((o: any) => (
          <Card key={o.id} className={o.done ? "opacity-60" : ""}>
            <CardContent className="flex items-start gap-3 py-3">
              <Checkbox
                checked={o.done}
                disabled={!canEdit}
                onCheckedChange={async (c) => {
                  await tog({ data: { id: o.id, done: !!c } });
                  refresh();
                }}
              />
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${o.done ? "line-through" : ""}`}>{o.title}</div>
                {o.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {o.description}
                  </p>
                )}
                {o.done && o.done_by_discord_id && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Validé par {o.done_by_discord_id} · {new Date(o.done_at).toLocaleString()}
                  </p>
                )}
              </div>
              {canEdit && (
                <button
                  onClick={async () => {
                    await del({ data: { id: o.id } });
                    refresh();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </CardContent>
          </Card>
        ))}
        {data?.objectives.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Target}
              title="Aucun objectif"
              description="Les objectifs collectifs apparaîtront ici."
            />
          </div>
        )}
      </div>
    </div>
  );
}
