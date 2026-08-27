import { getAICompletion } from "@/lib/ai";
import { executeToolAction } from "@/lib/ai-tools";
import { parseToolCalls, type ParsedToolAction } from "./tool-parser";

type ToolAction = ParsedToolAction;

export interface AgentLoopOptions {
  maxSteps?: number;
  maxParallelTools?: number;
  sessionId?: string | null;
  userId?: string | null;
  isAutonomous?: boolean;
  onFormulaExtracted?: (formulas: string[]) => Promise<void>;
}

export interface AgentLoopResult {
  response: string;
  actions?: ToolAction[];
  executedActions?: ToolAction[];
  error?: string;
}

const MAX_TOOL_STEPS = 8;
const MAX_PARALLEL_TOOLS = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export async function runAgentLoop(
  systemPrompt: string,
  history: { role: "user" | "assistant" | "system"; content: string | any[] }[] = [],
  userMessage: string | any[],
  model: string,
  options: AgentLoopOptions = {},
): Promise<AgentLoopResult> {
  const maxSteps = Math.min(options.maxSteps ?? MAX_TOOL_STEPS, MAX_TOOL_STEPS);
  const maxParallel = Math.min(options.maxParallelTools ?? MAX_PARALLEL_TOOLS, MAX_PARALLEL_TOOLS);
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
    const parsed = parseToolCalls(rawContent);
    let cleanText = parsed.cleanText;
    const actions = parsed.actions;

    if (options.onFormulaExtracted && cleanText) {
      const formulas = cleanText.match(/<formula>(.*?)<\/formula>/g);
      if (formulas) {
        await options.onFormulaExtracted(formulas.map(f => f.replace(/<\/?formula>/g, "").trim()));
        cleanText = cleanText.replace(/<formula>.*?<\/formula>/g, "").trim();
      }
    }
    lastCleanText = cleanText;

    if (!actions.length) {
      return { response: cleanText, executedActions: executedActions.length ? executedActions : undefined };
    }

    const pending = options.isAutonomous ? [] : actions.filter(a => a.requiresConfirm);
    if (pending.length) {
      return { response: cleanText, actions: pending, executedActions: executedActions.length ? executedActions : undefined };
    }

    const executable = options.isAutonomous ? actions : actions.filter(a => !a.requiresConfirm);
    if (!executable.length) {
      return { response: cleanText, actions, executedActions: executedActions.length ? executedActions : undefined };
    }

    const allResults: Array<{ action: ToolAction; success: boolean; message: string; data?: any }> = [];
    for (const batch of chunk(executable, maxParallel)) {
      const results = await Promise.all(batch.map(async action => {
        try {
          const result = await executeToolAction(action.tool, { ...action.args, userId: options.userId });
          return { action, success: result.success, message: result.message, data: result.data };
        } catch (error: any) {
          return { action, success: false, message: error?.message || `Error ejecutando ${action.tool}` };
        }
      }));
      allResults.push(...results);
      executedActions.push(...batch);
    }

    currentMessages.push({ role: "assistant", content: cleanText || "He ejecutado las acciones solicitadas." });
    currentMessages.push({
      role: "user",
      content:
        allResults.map(r =>
          `[Resultado de herramienta: ${r.action.tool}]\nsuccess=${r.success}\nmessage=${r.message}\n${r.data !== undefined ? `data=${JSON.stringify(r.data)}` : ""}`,
        ).join("\n\n") +
        "\n\nContinúa la tarea usando estos resultados. Si necesitas otras herramientas, ejecútalas. No muestres llamadas, JSON interno ni código de herramientas al usuario.",
    });
  }

  return {
    response: lastCleanText || "No pude completar la tarea dentro del límite de pasos.",
    executedActions: executedActions.length ? executedActions : undefined,
  };
}
