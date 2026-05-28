import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";

import { listMyActiveCarts, createCart, addCartLine, removeCartLine, validateCart, cancelCart } from "@/lib/data/donations.functions";
import { listValues } from "@/lib/data/values.functions";
import { listMembers } from "@/lib/data/members.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/donations")({
  head: () => ({ meta: [{ title: "Dons · PunkAstik" }] }),
  component: DonationsPage,
});

function DonationsPage() {
  const qc = useQueryClient();
  const listCarts = useServerFn(listMyActiveCarts);
  const create = useServerFn(createCart);
  const addLine = useServerFn(addCartLine);
  const rmLine = useServerFn(removeCartLine);
  const validate = useServerFn(validateCart);
  const cancel = useServerFn(cancelCart);
  const lv = useServerFn(listValues);
  const lm = useServerFn(listMembers);

  const carts = useQuery({ queryKey: ["carts"], queryFn: () => listCarts() });
  const values = useQuery({ queryKey: ["values"], queryFn: () => lv() });
  const members = useQuery({ queryKey: ["members-all"], queryFn: () => lm({ data: {} }) });

  const [target, setTarget] = useState("");
  const [bonus, setBonus] = useState(0);
  const newCartId = useId();
  const refresh = () => qc.invalidateQueries({ queryKey: ["carts"] });

  const mkCart = useMutation({
    mutationFn: () => create({ data: { memberDiscordId: target || undefined, bonusPct: bonus } }),
    onSuccess: () => { toast.success("Panier créé"); refresh(); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dons</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Nouveau panier</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor={`${newCartId}-member`} className="text-xs text-muted-foreground">Membre (optionnel)</label>
            <select id={`${newCartId}-member`} value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm">
              <option value="">— Aucun —</option>
              {members.data?.members.map((m) => (
                <option key={m.discord_id} value={m.discord_id}>{m.ig_name ?? m.discord_username}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label htmlFor={`${newCartId}-bonus`} className="text-xs text-muted-foreground">Bonus %</label>
            <Input id={`${newCartId}-bonus`} type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} />
          </div>
          <Button onClick={() => mkCart.mutate()}>Créer</Button>
        </CardContent>
      </Card>



      {carts.data?.carts.map((c: any) => (
        <Cart key={c.id} cart={c} values={values.data?.values ?? []}
          onAdd={(payload: any) => addLine({ data: { ...payload, cartId: c.id } }).then(refresh)}
          onRemove={(lineId: string) => rmLine({ data: { lineId, cartId: c.id } }).then(refresh)}

          onValidate={() => validate({ data: { cartId: c.id } }).then(() => { toast.success("Validé"); refresh(); })}
          onCancel={() => cancel({ data: { cartId: c.id } }).then(() => { toast.info("Annulé"); refresh(); })}
        />
      ))}
      {carts.data?.carts.length === 0 && <p className="text-sm text-muted-foreground">Aucun panier actif.</p>}
    </div>
  );
}

function Cart({ cart, values, onAdd, onRemove, onValidate, onCancel }: any) {
  const cartId = useId();
  const [picked, setPicked] = useState<string>("");
  const [qty, setQty] = useState(1);
  const v = values.find((x: any) => x.id === picked);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            Panier #{cart.id.slice(0, 6)} {cart.member_discord_id && <span className="text-xs text-muted-foreground">→ {cart.member_discord_id}</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">+{cart.bonus_pct}%</Badge>
            <Badge>{cart.total_final} pts</Badge>
            <span className="text-[10px] text-muted-foreground">expire {new Date(cart.expires_at).toLocaleTimeString()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border">
          {cart.donation_lines?.map((l: any) => (
            <li key={l.id} className="py-2 flex items-center gap-2 text-sm">
              <span className="text-[10px] text-muted-foreground uppercase">{l.line_type}</span>
              <span className="flex-1">{l.label} × {l.quantity}</span>
              <span className="font-mono">{l.subtotal} pts</span>
              <button onClick={() => onRemove(l.id)} aria-label={`Supprimer ${l.label}`} className="text-destructive"><Trash2 className="size-4" /></button>
            </li>
          ))}
          {(!cart.donation_lines || cart.donation_lines.length === 0) && <li className="text-sm text-muted-foreground py-2">Panier vide.</li>}
        </ul>

        <div className="flex flex-wrap gap-2 items-end border-t border-border pt-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor={`${cartId}-item`} className="text-xs text-muted-foreground">Item / action</label>
            <select id={`${cartId}-item`} value={picked} onChange={(e) => setPicked(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm">
              <option value="">—</option>
              {values.filter((x: any) => x.active).map((x: any) => (
                <option key={x.id} value={x.id}>[{x.category}] {x.name} ({x.points} pts)</option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label htmlFor={`${cartId}-qty`} className="text-xs text-muted-foreground">Qté</label>
            <Input id={`${cartId}-qty`} type="number" value={qty} min={1} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <Button
            disabled={!v}
            onClick={() => {
              if (!v) return;
              onAdd({ line_type: v.category, config_value_id: v.id, label: v.name, unit_points: v.points, quantity: qty });
              setQty(1); setPicked("");
            }}
          >Ajouter</Button>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
          <Button onClick={onValidate} className="bg-success text-success-foreground hover:opacity-90">Valider don</Button>
        </div>
      </CardContent>
    </Card>
  );
}

