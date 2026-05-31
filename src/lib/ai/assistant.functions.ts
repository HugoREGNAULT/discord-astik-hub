/**
 * Assistant IA staff — boucle tool-calling via Lovable AI Gateway.
 *
 * - Filtre les outils par permission AVANT exposition au modèle.
 * - Max 5 itérations pour éviter une boucle infinie.
 * - Renvoie la réponse texte + le détail brut des outils invoqués
 *   (ce qui sera affiché dans l'UI pour transparence).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require.server";
import { ASSISTANT_TOOLS, getToolsFor, type AssistantTool } from "@/lib/ai/tools.server";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = `Tu réponds aux questions du staff sur la faction PunkAstik UNIQUEMENT à partir des outils fournis. Si un outil manque pour répondre, dis-le clairement. Cite les chiffres exacts retournés. Ne JAMAIS inventer une donnée. Réponds en français, ton concis, formaté en markdown léger.`;

const askSchema = z.object({
  question: z.string().trim().min(1).max(1000),
});

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ToolResultEntry {
  name: string;
  argsJson: string;
  resultJson: string;
  error?: string;
}

export interface AssistantAnswer {
  ok: boolean;
  answer: string;
  toolResults: ToolResultEntry[];
  iterations: number;
  error?: string;
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string }) => askSchema.parse(input))
  .handler(async ({ data }): Promise<AssistantAnswer> => {
    const user = await requireSession();
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        answer: "",
        toolResults: [],
        iterations: 0,
        error: "LOVABLE_API_KEY missing",
      };
    }

    const availableTools = getToolsFor(user);
    const toolByName = new Map<string, AssistantTool>(
      availableTools.map((t) => [t.name, t]),
    );
    const toolsPayload = availableTools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: data.question },
    ];
    const toolResults: ToolResultEntry[] = [];

    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      let resp: Response;
      try {
        resp = await fetch(AI_GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages,
            ...(toolsPayload.length > 0 ? { tools: toolsPayload } : {}),
          }),
        });
      } catch (err) {
        return {
          ok: false,
          answer: "",
          toolResults,
          iterations,
          error: err instanceof Error ? err.message : "fetch failed",
        };
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("assistant: gateway error", resp.status, body);
        if (resp.status === 429) {
          return {
            ok: false,
            answer: "",
            toolResults,
            iterations,
            error: "Limite de requêtes atteinte, réessaie dans un instant.",
          };
        }
        if (resp.status === 402) {
          return {
            ok: false,
            answer: "",
            toolResults,
            iterations,
            error: "Crédits IA épuisés, ajoute des crédits à l'espace Lovable.",
          };
        }
        return {
          ok: false,
          answer: "",
          toolResults,
          iterations,
          error: `AI gateway ${resp.status}`,
        };
      }

      const json = (await resp.json()) as {
        choices?: Array<{
          message?: {
            role?: string;
            content?: string | null;
            tool_calls?: ChatMessage["tool_calls"];
          };
          finish_reason?: string;
        }>;
      };
      const choice = json.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return {
          ok: false,
          answer: "",
          toolResults,
          iterations,
          error: "Réponse IA vide",
        };
      }

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        return {
          ok: true,
          answer: (msg.content ?? "").trim(),
          toolResults,
          iterations,
        };
      }

      // On garde le message assistant (avec tool_calls) puis on append les résultats.
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: calls,
      });

      for (const call of calls) {
        const tool = toolByName.get(call.function.name);
        let parsedArgs: unknown = {};
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          parsedArgs = {};
        }

        if (!tool) {
          const errPayload = { error: `Outil inconnu ou non autorisé: ${call.function.name}` };
          toolResults.push({
            name: call.function.name,
            args: parsedArgs,
            result: errPayload,
            error: errPayload.error,
          });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(errPayload),
          });
          continue;
        }

        try {
          const validated = tool.zod.parse(parsedArgs);
          const result = await tool.run(validated, user);
          toolResults.push({ name: tool.name, args: validated, result });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: tool.name,
            content: JSON.stringify(result),
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "tool failed";
          toolResults.push({
            name: tool.name,
            args: parsedArgs,
            result: { error: errorMsg },
            error: errorMsg,
          });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: tool.name,
            content: JSON.stringify({ error: errorMsg }),
          });
        }
      }
    }

    return {
      ok: false,
      answer: "",
      toolResults,
      iterations,
      error: `Limite de ${MAX_ITERATIONS} itérations atteinte sans réponse finale.`,
    };
  });

/** Liste des outils disponibles pour l'UI (juste nom + description, pas de logique exposée). */
export const listAssistantTools = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const tools = getToolsFor(user);
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      requiredPerm: t.requiredPerm,
    })),
    totalRegistered: ASSISTANT_TOOLS.length,
  };
});
