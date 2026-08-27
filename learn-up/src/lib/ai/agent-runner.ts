import { getAICompletion } from "@/lib/ai";
import { parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";

export interface AgentLoopOptions {
  maxSteps?: number;
  sessionId?: string | null;
  userId?: string | null;
  onFormulaExtracted?: (formulas: string[]) => Promise<void>;
}

export interface AgentLoopResult {
  response: string;
  actions?: ToolAction[];
  executedActions?: ToolAction[];
  error?: string;
}

/**
 * Runs a multi-step agent loop with automatic tool execution, concurrency, and confirmation gates.
 * MAX_TOOL_STEPS prevents infinite loops while allowing multi-tool synthesis.
 */
export async function runAgentLoop(
  systemPrompt: string,
  history: { role: "user" | "assistant" | "system"; content: string | any[] }[] = [],
  userMessage: string | any[],
  model: string,
  options: AgentLoopOptions = {}
): Promise<AgentLoopResult> {
  const maxSteps = options.maxSteps ?? 5;
  const executedActions: ToolAction[] = [];

  const currentMessages: { role: "user" | "assistant" | "system"; content: string | any[] }[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  let lastCleanText = "";

  for (let step = 0; step < maxSteps; step++) {
    const response = await getAICompletion(currentMessages, model);
    const rawContent = response.choices[0]?.message?.content || "";
    
    let { cleanText, actions } = await parseToolCall(rawContent);

    // Formula extraction hook (for Profesor IA)
    if (options.onFormulaExtracted) {
      const formulasMatch = cleanText.match(/<formula>(.*?)<\/formula>/g);
      if (formulasMatch) {
        const formulas = formulasMatch.map(f => f.replace(/<\/?formula>/g, "").trim());
        await options.onFormulaExtracted(formulas);
        cleanText = cleanText.replace(/<formula>.*?<\/formula>/g, "").trim();
      }
    }

    lastCleanText = cleanText;

    // If no tools requested, we have our final text answer
    if (!actions || actions.length === 0) {
      return {
        response: cleanText,
        executedActions: executedActions.length > 0 ? executedActions : undefined,
      };
    }

    const pendingConfirm = actions.filter((a) => a.requiresConfirm);
    const autoExecute = actions.filter((a) => !a.requiresConfirm);

    // If there are actions that require user confirmation, stop and present them to the user
    if (pendingConfirm.length > 0) {
      return {
        response: cleanText,
        actions: pendingConfirm,
        executedActions: executedActions.length > 0 ? executedActions : undefined,
      };
    }

    // Execute auto-executable actions in parallel with error handling
    if (autoExecute.length > 0) {
      const toolResults = await Promise.all(
        autoExecute.map(async (act) => {
          try {
            const res = await executeToolAction(act.tool, act.args);
            return {
              action: act,
              success: res.success,
              message: res.message,
              data: res.data,
            };
          } catch (err: any) {
            return {
              action: act,
              success: false,
              message: `Error al ejecutar ${act.tool}: ${err.message || err}`,
              data: null,
            };
          }
        })
      );

      executedActions.push(...autoExecute);

      const feedback = toolResults
        .map((r) => `[Resultado de ${r.action.tool}]:\n${r.message}`)
        .join("\n\n");

      // Feed results back to model
      currentMessages.push({
        role: "assistant",
        content: cleanText || `Ejecutando ${autoExecute.map(a => a.tool).join(", ")}...`,
      });
      currentMessages.push({
        role: "user",
        content: `Resultados de las herramientas:\n${feedback}\n\nPor favor continúa con la respuesta o ejecuta la siguiente acción si es necesario.`,
      });
    }
  }

  return {
    response: lastCleanText,
    executedActions: executedActions.length > 0 ? executedActions : undefined,
  };
}
