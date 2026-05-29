import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Brush, Eraser, Trash2, Droplet } from "lucide-react";

export type SliceBlock = {
  id: string;
  name: string;
  color: string;
  kind: "block" | "liquid";
};

type Tool = "paint" | "erase";

type Props = {
  blocks: SliceBlock[];
};

const MAX_DIM = 64;

/**
 * Vertical slice calculator.
 * - Paint the side-view pattern (height × width of the slice) cell by cell.
 * - Enter a depth (length) in blocks.
 * - Total per block = painted_cells_in_slice × depth.
 */
export function PdcSliceCalculator({ blocks }: Props) {
  const [w, setW] = useState(16); // largeur tranche
  const [h, setH] = useState(8); // hauteur tranche
  const [depth, setDepth] = useState(16); // profondeur (longueur)
  const [cells, setCells] = useState<Record<string, string>>({});
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("paint");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const blockMap = useMemo(() => {
    const m = new Map<string, SliceBlock>();
    blocks.forEach((b) => m.set(b.id, b));
    return m;
  }, [blocks]);

  // Canvas drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellSize = 28;

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = w * cellSize;
    const H = h * cellSize;
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    // bg
    ctx.fillStyle = "#141418";
    ctx.fillRect(0, 0, W, H);
    // cells
    for (const [key, bid] of Object.entries(cells)) {
      const [xs, ys] = key.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (x >= w || y >= h) continue;
      const b = blockMap.get(bid);
      if (!b) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, H);
    }
    for (let y = 0; y <= h; y++) {
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(W, y * cellSize + 0.5);
    }
    ctx.stroke();
    // ground line (bottom row highlight)
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }, [w, h, cells, blockMap]);

  useEffect(() => {
    draw();
  }, [draw]);

  const isDrawingRef = useRef(false);

  const cellFromEvent = (clientX: number, clientY: number) => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * w);
    const y = Math.floor(((clientY - rect.top) / rect.height) * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    return { x, y };
  };

  const paintAt = (clientX: number, clientY: number) => {
    const cell = cellFromEvent(clientX, clientY);
    if (!cell) return;
    const key = `${cell.x},${cell.y}`;
    setCells((prev) => {
      const next = { ...prev };
      if (tool === "erase") delete next[key];
      else if (selectedBlockId) next[key] = selectedBlockId;
      return next;
    });
  };

  const hoveredBlock = hover ? blockMap.get(cells[`${hover.x},${hover.y}`] ?? "") : undefined;

  // Quantities
  const totals = useMemo(() => {
    const perSlice: Record<string, number> = {};
    for (const bid of Object.values(cells)) {
      perSlice[bid] = (perSlice[bid] ?? 0) + 1;
    }
    const total: Record<string, number> = {};
    for (const [bid, n] of Object.entries(perSlice)) {
      total[bid] = n * depth;
    }
    return { perSlice, total };
  }, [cells, depth]);

  const filledCells = Object.keys(cells).length;
  const totalBlocks = Object.values(totals.total).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-3">
      {/* Left: settings + palette */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Largeur de la tranche (blocs)</Label>
              <Input
                type="number"
                min={1}
                max={MAX_DIM}
                value={w}
                onChange={(e) =>
                  setW(Math.max(1, Math.min(MAX_DIM, Number(e.target.value) || 1)))
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hauteur de la tranche (blocs)</Label>
              <Input
                type="number"
                min={1}
                max={MAX_DIM}
                value={h}
                onChange={(e) =>
                  setH(Math.max(1, Math.min(MAX_DIM, Number(e.target.value) || 1)))
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profondeur / longueur (blocs)</Label>
              <Input
                type="number"
                min={1}
                max={4096}
                value={depth}
                onChange={(e) =>
                  setDepth(Math.max(1, Math.min(4096, Number(e.target.value) || 1)))
                }
                className="h-8"
              />
              <div className="flex items-center gap-1 pt-1">
                <Label className="text-[10px] text-muted-foreground shrink-0">ou en chunks</Label>
                <Input
                  type="number"
                  min={1}
                  max={256}
                  value={Math.round((depth / 16) * 100) / 100}
                  onChange={(e) => {
                    const c = Math.max(0, Math.min(256, Number(e.target.value) || 0));
                    setDepth(Math.max(1, Math.round(c * 16)));
                  }}
                  className="h-7 text-xs"
                />
                <span className="text-[10px] text-muted-foreground">×16</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Le motif sera répété sur toute la longueur / largeur de la base ({depth} blocs).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Outils</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={tool === "paint" ? "default" : "outline"}
              onClick={() => setTool("paint")}
            >
              <Brush className="size-4" /> Peindre
            </Button>
            <Button
              size="sm"
              variant={tool === "erase" ? "default" : "outline"}
              onClick={() => setTool("erase")}
            >
              <Eraser className="size-4" /> Gomme
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="col-span-2"
              onClick={() => {
                if (confirm("Vider la tranche ?")) setCells({});
              }}
            >
              <Trash2 className="size-4" /> Vider
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[40vh] overflow-y-auto">
            {blocks.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucun bloc. Ajoute-en dans l&apos;onglet Palette.
              </p>
            )}
            {blocks.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBlockId(b.id);
                  setTool("paint");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-accent ${
                  selectedBlockId === b.id ? "ring-2 ring-primary bg-accent" : ""
                }`}
              >
                <span
                  className="size-4 rounded border border-zinc-700 shrink-0"
                  style={{ background: b.color }}
                />
                <span className="flex-1 text-left truncate">{b.name}</span>
                {b.kind === "liquid" && <Droplet className="size-3 text-cyan-400" />}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Center: slice canvas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Coupe verticale (vue de côté) — {w}×{h} blocs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto bg-[#0a0a0c] border border-zinc-800 rounded p-2 max-h-[70vh]">
            <canvas
              ref={canvasRef}
              className="block cursor-crosshair touch-none"
              style={{ imageRendering: "pixelated" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                isDrawingRef.current = true;
                paintAt(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                setHover(cellFromEvent(e.clientX, e.clientY));
                if (isDrawingRef.current) paintAt(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                isDrawingRef.current = false;
              }}
              onPointerLeave={() => {
                isDrawingRef.current = false;
                setHover(null);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-[10px] text-muted-foreground">
              {filledCells} bloc{filledCells > 1 ? "s" : ""} dans la tranche · profondeur ×{depth} ={" "}
              <span className="font-mono">{totalBlocks}</span> blocs au total.
            </p>
            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 min-h-[16px]">
              {hover && (
                <>
                  <span>
                    ({hover.x},{hover.y})
                  </span>
                  {hoveredBlock ? (
                    <>
                      <span
                        className="size-3 rounded border border-zinc-700"
                        style={{ background: hoveredBlock.color }}
                      />
                      <span className="text-foreground">{hoveredBlock.name}</span>
                      {hoveredBlock.kind === "liquid" && (
                        <Droplet className="size-3 text-cyan-400" />
                      )}
                    </>
                  ) : (
                    <span className="opacity-60">vide</span>
                  )}
                </>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Right: totals */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tranche (par bloc)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[30vh] overflow-y-auto">
            {Object.entries(totals.perSlice).length === 0 && (
              <p className="text-xs text-muted-foreground">Tranche vide.</p>
            )}
            {Object.entries(totals.perSlice)
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total ×{depth} de profondeur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[45vh] overflow-y-auto">
            {Object.entries(totals.total).length === 0 && (
              <p className="text-xs text-muted-foreground">—</p>
            )}
            {Object.entries(totals.total)
              .sort((a, b) => b[1] - a[1])
              .map(([bid, n]) => {
                const b = blockMap.get(bid);
                if (!b) return null;
                const stacks = Math.floor(n / 64);
                const rest = n % 64;
                const dchests = Math.floor(stacks / 54);
                const stacksRest = stacks % 54;
                return (
                  <div key={bid} className="text-xs border-b border-zinc-800/60 py-1">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded" style={{ background: b.color }} />
                      <span className="flex-1 truncate">{b.name}</span>
                      <span className="font-mono font-bold">{n}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-5">
                      {dchests > 0 && (
                        <>
                          {dchests} double-coffre{dchests > 1 ? "s" : ""}
                          {stacksRest > 0 || rest > 0 ? " + " : ""}
                        </>
                      )}
                      {stacksRest > 0 && (
                        <>
                          {stacksRest} stack{stacksRest > 1 ? "s" : ""}
                          {rest > 0 ? " + " : ""}
                        </>
                      )}
                      {rest > 0 && <>{rest}</>}
                      {dchests === 0 && stacksRest === 0 && rest === 0 && <>0</>}
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
