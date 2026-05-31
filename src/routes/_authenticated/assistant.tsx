import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Send, Sparkles, ShieldAlert } from "lucide-react";
import { PageHeader, PageCard } from "@/components/tools/ToolsUi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { toUserMessage } from "@/lib/errors";
import {
  askAssistant,
  type AssistantAnswer,
  type ToolResultEntry,
} from "@/lib/ai/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Assistant IA · PunkAstik" }] }),
  component: AssistantPage,
});

interface HistoryEntry {
  id: string;
  question: string;
  answer: AssistantAnswer;
}

function AssistantPage() {
  const me = useCurrentUser();
  const canUse = hasPerm(me, "members.view");

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const ask = useServerFn(askAssistant);

  const mutation = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q } }),
    onSuccess: (res, q) => {
      setHistory((prev) => [
        { id: `${Date.now()}`, question: q, answer: res },
        ...prev,
      ]);
      setQuestion("");
    },
  });

  if (!canUse) {
    return (
      <div className="space-y-4">
        <PageHeader
          icon={<Sparkles className="size-5" />}
          title="Assistant IA"
          description="Pose des questions sur la faction en langage naturel."
        />
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title="Accès réservé au staff"
          description="Tu n'as pas la permission de consulter cet assistant."
        />
      </div>
    );
  }

  const submit = () => {
    const q = question.trim();
    if (!q || mutation.isPending) return;
    mutation.mutate(q);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Sparkles className="size-5" />}
        title="Assistant IA"
        description="Réponses générées à partir des données ci-dessous — aucune action n'est exécutée."
      />

      <PageCard title="Question">
        <div className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex : qui sont les 5 plus gros contributeurs des 7 derniers jours ?"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            disabled={mutation.isPending}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              ⌘/Ctrl + Entrée pour envoyer. L'historique reste dans cet onglet uniquement.
            </p>
            <Button onClick={submit} disabled={!question.trim() || mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Demander
            </Button>
          </div>
          {mutation.isError ? (
            <p className="text-sm text-destructive">{toUserMessage(mutation.error)}</p>
          ) : null}
        </div>
      </PageCard>

      {history.length === 0 && !mutation.isPending ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Aucune question pour l'instant"
          description="L'assistant n'a accès qu'aux outils de lecture autorisés par ton rôle."
        />
      ) : null}

      {history.map((entry) => (
        <AnswerCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function AnswerCard({ entry }: { entry: HistoryEntry }) {
  const { question, answer } = entry;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Question
          </p>
          <p className="text-sm">{question}</p>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-400">
            Réponse
          </p>
          {answer.ok ? (
            <AssistantMarkdown content={answer.answer} />
          ) : (
            <p className="text-sm text-destructive">{answer.error ?? "Erreur"}</p>
          )}
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Réponse générée à partir des données ci-dessous · {answer.iterations} appel(s) modèle
          </p>
        </div>

        {answer.toolResults.length > 0 ? (
          <Accordion type="single" collapsible>
            <AccordionItem value="data">
              <AccordionTrigger className="text-sm">
                🔍 Données utilisées ({answer.toolResults.length} outil
                {answer.toolResults.length > 1 ? "s" : ""})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {answer.toolResults.map((tr, i) => (
                    <ToolResultBlock key={i} entry={tr} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ToolResultBlock({ entry }: { entry: ToolResultEntry }) {
  let prettyArgs = entry.argsJson;
  let prettyResult = entry.resultJson;
  try {
    prettyArgs = JSON.stringify(JSON.parse(entry.argsJson), null, 2);
  } catch {
    /* ignore */
  }
  try {
    prettyResult = JSON.stringify(JSON.parse(entry.resultJson), null, 2);
  } catch {
    /* ignore */
  }
  return (
    <div className="rounded border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">
          {entry.name}
        </Badge>
        {entry.error ? <Badge variant="destructive">erreur</Badge> : null}
      </div>
      <details className="mb-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Arguments</summary>
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-tight">
          {prettyArgs}
        </pre>
      </details>
      <details open>
        <summary className="cursor-pointer text-xs text-muted-foreground">Résultat</summary>
        <pre className="mt-1 max-h-80 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-tight">
          {prettyResult}
        </pre>
      </details>
    </div>
  );
}

/** Mini renderer markdown — même approche que le digest. */
function AssistantMarkdown({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length > 0) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 text-sm">
          {listBuf.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(l) }} />
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (line.startsWith("# ")) {
      out.push(
        <h3 key={out.length} className="text-lg font-bold tracking-tight">
          {line.slice(2)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      out.push(
        <h4
          key={out.length}
          className="text-sm font-semibold uppercase tracking-wider text-pink-400 mt-3"
        >
          {line.slice(3)}
        </h4>,
      );
    } else if (line.trim() === "") {
      // skip
    } else {
      out.push(
        <p
          key={out.length}
          className="text-sm leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }}
        />,
      );
    }
  }
  flushList();
  return <div className="space-y-2">{out}</div>;
}

function renderInline(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">$1</code>');
}
