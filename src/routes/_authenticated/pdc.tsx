import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  listPdcBlocks,
  createPdcBlock,
  deletePdcBlock,
  listPdcPlans,
  getPdcPlan,
  createPdcPlan,
  savePdcPlan,
  deletePdcPlan,
} from "@/lib/data/pdc.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Save, Plus, Brush, Eraser, Square, Pipette, ZoomIn, ZoomOut, Layers, FolderOpen, FilePlus2, Droplet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pdc")({
  head: () => ({ meta: [{ title: "Plans de coupe · PunkAstik" }] }),
  component: PdcPage,
});

type PdcBlock = {
  id: string;
  name: string;
  color: string;
  kind: "block" | "liquid";
};

type Tool = "paint" | "erase" | "rect" | "pick";
type LayersMap = Record<string, Record<string, string>>;

const CHUNK_SIZE = 16; // 1 chunk = 16x16 blocks

function PdcPage() {
  const qc = useQueryClient();

  // server fns
  const lsBlocks = useServerFn(listPdcBlocks);
  const crBlock = useServerFn(createPdcBlock);
  const delBlock = useServerFn(deletePdcBlock);
  const lsPlans = useServerFn(listPdcPlans);
  const getPlan = useServerFn(getPdcPlan);
  const crPlan = useServerFn(createPdcPlan);
  const savPlan = useServerFn(savePdcPlan);
  const delPlan = useServerFn(deletePdcPlan);

  const { data: blocksData } = useQuery({ queryKey: ["pdc-blocks"], queryFn: () => lsBlocks() });
  const { data: plansData } = useQuery({ queryKey: ["pdc-plans"], queryFn: () => lsPlans() });

  const blocks: PdcBlock[] = (blocksData?.blocks ?? []) as PdcBlock[];

  // currently loaded plan
  const [planId, setPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [widthChunks, setWidthChunks] = useState(11);
  const [heightChunks, setHeightChunks] = useState(11);
  const [layersCount, setLayersCount] = useState(1);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [layers, setLayers] = useState<LayersMap>({});
  const [dirty, setDirty] = useState(false);

  // editor state
  const [tool, setTool] = useState<Tool>("paint");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(8); // pixels per cell
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  const wCells = widthChunks * CHUNK_SIZE;
  const hCells = heightChunks * CHUNK_SIZE;

  const blockMap = useMemo(() => {
    const m = new Map<string, PdcBlock>();
    blocks.forEach((b) => m.set(b.id, b));
    return m;
  }, [blocks]);

  // ---------------- Canvas drawing ----------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const rect = cv.getBoundingClientRect();
    if (cv.width !== rect.width || cv.height !== rect.height) {
      cv.width = rect.width;
      cv.height = rect.height;
    }
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, cv.width, cv.height);

    // current layer cells
    const layer = layers[String(currentLayer)] ?? {};
    ctx.save();
    ctx.translate(pan.x, pan.y);

    // grid background
    ctx.fillStyle = "#141418";
    ctx.fillRect(0, 0, wCells * zoom, hCells * zoom);

    // painted cells
    for (const [key, blockId] of Object.entries(layer)) {
      const [xs, ys] = key.split(",");
      const x = Number(xs);
      const y = Number(ys);
      const b = blockMap.get(blockId);
      if (!b) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }

    // grid lines (only when zoomed in enough)
    if (zoom >= 6) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= wCells; x++) {
        ctx.moveTo(x * zoom, 0);
        ctx.lineTo(x * zoom, hCells * zoom);
      }
      for (let y = 0; y <= hCells; y++) {
        ctx.moveTo(0, y * zoom);
        ctx.lineTo(wCells * zoom, y * zoom);
      }
      ctx.stroke();
    }

    // chunk lines (every 16 cells)
    ctx.strokeStyle = "rgba(255,80,150,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cx = 0; cx <= widthChunks; cx++) {
      const px = cx * CHUNK_SIZE * zoom;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, hCells * zoom);
    }
    for (let cy = 0; cy <= heightChunks; cy++) {
      const py = cy * CHUNK_SIZE * zoom;
      ctx.moveTo(0, py);
      ctx.lineTo(wCells * zoom, py);
    }
    ctx.stroke();

    // outer border
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, wCells * zoom, hCells * zoom);

    // hover cursor
    if (hoverCell && hoverCell.x >= 0 && hoverCell.x < wCells && hoverCell.y >= 0 && hoverCell.y < hCells) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hoverCell.x * zoom, hoverCell.y * zoom, zoom, zoom);
    }

    // rect preview
    if (tool === "rect" && rectStart && hoverCell) {
      const x1 = Math.min(rectStart.x, hoverCell.x);
      const y1 = Math.min(rectStart.y, hoverCell.y);
      const x2 = Math.max(rectStart.x, hoverCell.x);
      const y2 = Math.max(rectStart.y, hoverCell.y);
      ctx.fillStyle = "rgba(88,101,242,0.25)";
      ctx.fillRect(x1 * zoom, y1 * zoom, (x2 - x1 + 1) * zoom, (y2 - y1 + 1) * zoom);
    }

    ctx.restore();
  }, [layers, currentLayer, pan, zoom, wCells, hCells, widthChunks, heightChunks, blockMap, hoverCell, tool, rectStart]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  // ---------------- Interaction ----------------
  const cellFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const px = e.clientX - rect.left - pan.x;
    const py = e.clientY - rect.top - pan.y;
    return { x: Math.floor(px / zoom), y: Math.floor(py / zoom) };
  };

  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const paintCell = (x: number, y: number, blockId: string | null) => {
    if (x < 0 || y < 0 || x >= wCells || y >= hCells) return;
    setLayers((prev) => {
      const key = String(currentLayer);
      const layer = { ...(prev[key] ?? {}) };
      const ck = `${x},${y}`;
      if (blockId === null) delete layer[ck];
      else layer[ck] = blockId;
      return { ...prev, [key]: layer };
    });
    setDirty(true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // middle click or space-like: pan with right button too
    if (e.button === 1 || e.button === 2) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    const cell = cellFromEvent(e);
    if (tool === "pick") {
      const id = layers[String(currentLayer)]?.[`${cell.x},${cell.y}`];
      if (id) {
        setSelectedBlockId(id);
        setTool("paint");
      }
      return;
    }
    if (tool === "rect") {
      setRectStart(cell);
      return;
    }
    isDrawingRef.current = true;
    if (tool === "paint" && selectedBlockId) paintCell(cell.x, cell.y, selectedBlockId);
    if (tool === "erase") paintCell(cell.x, cell.y, null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }
    const cell = cellFromEvent(e);
    setHoverCell(cell);
    if (!isDrawingRef.current) return;
    if (tool === "paint" && selectedBlockId) paintCell(cell.x, cell.y, selectedBlockId);
    if (tool === "erase") paintCell(cell.x, cell.y, null);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      return;
    }
    if (tool === "rect" && rectStart && hoverCell) {
      const x1 = Math.max(0, Math.min(rectStart.x, hoverCell.x));
      const y1 = Math.max(0, Math.min(rectStart.y, hoverCell.y));
      const x2 = Math.min(wCells - 1, Math.max(rectStart.x, hoverCell.x));
      const y2 = Math.min(hCells - 1, Math.max(rectStart.y, hoverCell.y));
      setLayers((prev) => {
        const key = String(currentLayer);
        const layer = { ...(prev[key] ?? {}) };
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const ck = `${x},${y}`;
            if (selectedBlockId) layer[ck] = selectedBlockId;
            else delete layer[ck];
          }
        }
        return { ...prev, [key]: layer };
      });
      setDirty(true);
      setRectStart(null);
    }
    isDrawingRef.current = false;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cellX = (mx - pan.x) / zoom;
    const cellY = (my - pan.y) / zoom;
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const newZoom = Math.max(2, Math.min(40, zoom * factor));
    setPan({ x: mx - cellX * newZoom, y: my - cellY * newZoom });
    setZoom(newZoom);
  };

  // ---------------- Quantity computation ----------------
  const quantities = useMemo(() => {
    const perLayer: Record<string, Record<string, number>> = {};
    const total: Record<string, number> = {};
    for (const [layerKey, cells] of Object.entries(layers)) {
      const counts: Record<string, number> = {};
      for (const blockId of Object.values(cells)) {
        counts[blockId] = (counts[blockId] ?? 0) + 1;
        total[blockId] = (total[blockId] ?? 0) + 1;
      }
      perLayer[layerKey] = counts;
    }
    return { perLayer, total };
  }, [layers]);

  // ---------------- Loaders / mutations ----------------
  const loadPlan = async (id: string) => {
    const { plan } = await getPlan({ data: { id } });
    setPlanId(plan.id);
    setPlanName(plan.name);
    setWidthChunks(plan.width_chunks);
    setHeightChunks(plan.height_chunks);
    setLayersCount(plan.layers_count);
    setCurrentLayer(0);
    setLayers((plan.layers as LayersMap) ?? {});
    setDirty(false);
    setPan({ x: 20, y: 20 });
  };

  const newPlan = useMutation({
    mutationFn: async (input: { name: string; w: number; h: number; layers: number }) => {
      const res = await crPlan({
        data: {
          name: input.name,
          width_chunks: input.w,
          height_chunks: input.h,
          layers_count: input.layers,
        },
      });
      return res.plan;
    },
    onSuccess: async (plan) => {
      qc.invalidateQueries({ queryKey: ["pdc-plans"] });
      await loadPlan(plan.id);
      toast.success("Plan créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Aucun plan chargé");
      await savPlan({
        data: { id: planId, name: planName, layers_count: layersCount, layers },
      });
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["pdc-plans"] });
      toast.success("Plan sauvegardé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePlan = useMutation({
    mutationFn: async (id: string) => {
      await delPlan({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdc-plans"] });
      setPlanId(null);
      setLayers({});
      toast.success("Plan supprimé");
    },
  });

  // ---------------- New plan form ----------------
  const [npName, setNpName] = useState("");
  const [npW, setNpW] = useState(11);
  const [npH, setNpH] = useState(11);
  const [npLayers, setNpLayers] = useState(1);

  // ---------------- Block palette form ----------------
  const [bName, setBName] = useState("");
  const [bColor, setBColor] = useState("#aa66ff");
  const [bKind, setBKind] = useState<"block" | "liquid">("block");
  const addBlock = useMutation({
    mutationFn: async () => {
      await crBlock({ data: { name: bName, color: bColor, kind: bKind } });
    },
    onSuccess: () => {
      setBName("");
      qc.invalidateQueries({ queryKey: ["pdc-blocks"] });
      toast.success("Bloc ajouté");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      await delBlock({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdc-blocks"] });
    },
  });

  // ---------------- Layer change ----------------
  const setLayerCountSafe = (n: number) => {
    const v = Math.max(1, Math.min(256, Math.floor(n)));
    setLayersCount(v);
    if (currentLayer >= v) setCurrentLayer(v - 1);
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Plan de coupe (PDC)</h1>
          <p className="text-xs text-muted-foreground">Éditeur de base claim · 1 chunk = 16×16 blocs</p>
        </div>
        <div className="flex items-center gap-2">
          {planId && (
            <>
              <Input
                value={planName}
                onChange={(e) => { setPlanName(e.target.value); setDirty(true); }}
                className="w-56 h-8"
              />
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
                <Save className="size-4" /> Sauvegarder{dirty ? " *" : ""}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="editor" className="w-full">
        <TabsList>
          <TabsTrigger value="editor"><Brush className="size-4 mr-1" />Éditeur</TabsTrigger>
          <TabsTrigger value="plans"><FolderOpen className="size-4 mr-1" />Mes plans</TabsTrigger>
          <TabsTrigger value="palette"><Droplet className="size-4 mr-1" />Palette</TabsTrigger>
          <TabsTrigger value="new"><FilePlus2 className="size-4 mr-1" />Nouveau</TabsTrigger>
        </TabsList>

        {/* ----- Editor ----- */}
        <TabsContent value="editor" className="space-y-3">
          {!planId ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun plan chargé. Crée un nouveau plan ou ouvre un plan existant.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-3">
              {/* Left: tools + palette */}
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Outils</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant={tool === "paint" ? "default" : "outline"} onClick={() => setTool("paint")}><Brush className="size-4" />Pinceau</Button>
                    <Button size="sm" variant={tool === "rect" ? "default" : "outline"} onClick={() => setTool("rect")}><Square className="size-4" />Rect</Button>
                    <Button size="sm" variant={tool === "erase" ? "default" : "outline"} onClick={() => setTool("erase")}><Eraser className="size-4" />Gomme</Button>
                    <Button size="sm" variant={tool === "pick" ? "default" : "outline"} onClick={() => setTool("pick")}><Pipette className="size-4" />Pioche</Button>
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(40, z * 1.25))}><ZoomIn className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(2, z / 1.25))}><ZoomOut className="size-4" /></Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-1"><Layers className="size-4" />Couches</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs shrink-0">Total</Label>
                      <Input type="number" min={1} max={256} value={layersCount} onChange={(e) => setLayerCountSafe(Number(e.target.value))} className="h-7" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs shrink-0">Active</Label>
                      <Select value={String(currentLayer)} onValueChange={(v) => setCurrentLayer(Number(v))}>
                        <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: layersCount }).map((_, i) => (
                            <SelectItem key={i} value={String(i)}>Couche {i + 1}{layers[String(i)] && Object.keys(layers[String(i)]).length > 0 ? " ●" : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => {
                      if (!confirm(`Vider la couche ${currentLayer + 1} ?`)) return;
                      setLayers((p) => ({ ...p, [String(currentLayer)]: {} }));
                      setDirty(true);
                    }}>Vider cette couche</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Palette</CardTitle></CardHeader>
                  <CardContent className="space-y-1 max-h-[40vh] overflow-y-auto">
                    {blocks.length === 0 && <p className="text-xs text-muted-foreground">Aucun bloc. Ajoute-en via l'onglet Palette.</p>}
                    {blocks.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => { setSelectedBlockId(b.id); setTool("paint"); }}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-accent ${selectedBlockId === b.id ? "ring-2 ring-primary bg-accent" : ""}`}
                      >
                        <span className="size-4 rounded border border-zinc-700 shrink-0" style={{ background: b.color }} />
                        <span className="flex-1 text-left truncate">{b.name}</span>
                        {b.kind === "liquid" && <Droplet className="size-3 text-cyan-400" />}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Canvas */}
              <div ref={containerRef} className="relative bg-[#0a0a0c] border border-zinc-800 rounded min-h-[60vh] overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair touch-none"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={() => { setHoverCell(null); isDrawingRef.current = false; }}
                  onWheel={onWheel}
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div className="absolute bottom-2 left-2 text-[10px] text-zinc-500 bg-black/60 px-2 py-1 rounded font-mono">
                  {widthChunks}×{heightChunks} chunks · {wCells}×{hCells} blocs · zoom {zoom.toFixed(1)}x
                  {hoverCell && hoverCell.x >= 0 && hoverCell.y >= 0 && hoverCell.x < wCells && hoverCell.y < hCells && (
                    <> · ({hoverCell.x},{hoverCell.y})</>
                  )}
                </div>
                <div className="absolute top-2 right-2 text-[10px] text-zinc-500 bg-black/60 px-2 py-1 rounded">
                  Clic droit / molette = déplacer · Molette = zoom
                </div>
              </div>

              {/* Right: quantities */}
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Quantités — couche {currentLayer + 1}</CardTitle></CardHeader>
                  <CardContent className="space-y-1 max-h-[35vh] overflow-y-auto">
                    {Object.entries(quantities.perLayer[String(currentLayer)] ?? {}).length === 0 && (
                      <p className="text-xs text-muted-foreground">Couche vide.</p>
                    )}
                    {Object.entries(quantities.perLayer[String(currentLayer)] ?? {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([bid, n]) => {
                        const b = blockMap.get(bid);
                        if (!b) return null;
                        return (
                          <div key={bid} className="flex items-center gap-2 text-xs">
                            <span className="size-3 rounded" style={{ background: b.color }} />
                            <span className="flex-1 truncate">{b.name}</span>
                            <span className="font-mono">{n}</span>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Total toutes couches</CardTitle></CardHeader>
                  <CardContent className="space-y-1 max-h-[35vh] overflow-y-auto">
                    {Object.entries(quantities.total).length === 0 && (
                      <p className="text-xs text-muted-foreground">Plan vide.</p>
                    )}
                    {Object.entries(quantities.total)
                      .sort((a, b) => b[1] - a[1])
                      .map(([bid, n]) => {
                        const b = blockMap.get(bid);
                        if (!b) return null;
                        const stacks = Math.floor(n / 64);
                        const rest = n % 64;
                        return (
                          <div key={bid} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="size-3 rounded" style={{ background: b.color }} />
                              <span className="flex-1 truncate">{b.name}</span>
                              <span className="font-mono font-bold">{n}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground pl-5">
                              {stacks > 0 ? `${stacks} stack${stacks > 1 ? "s" : ""}` : ""}{stacks > 0 && rest > 0 ? " + " : ""}{rest > 0 ? `${rest}` : ""}
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ----- Plans list ----- */}
        <TabsContent value="plans">
          <Card>
            <CardHeader><CardTitle className="text-base">Plans sauvegardés</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(plansData?.plans ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun plan enregistré.</p>
              )}
              {(plansData?.plans ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded border border-zinc-800 hover:bg-accent">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.width_chunks}×{p.height_chunks} chunks · {p.layers_count} couche{p.layers_count > 1 ? "s" : ""} · {p.created_by_username ?? "—"} · {new Date(p.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadPlan(p.id)}>Ouvrir</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) removePlan.mutate(p.id); }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----- Palette ----- */}
        <TabsContent value="palette">
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Ajouter un bloc / liquide</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nom</Label>
                  <Input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Ex: Big Obsidienne" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Couleur</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={bColor} onChange={(e) => setBColor(e.target.value)} className="h-9 w-12 rounded border border-input bg-transparent" />
                    <Input value={bColor} onChange={(e) => setBColor(e.target.value)} className="font-mono" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={bKind} onValueChange={(v) => setBKind(v as "block" | "liquid")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Bloc</SelectItem>
                      <SelectItem value="liquid">Liquide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addBlock.mutate()} disabled={!bName || addBlock.isPending}>
                  <Plus className="size-4" />Ajouter
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Palette partagée</CardTitle></CardHeader>
              <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent">
                    <span className="size-5 rounded border border-zinc-700" style={{ background: b.color }} />
                    <span className="flex-1 text-sm">{b.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{b.color}</span>
                    {b.kind === "liquid" && <Droplet className="size-3 text-cyan-400" />}
                    <button onClick={() => { if (confirm(`Supprimer ${b.name} ?`)) removeBlock.mutate(b.id); }}>
                      <Trash2 className="size-4 text-destructive" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ----- New plan ----- */}
        <TabsContent value="new">
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-base">Nouveau plan de coupe</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="Ex: PDC base nord" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Largeur (chunks)</Label>
                  <Input type="number" min={1} max={50} value={npW} onChange={(e) => setNpW(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hauteur (chunks)</Label>
                  <Input type="number" min={1} max={50} value={npH} onChange={(e) => setNpH(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Couches</Label>
                  <Input type="number" min={1} max={256} value={npLayers} onChange={(e) => setNpLayers(Number(e.target.value))} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Surface : {npW * CHUNK_SIZE}×{npH * CHUNK_SIZE} blocs ({npW * CHUNK_SIZE * npH * CHUNK_SIZE} blocs / couche)
              </p>
              <Button onClick={() => newPlan.mutate({ name: npName, w: npW, h: npH, layers: npLayers })} disabled={!npName || newPlan.isPending}>
                <Plus className="size-4" />Créer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
