import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Minus, AlertTriangle, Check, X, Truck } from "lucide-react";

import { PageHeader, ToolCard } from "@/components/tools/ToolsUi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { toUserMessage } from "@/lib/errors";

import {
  listChests,
  upsertChest,
  deleteChest,
  listStock,
  upsertStockItem,
  deleteStockItem,
  adjustStock,
  createMaterialRequest,
  listMyMaterialRequests,
  listPendingMaterialRequests,
  listAllMaterialRequests,
  decideMaterialRequest,
} from "@/lib/data/logistics.functions";
import { getAdminShopLatest } from "@/lib/paladium/history.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/logistics")({
  head: () => ({ meta: [{ title: "Logistique · PunkAstik" }] }),
  component: LogisticsPage,
});

function LogisticsPage() {
  const { data: me } = useCurrentUser();
  const isStaff = hasPerm(me, "members.edit");

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <PageHeader
        code="// LOGISTIQUE"
        title="Coffres & demandes"
        description="Gestion des stocks communs et des demandes de matériel."
      />
      <Tabs defaultValue={isStaff ? "stock" : "requests"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Coffres & stocks</TabsTrigger>
          <TabsTrigger value="requests">Demandes</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="space-y-6">
          <ChestsSection isStaff={isStaff} />
          <StockSection isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="requests" className="space-y-6">
          <RequestForm />
          <MyRequests />
          {isStaff && <StaffRequests />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Coffres ----------

function ChestsSection({ isStaff }: { isStaff: boolean }) {
  const qc = useQueryClient();
  const fetchChests = useServerFn(listChests);
  const { data } = useQuery({ queryKey: ["logi", "chests"], queryFn: () => fetchChests() });
  const upsert = useServerFn(upsertChest);
  const del = useServerFn(deleteChest);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const openNew = () => {
    setEditing(null);
    setName("");
    setLocation("");
    setDescription("");
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setName(c.name);
    setLocation(c.location ?? "");
    setDescription(c.description ?? "");
    setOpen(true);
  };

  const mUpsert = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          name,
          location: location || null,
          description: description || null,
        },
      }),
    onSuccess: () => {
      toast.success("Coffre enregistré");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["logi", "chests"] });
      qc.invalidateQueries({ queryKey: ["logi", "stock"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Coffre supprimé");
      qc.invalidateQueries({ queryKey: ["logi", "chests"] });
      qc.invalidateQueries({ queryKey: ["logi", "stock"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Coffres communs</CardTitle>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4 mr-1" /> Nouveau coffre
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Modifier le coffre" : "Nouveau coffre"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Localisation</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => mUpsert.mutate()} disabled={!name || mUpsert.isPending}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!data?.chests.length ? (
          <EmptyState title="Aucun coffre" description="Crée le premier coffre commun." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {data.chests.map((c: any) => (
              <div
                key={c.id}
                className="border border-border rounded-md p-3 bg-card/50 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.location && (
                    <div className="text-xs text-muted-foreground">{c.location}</div>
                  )}
                  {c.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {c.description}
                    </div>
                  )}
                </div>
                {isStaff && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <ConfirmDialog
                      title="Supprimer le coffre ?"
                      description="Les stocks liés seront dissociés."
                      onConfirm={() => mDel.mutate(c.id)}
                    >
                      <Button size="icon" variant="ghost">
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Stock ----------

function StockSection({ isStaff }: { isStaff: boolean }) {
  const qc = useQueryClient();
  const fetchStock = useServerFn(listStock);
  const fetchChests = useServerFn(listChests);
  const fetchShop = useServerFn(getAdminShopLatest);
  const { data } = useQuery({ queryKey: ["logi", "stock"], queryFn: () => fetchStock() });
  const { data: chestsData } = useQuery({
    queryKey: ["logi", "chests"],
    queryFn: () => fetchChests(),
  });
  const { data: shopData } = useQuery({
    queryKey: ["logi", "shop-items"],
    queryFn: () => fetchShop(),
  });

  const upsert = useServerFn(upsertStockItem);
  const del = useServerFn(deleteStockItem);
  const adjust = useServerFn(adjustStock);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [itemName, setItemName] = useState("");
  const [chestId, setChestId] = useState<string>("__none");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("pcs");
  const [minThreshold, setMinThreshold] = useState(0);

  const openNew = () => {
    setEditing(null);
    setItemName("");
    setChestId("__none");
    setQuantity(0);
    setUnit("pcs");
    setMinThreshold(0);
    setOpen(true);
  };
  const openEdit = (s: any) => {
    setEditing(s);
    setItemName(s.item_name);
    setChestId(s.chest_id ?? "__none");
    setQuantity(s.quantity);
    setUnit(s.unit ?? "pcs");
    setMinThreshold(s.min_threshold ?? 0);
    setOpen(true);
  };

  const mUpsert = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          chest_id: chestId === "__none" ? null : chestId,
          item_name: itemName,
          quantity,
          unit,
          min_threshold: minThreshold,
        },
      }),
    onSuccess: () => {
      toast.success("Stock enregistré");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["logi", "stock"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logi", "stock"] }),
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const mAdjust = useMutation({
    mutationFn: (v: { id: string; delta: number }) => adjust({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logi", "stock"] }),
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const lowCount = useMemo(
    () => (data?.items ?? []).filter((i: any) => i.low).length,
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Stocks</CardTitle>
          {lowCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> {lowCount} bas
            </Badge>
          )}
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4 mr-1" /> Nouvel item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Modifier l'item" : "Nouvel item de stock"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Item</Label>
                  <Input
                    list="logi-items"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Nom de l'item"
                  />
                  <datalist id="logi-items">
                    {(shopData?.items ?? []).map((it: any) => (
                      <option key={it.item_name} value={it.item_name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label>Coffre</Label>
                  <Select value={chestId} onValueChange={setChestId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Aucun</SelectItem>
                      {(chestsData?.chests ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Quantité</Label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Unité</Label>
                    <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                  </div>
                  <div>
                    <Label>Seuil bas</Label>
                    <Input
                      type="number"
                      value={minThreshold}
                      onChange={(e) => setMinThreshold(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => mUpsert.mutate()} disabled={!itemName || mUpsert.isPending}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!data?.items.length ? (
          <EmptyState title="Aucun stock" description="Ajoute un premier item." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Item</th>
                  <th className="text-left py-2 px-2">Coffre</th>
                  <th className="text-right py-2 px-2">Quantité</th>
                  <th className="text-right py-2 px-2">Seuil</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/40">
                    <td className="py-2 px-2 font-medium">
                      {s.item_name}
                      {s.low && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">
                          stock bas
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{s.chest_name ?? "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {s.quantity} {s.unit}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                      {s.min_threshold}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {isStaff && (
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => mAdjust.mutate({ id: s.id, delta: -1 })}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => mAdjust.mutate({ id: s.id, delta: 1 })}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <ConfirmDialog
                            title="Supprimer cet item ?"
                            onConfirm={() => mDel.mutate(s.id)}
                          >
                            <Button size="icon" variant="ghost">
                              <Trash2 className="w-4 h-4 text-rose-400" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Demandes ----------

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    approved: { label: "Approuvée", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    rejected: { label: "Refusée", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
    delivered: { label: "Livrée", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return (
    <Badge variant="outline" className={m.cls}>
      {m.label}
    </Badge>
  );
}

function RequestForm() {
  const qc = useQueryClient();
  const create = useServerFn(createMaterialRequest);
  const fetchShop = useServerFn(getAdminShopLatest);
  const { data: shopData } = useQuery({
    queryKey: ["logi", "shop-items"],
    queryFn: () => fetchShop(),
  });
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");

  const m = useMutation({
    mutationFn: () => create({ data: { itemName, quantity, reason: reason || null } }),
    onSuccess: () => {
      toast.success("Demande envoyée");
      setItemName("");
      setQuantity(1);
      setReason("");
      qc.invalidateQueries({ queryKey: ["logi", "my-requests"] });
      qc.invalidateQueries({ queryKey: ["logi", "pending-requests"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demander du matériel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto] items-end">
          <div>
            <Label>Item</Label>
            <Input
              list="logi-shop-items"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ex : Obsidienne"
            />
            <datalist id="logi-shop-items">
              {(shopData?.items ?? []).map((it: any) => (
                <option key={it.item_name} value={it.item_name} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Quantité</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div>
            <Label>Raison</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button onClick={() => m.mutate()} disabled={!itemName || m.isPending}>
            Envoyer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MyRequests() {
  const fetchMine = useServerFn(listMyMaterialRequests);
  const { data } = useQuery({
    queryKey: ["logi", "my-requests"],
    queryFn: () => fetchMine(),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes demandes</CardTitle>
      </CardHeader>
      <CardContent>
        {!data?.requests.length ? (
          <EmptyState title="Aucune demande" description="Tu n'as fait aucune demande." />
        ) : (
          <div className="space-y-2">
            {data.requests.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between border border-border rounded-md p-3 bg-card/50"
              >
                <div>
                  <div className="font-medium">
                    {r.item_name}{" "}
                    <span className="text-muted-foreground">× {r.quantity}</span>
                  </div>
                  {r.reason && (
                    <div className="text-xs text-muted-foreground">{r.reason}</div>
                  )}
                </div>
                {statusBadge(r.status)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StaffRequests() {
  const qc = useQueryClient();
  const fetchPending = useServerFn(listPendingMaterialRequests);
  const fetchAll = useServerFn(listAllMaterialRequests);
  const decide = useServerFn(decideMaterialRequest);
  const { data: pending } = useQuery({
    queryKey: ["logi", "pending-requests"],
    queryFn: () => fetchPending(),
  });
  const { data: all } = useQuery({
    queryKey: ["logi", "all-requests"],
    queryFn: () => fetchAll(),
  });

  const m = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" | "delivered" }) =>
      decide({ data: v }),
    onSuccess: () => {
      toast.success("Demande mise à jour");
      qc.invalidateQueries({ queryKey: ["logi", "pending-requests"] });
      qc.invalidateQueries({ queryKey: ["logi", "all-requests"] });
      qc.invalidateQueries({ queryKey: ["logi", "stock"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const row = (r: any, actions: boolean) => (
    <div
      key={r.id}
      className="flex items-center justify-between border border-border rounded-md p-3 bg-card/50 gap-3"
    >
      <div className="min-w-0">
        <div className="font-medium truncate">
          {r.member?.discord_username ?? r.member_discord_id} —{" "}
          <span className="text-foreground">{r.item_name}</span>{" "}
          <span className="text-muted-foreground">× {r.quantity}</span>
        </div>
        {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {statusBadge(r.status)}
        {actions && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => m.mutate({ id: r.id, decision: "approved" })}
            >
              <Check className="w-4 h-4 mr-1" />
              Approuver
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => m.mutate({ id: r.id, decision: "rejected" })}
            >
              <X className="w-4 h-4 mr-1" />
              Refuser
            </Button>
            <Button
              size="sm"
              onClick={() => m.mutate({ id: r.id, decision: "delivered" })}
            >
              <Truck className="w-4 h-4 mr-1" />
              Livrer
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>File des demandes en attente</CardTitle>
        </CardHeader>
        <CardContent>
          {!pending?.requests.length ? (
            <EmptyState title="Rien en attente" description="Toutes les demandes sont traitées." />
          ) : (
            <div className="space-y-2">{pending.requests.map((r: any) => row(r, true))}</div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Historique récent</CardTitle>
        </CardHeader>
        <CardContent>
          {!all?.requests.length ? (
            <EmptyState title="Vide" description="Aucune demande." />
          ) : (
            <div className="space-y-2">
              {all.requests.filter((r: any) => r.status !== "pending").map((r: any) => row(r, false))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
