import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  summarizeDisciplinary,
  type DisciplinarySummary,
} from "@/lib/data/disciplinary.functions";

interface Props {
  discordId: string;
}

/** Mini renderer markdown sûr (gras, italique, listes, paragraphes). */
function renderMd(md: string): string {
  const esc = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 space-y-1 my-2">');
        inList = true;
      }
      out.push(`<li>${inline(esc(line.replace(/^[-*]\s+/, "")))}</li>`);
    } else if (line === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<p class="my-2">${inline(esc(line))}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}
function inline(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, "$1<em>$2</em>");
}

export function DisciplinarySummaryCard({ discordId }: Props) {
  const [result, setResult] = useState<DisciplinarySummary | null>(null);
  const fn = useServerFn(summarizeDisciplinary);

  const m = useMutation({
    mutationFn: () => fn({ data: { discordId } }),
    onSuccess: (r) => setResult(r),
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Synthèse disciplinaire (IA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && (
          <p className="text-sm text-muted-foreground">
            Génère un résumé neutre des warnings et notes pour préparer une
            décision. L'IA ne propose <strong>aucune sanction</strong>.
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => m.mutate()}
          disabled={m.isPending}
        >
          {m.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" /> Analyse…
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-2" />
              {result ? "Régénérer" : "Générer la synthèse"}
            </>
          )}
        </Button>

        {result && (
          <>
            <div
              className="text-sm rounded border border-border bg-muted/30 p-3 prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderMd(result.summary) }}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Résumé indicatif — toute sanction reste une décision humaine.
            </p>

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Sources brutes ({result.counts.warnings} warning
                {result.counts.warnings > 1 ? "s" : ""} ·{" "}
                {result.counts.notes} note
                {result.counts.notes > 1 ? "s" : ""})
              </summary>
              <div className="mt-2 space-y-2">
                {result.sources.warnings.length > 0 && (
                  <div>
                    <div className="font-medium text-foreground mb-1">
                      Warnings
                    </div>
                    <ul className="space-y-1.5">
                      {result.sources.warnings.map((w) => (
                        <li
                          key={w.id}
                          className="border border-destructive/40 bg-destructive/5 rounded p-2"
                        >
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(w.created_at).toLocaleString()} ·{" "}
                            {w.staff_username ?? "—"}
                          </div>
                          <div className="whitespace-pre-wrap text-foreground">
                            {w.body}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.sources.notes.length > 0 && (
                  <div>
                    <div className="font-medium text-foreground mb-1 mt-2">
                      Notes
                    </div>
                    <ul className="space-y-1.5">
                      {result.sources.notes.map((n) => (
                        <li
                          key={n.id}
                          className="border border-border rounded p-2 bg-background"
                        >
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()} ·{" "}
                            {n.staff_username ?? "—"}
                          </div>
                          <div className="whitespace-pre-wrap text-foreground">
                            {n.body}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
