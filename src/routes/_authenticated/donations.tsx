import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";

import {
  listMyActiveCarts,
  createCart,
  addCartLine,
  removeCartLine,
  validateCart,
  cancelCart,
} from "@/lib/data/donations.functions";
import { listValues } from "@/lib/data/values.functions";
import { listMembers } from "@/lib/data/members.functions";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

import {
  PageHeader,
  PageCard,
  SectionLabel,
  DaButton,
  DaInput,
  DaSelect,
  DaChip,
  EmptyBlock,
  ErrorBlock,
} from "@/components/tools/ToolsUi";

export const Route = createFileRoute("/_authenticated/donations")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Dons · PunkAstik" }] }),
  component: () => (
    <Guard perm="donations.manage">
      <DonationsPage />
    </Guard>
  ),
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
    onSuccess: () => {
      toast.success("Panier créé");
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        code="// donations.carts"
        title="Dons"
        description="Création et validation des paniers de donations. 1h pour valider avant expiration."
      />

      <PageCard>
        <SectionLabel>nouveau panier</SectionLabel>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor={`${newCartId}-member`}
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Membre (optionnel)
            </label>
            <DaSelect
              id={`${newCartId}-member`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full mt-1"
            >
              <option value="">— Aucun —</option>
              {members.data?.members.map((m) => (
                <option key={m.discord_id} value={m.discord_id}>
                  {m.ig_name ?? m.discord_username}
                </option>
              ))}
            </DaSelect>
          </div>
          <div className="w-32">
            <label
              htmlFor={`${newCartId}-bonus`}
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Bonus %
            </label>
            <DaInput
              id={`${newCartId}-bonus`}
              type="number"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
          <DaButton onClick={() => mkCart.mutate()} disabled={mkCart.isPending}>Créer</DaButton>
        </div>
      </PageCard>

      {carts.error && (
        <ErrorBlock message={(carts.error as Error).message} hint="Réessaie dans un instant." />
      )}

      {carts.data?.carts.map((c: any) => (
        <Cart
          key={c.id}
          cart={c}
          values={values.data?.values ?? []}
          onAdd={(payload: any) =>
            addLine({ data: { ...payload, cartId: c.id } })
              .then(refresh)
              .catch((e: Error) => toast.error(toUserMessage(e)))
          }
          onRemove={(lineId: string) =>
            rmLine({ data: { lineId, cartId: c.id } })
              .then(refresh)
              .catch((e: Error) => toast.error(toUserMessage(e)))
          }
          onValidate={() =>
            validate({ data: { cartId: c.id } })
              .then(() => {
                toast.success("Validé");
                refresh();
              })
              .catch((e: Error) => toast.error(toUserMessage(e)))
          }
          onCancel={() =>
            cancel({ data: { cartId: c.id } })
              .then(() => {
                toast.info("Annulé");
                refresh();
              })
              .catch((e: Error) => toast.error(toUserMessage(e)))
          }
        />
      ))}
      {!carts.error && carts.data?.carts.length === 0 && (
        <PageCard>
          <EmptyBlock label="Aucun panier actif — crée-en un" />
        </PageCard>
      )}
    </div>
  );
}

function Cart({ cart, values, onAdd, onRemove, onValidate, onCancel }: any) {
  const cartId = useId();
  const [picked, setPicked] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const v = values.find((x: any) => x.id === picked);

  const wrap = async (fn: () => unknown) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };


  return (
    <PageCard>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div
          className="text-[10px] uppercase tracking-[0.3em] text-pink-500"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // panier #{cart.id.slice(0, 6)}
          {cart.member_discord_id && (
            <span className="ml-2 text-zinc-500">→ {cart.member_discord_id}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DaChip accent="blurple">+{cart.bonus_pct}%</DaChip>
          <DaChip accent="pink">{cart.total_final} pts</DaChip>
          <span
            className="text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            style={{ fontFamily: "'Space Mono'" }}
          >
            expire {new Date(cart.expires_at).toLocaleTimeString("fr-FR")}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-zinc-800">
        {cart.donation_lines?.map((l: any) => (
          <li key={l.id} className="py-2 flex items-center gap-2 text-sm">
            <span
              className="text-[9px] uppercase tracking-[0.2em] text-zinc-500"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {l.line_type}
            </span>
            <span className="flex-1 text-zinc-200">
              {l.label} × {l.quantity}
            </span>
            <span className="font-mono text-pink-400 font-bold">{l.subtotal} pts</span>
            <ConfirmDialog
              title="Retirer cette ligne ?"
              description={`"${l.label}" sera retiré du panier.`}
              confirmLabel="Retirer"
              destructive
              onConfirm={() => onRemove(l.id)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-300"
                  aria-label={`Retirer ${l.label}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          </li>
        ))}
        {(!cart.donation_lines || cart.donation_lines.length === 0) && (
          <li>
            <EmptyBlock label="Panier vide — ajoute un item ci-dessous" />
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2 items-end border-t border-zinc-800 pt-3 mt-3">
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor={`${cartId}-item`}
            className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
            style={{ fontFamily: "'Space Mono'" }}
          >
            Item / action
          </label>
          <DaSelect
            id={`${cartId}-item`}
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="w-full mt-1"
          >
            <option value="">—</option>
            {values
              .filter((x: any) => x.active)
              .map((x: any) => (
                <option key={x.id} value={x.id}>
                  [{x.category}] {x.name} ({x.points} pts)
                </option>
              ))}
          </DaSelect>
        </div>
        <div className="w-20">
          <label
            htmlFor={`${cartId}-qty`}
            className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
            style={{ fontFamily: "'Space Mono'" }}
          >
            Qté
          </label>
          <DaInput
            id={`${cartId}-qty`}
            type="number"
            value={qty}
            min={1}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full mt-1"
          />
        </div>
        <DaButton
          disabled={!v || busy}
          onClick={() => {
            if (!v) return;
            wrap(() =>
              onAdd({
                line_type: v.category,
                config_value_id: v.id,
                label: v.name,
                unit_points: v.points,
                quantity: qty,
              }),
            );
            setQty(1);
            setPicked("");
          }}
        >
          Ajouter
        </DaButton>

      </div>

      <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-zinc-800">
        <DaButton variant="ghost" disabled={busy} onClick={() => wrap(() => onCancel())}>
          Annuler
        </DaButton>
        <DaButton variant="success" disabled={busy} onClick={() => wrap(() => onValidate())}>
          Valider don

        </DaButton>
      </div>
    </PageCard>
  );
}
