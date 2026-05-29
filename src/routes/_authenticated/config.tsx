import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { listValues, upsertValue, toggleValueActive, deleteValue } from "@/lib/data/values.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/config")({
  head: () => ({ meta: [{ title: "Config valeurs · PunkAstik" }] }),
  component: () => (<Guard perm="config.manage"><ConfigPage /></Guard>),
});

const CATS = ["item", "action", "other", "money"] as const;
type Cat = (typeof CATS)[number];

interface ValueRow {
  id: string;
  category: Cat;
  name: string;
  points: number;
  active: boolean;
  image_url: string | null;
  display_order: number;
}

async function uploadIcon(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("value-icons")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("value-icons").getPublicUrl(path);
  return data.publicUrl;
}

function ConfigPage() {
  const qc = useQueryClient();
  const lv = useServerFn(listValues);
  const up = useServerFn(upsertValue);
  const tog = useServerFn(toggleValueActive);
  const del = useServerFn(deleteValue);

  const { data } = useQuery({ queryKey: ["values"], queryFn: () => lv() });

  const [form, setForm] = useState<{
    category: Cat;
    name: string;
    points: number;
    display_order: number;
    image_url: string | null;
  }>({ category: "item", name: "", points: 0, display_order: 0, image_url: null });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["values"] });

  const add = useMutation({
    mutationFn: () => up({ data: { ...form, active: true } }),
    onSuccess: () => {
      setForm({ category: form.category, name: "", points: 0, display_order: 0, image_url: null });
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Valeur ajoutée");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Fichier image requis");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max 2 MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadIcon(file);
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Icône uploadée");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const grouped = CATS.map((c) => ({
    cat: c,
    items: ((data?.values ?? []) as ValueRow[]).filter((v) => v.category === c),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Config valeurs (AstikPoints)</h1>

      <Card>
        <CardHeader><CardTitle>Ajouter une valeur</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-6 gap-3 items-end">
          {/* Icône */}
          <div>
            <label className="text-xs text-muted-foreground">Icône</label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "relative size-12 rounded-md border border-dashed border-border flex items-center justify-center bg-muted/30 hover:bg-muted/60 transition overflow-hidden",
                )}
                aria-label="Choisir une icône"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : form.image_url ? (
                  <img src={form.image_url} alt="" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-4 text-muted-foreground" />
                )}
              </button>
              {form.image_url && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, image_url: null }))}
                  className="text-destructive"
                  aria-label="Retirer l'icône"
                >
                  <X className="size-4" />
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Cat })}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            >
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
          <Button onClick={() => add.mutate()} disabled={!form.name || uploading || add.isPending}>
            Ajouter
          </Button>
        </CardContent>
      </Card>

      {grouped.map((g) => (
        <Card key={g.cat}>
          <CardHeader><CardTitle className="capitalize">{g.cat} ({g.items.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {g.items.map((v) => (
                <ValueRowItem
                  key={v.id}
                  value={v}
                  onToggle={async (c) => { await tog({ data: { id: v.id, active: c } }); refresh(); }}
                  onDelete={async () => { await del({ data: { id: v.id } }); refresh(); }}
                  onUpdateImage={async (url) => {
                    await up({ data: { ...v, image_url: url } });
                    refresh();
                  }}
                />
              ))}
              {g.items.length === 0 && <li className="text-sm text-muted-foreground py-2">Vide.</li>}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ValueRowItem({
  value,
  onToggle,
  onDelete,
  onUpdateImage,
}: {
  value: ValueRow;
  onToggle: (active: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onUpdateImage: (url: string | null) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const replaceImage = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Image requise");
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 MB");
    setBusy(true);
    try {
      const url = await uploadIcon(file);
      await onUpdateImage(url);
      toast.success("Icône mise à jour");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-2 flex items-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="size-9 rounded-md border border-border bg-muted/30 hover:bg-muted/60 flex items-center justify-center overflow-hidden shrink-0"
        aria-label="Changer l'icône"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : value.image_url ? (
          <img src={value.image_url} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-3.5 text-muted-foreground" />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => replaceImage(e.target.files?.[0] ?? null)}
      />
      <span className="flex-1 truncate">{value.name}</span>
      <span className="font-mono text-primary">{value.points} pts</span>
      <Switch checked={value.active} onCheckedChange={onToggle} />
      <button onClick={onDelete} className="text-destructive" aria-label="Supprimer">
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
