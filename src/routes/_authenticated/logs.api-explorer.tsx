import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";

import { Guard } from "@/components/Guard";
import { PageHeader, ErrorBlock } from "@/components/tools/ToolsUi";
import { PaladiumRateLimits } from "@/components/tools/PaladiumRateLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toUserMessage } from "@/lib/errors";
import { resolveUuid } from "@/lib/paladium/api";
import { updateRate } from "@/lib/paladium/rate-limits";
import {
  buildExplorerPath,
  EXPLORER_ENDPOINTS,
  isExplorerRequestReady,
  LEADERBOARD_ID_SUGGESTIONS,
  type ExplorerParam,
} from "@/lib/paladium/explorer-catalog";
import { exploreRawPaladiumEndpoint } from "@/lib/paladium/paladium-explorer.functions";

export const Route = createFileRoute("/_authenticated/logs/api-explorer")({
  head: () => ({ meta: [{ title: "Explorateur API · Logs · PunkAstik" }] }),
  component: () => (
    <Guard perm="paladium.debug">
      <ApiExplorerPage />
    </Guard>
  ),
});

const STATUS_LABELS: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

const ENDPOINT_GROUPS: Array<[string, typeof EXPLORER_ENDPOINTS]> = (() => {
  const map = new Map<string, typeof EXPLORER_ENDPOINTS>();
  for (const e of EXPLORER_ENDPOINTS) {
    if (!map.has(e.group)) map.set(e.group, []);
    map.get(e.group)!.push(e);
  }
  return Array.from(map.entries());
})();

function formatBody(body: string): { text: string; isJson: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(body), null, 2), isJson: true };
  } catch {
    return { text: body, isJson: false };
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier");
  } catch {
    toast.error("Impossible de copier");
  }
}

function StatusBadge({ status }: { status: number }) {
  const cls =
    status >= 200 && status < 300
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status >= 400 && status < 500
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <Badge variant="outline" className={`${cls} text-sm`}>
      {status} {STATUS_LABELS[status] ?? ""}
    </Badge>
  );
}

function RateStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border border-border bg-card p-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="text-sm font-mono">{value ?? "—"}</div>
    </div>
  );
}

function ApiExplorerPage() {
  const exploreFn = useServerFn(exploreRawPaladiumEndpoint);

  const [endpointId, setEndpointId] = useState(EXPLORER_ENDPOINTS[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [resolveInputs, setResolveInputs] = useState<Record<string, string>>({});

  const endpoint = useMemo(
    () => EXPLORER_ENDPOINTS.find((e) => e.id === endpointId) ?? EXPLORER_ENDPOINTS[0],
    [endpointId],
  );
  const path = useMemo(() => buildExplorerPath(endpoint, values), [endpoint, values]);
  const ready = isExplorerRequestReady(endpoint, values);

  const mutation = useMutation({
    mutationFn: (requestPath: string) => exploreFn({ data: { path: requestPath } }),
    onSuccess: (res, requestPath) => updateRate(requestPath, res.rate),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const resolveMutation = useMutation({
    mutationFn: (username: string) => resolveUuid(username),
    onSuccess: (data, username) => {
      setValues((v) => ({ ...v, uuid: data.id }));
      toast.success(`${username} → ${data.id}`);
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  function selectEndpoint(id: string) {
    const next = EXPLORER_ENDPOINTS.find((e) => e.id === id) ?? EXPLORER_ENDPOINTS[0];
    setEndpointId(id);
    const initial: Record<string, string> = {};
    if (next.params.some((p) => p.type === "page")) initial.page = "1";
    setValues(initial);
    setResolveInputs({});
    mutation.reset();
  }

  function setParam(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function renderParamField(param: ExplorerParam) {
    const value = values[param.name] ?? "";

    if (param.type === "leaderboardId") {
      return (
        <div key={param.name}>
          <label className="text-xs text-muted-foreground">{param.label}</label>
          <Input
            list="leaderboard-id-suggestions"
            value={value}
            placeholder={param.placeholder}
            onChange={(e) => setParam(param.name, e.target.value)}
          />
        </div>
      );
    }

    if (param.type === "page") {
      return (
        <div key={param.name}>
          <label className="text-xs text-muted-foreground">{param.label}</label>
          <Input
            type="number"
            min={1}
            value={value}
            placeholder={param.placeholder}
            onChange={(e) => setParam(param.name, e.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={param.name}>
        <label className="text-xs text-muted-foreground">{param.label}</label>
        <Input
          value={value}
          placeholder={param.placeholder}
          onChange={(e) => setParam(param.name, e.target.value)}
        />
        {param.type === "uuid" && (
          <div className="flex gap-2 mt-1.5">
            <Input
              className="flex-1 text-xs h-8"
              placeholder="Résoudre depuis un pseudo…"
              value={resolveInputs[param.name] ?? ""}
              onChange={(e) => setResolveInputs((r) => ({ ...r, [param.name]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!(resolveInputs[param.name] ?? "").trim() || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate((resolveInputs[param.name] ?? "").trim())}
            >
              {resolveMutation.isPending ? "…" : "Résoudre pseudo → UUID"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const response = mutation.data;
  const formatted = response ? formatBody(response.body) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="// api-explorer"
        title="Explorateur API Paladium"
        description="Debug brut : choisis un endpoint, remplis les paramètres, envoie. La réponse JSON exacte de Paladium s'affiche ci-dessous — status HTTP et headers de rate-limit inclus. Réservé au staff faction."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requête</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Endpoint</label>
            <Select value={endpointId} onValueChange={selectEndpoint}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {ENDPOINT_GROUPS.map(([group, endpoints]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {endpoints.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {endpoint.params.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">{endpoint.params.map(renderParamField)}</div>
          )}

          <datalist id="leaderboard-id-suggestions">
            {LEADERBOARD_ID_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3">
            <code className="text-xs font-mono text-muted-foreground break-all">GET {path}</code>
            <Button onClick={() => mutation.mutate(path)} disabled={!ready || mutation.isPending}>
              <Send className="size-4 mr-1.5" />
              {mutation.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {mutation.isError && (
        <ErrorBlock
          message={toUserMessage(mutation.error)}
          hint="Cette erreur vient de l'appli (session, rate-limit local, réseau) — pas de Paladium. Une réponse Paladium (même 404/429) s'affiche normalement dans le bloc Réponse ci-dessous."
        />
      )}

      {response && formatted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3 flex-wrap">
              Réponse
              <StatusBadge status={response.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <RateStat label="Limit" value={response.rate.limit} />
              <RateStat label="Remaining" value={response.rate.remaining} />
              <RateStat label="Reset (s)" value={response.rate.reset} />
            </div>

            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 z-10"
                onClick={() => copyToClipboard(formatted.text)}
              >
                <Copy className="size-3.5 mr-1" /> Copier
              </Button>
              <pre className="text-xs font-mono p-4 pt-12 bg-muted rounded overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
                {formatted.text}
              </pre>
            </div>
            {!formatted.isJson && (
              <p className="text-xs text-muted-foreground">
                Réponse non-JSON — affichée telle quelle.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <PaladiumRateLimits />
    </div>
  );
}
