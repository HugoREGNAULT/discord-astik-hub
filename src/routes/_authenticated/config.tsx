import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listValues, upsertValue, toggleValueActive, deleteValue } from "@/lib/data/values.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/config")({
  head: () => ({ meta: [{ title: "Config valeurs · PunkAstik" }] }),
  component: () => (<Guard perm="config.manage"><ConfigPage /></Guard>),
});

const CATS = ["item", "action", "other", "money"] as const;

function ConfigPage() {
  const qc = useQueryClient();
  const lv = useServerFn(listValues);
  const up = useServerFn(upsertValue);
  const tog = useServerFn(toggleValueActive);
  const del = useServerFn(deleteValue);

  const { data } = useQuery({ queryKey: ["values"], queryFn: () => lv() });

  const [form, setForm] = useState({ category: "item" as (typeof CATS)[number], name: "", points: 0, display_order: 0 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["values"] });

  const add = useMutation({
    mutationFn: () => up({ data: { ...form, active: true } }),
    onSuccess: () => { setForm({ ...form, name: "", points: 0 }); toast.success("Ajouté"); refresh(); },
  });

  const grouped = CATS.map((c) => ({ cat: c, items: (data?.values ?? []).filter((v: any) => v.category === c) }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Config valeurs (AstikPoints)</h1>

      <Card>
        <CardHeader><CardTitle>Ajouter une valeur</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm">
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Nom</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Points</label>
            <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          </div>
          <Button onClick={() => add.mutate()} disabled={!form.name}>Ajouter</Button>
        </CardContent>
      </Card>

      {grouped.map((g) => (
        <Card key={g.cat}>
          <CardHeader><CardTitle className="capitalize">{g.cat} ({g.items.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {g.items.map((v: any) => (
                <li key={v.id} className="py-2 flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{v.name}</span>
                  <span className="font-mono text-primary">{v.points} pts</span>
                  <Switch checked={v.active} onCheckedChange={async (c) => { await tog({ data: { id: v.id, active: c } }); refresh(); }} />
                  <button onClick={async () => { await del({ data: { id: v.id } }); refresh(); }} className="text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              {g.items.length === 0 && <li className="text-sm text-muted-foreground py-2">Vide.</li>}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
