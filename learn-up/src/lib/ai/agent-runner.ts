import { getAICompletion } from "@/lib/ai";
import { executeUnifiedTool } from "./tool-executor";
import { parseToolCalls, type ParsedToolAction } from "./tool-parser";
import { getToolDefinition, shouldExecuteTool, type ToolActionState } from "./tool-contract";

type ToolAction = ParsedToolAction;

export interface AgentLoopOptions {
  maxSteps?: number;
  maxParallelTools?: number;
  sessionId?: string | null;
  userId?: string | null;
  isAutonomous?: boolean;
  permissions?: string[];
  onFormulaExtracted?: (formulas: string[]) => Promise<void>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  displayMessage: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentLoopResult {
  response: string;
  actions?: ToolAction[];
  executedActions?: ToolAction[];
  error?: string;
}

export const MAX_TOOL_STEPS = 8;
export const MAX_PARALLEL_TOOLS = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function toToolResult(raw: any): ToolResult {
  const success = Boolean(raw?.success);
  return {
    success,
    data: raw?.data,
    displayMessage: String(raw?.displayMessage || raw?.message || (success ? "Acción completada." : "No se pudo completar la acción.")),
    error: raw?.error ? String(raw.error) : undefined,
    metadata: raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : undefined,
  };
}

function toolResultForModel(action: ToolAction, result: ToolResult): string {
  return JSON.stringify({
    tool: action.tool,
    success: result.success,
    data: result.data,
    displayMessage: result.displayMessage,
    error: result.error,
    metadata: result.metadata,
  });
}

function sanitizeSystemPrompt(prompt: string): string {
  return prompt
    .replace(/\n?\s*\d+\.\s*Si necesitas usar una herramienta \(tool\), DEBES responder EXCLUSIVAMENTE con un bloque tool \{\.\.\.\} tal como espera el sistema\.?/gi, "")
    .replace(/\n?\s*La herramienta debe ser llamada en formato JSON\.?/gi, "")
    .replace(/\n?\s*DEBES responder EXCLUSIVAMENTE con un bloque tool[^\n]*/gi, "")
    .replace(/\n?\s*Dentro de <thinking>[\s\S]*?NUNCA omitas el bloque <thinking>\.?/gi, "")
    .replace(/\n?\s*Antes de responder al usuario, DEBES incluir un bloque de pensamiento oculto[\s\S]*?NUNCA omitas el bloque <thinking>\.?/gi, "")
    .replace(/\n?\s*Siempre que exista una tool[\s\S]*?formato JSON/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pendingResponse(actions: ToolAction[]): string {
  if (actions.length === 1) return `Preparé una acción para ti: ${actions[0].description}`;
  return `Preparé ${actions.length} acciones para ti. Revisa y autoriza las que quieras ejecutar.`;
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
  const permissions = options.permissions ?? ["ai.tools.execute"];
  const executedActions: ToolAction[] = [];
  const currentMessages: { role: "user" | "assistant" | "system"; content: string | any[] }[] = [
    { role: "system", content: sanitizeSystemPrompt(systemPrompt) },
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

    const pending: ToolAction[] = [];
    const executable: ToolAction[] = [];
    for (const action of actions) {
      const definition = getToolDefinition(action.tool);
      if (!definition) continue;
      const decision = shouldExecuteTool(
        definition,
        options.isAutonomous ? "autopilot" : "manual",
        definition.risk,
        permissions,
      );
      if (decision === "pending_confirmation") pending.push(action);
      if (decision === "execute") executable.push(action);
    }

    if (pending.length) {
      return {
        response: cleanText || pendingResponse(pending),
        actions: pending,
        executedActions: executedActions.length ? executedActions : undefined,
      };
    }

    if (!executable.length) {
      return {
        response: cleanText || "No tengo autorización para realizar esa acción.",
        executedActions: executedActions.length ? executedActions : undefined,
      };
    }

    const allResults: Array<{ action: ToolAction; state: ToolActionState; result: ToolResult }> = [];
    for (const batch of chunk(executable, maxParallel)) {
      const results = await Promise.all(batch.map(async action => {
        const started = Date.now();
        try {
          console.log(`[TOOL] id=${action.tool}-${started} name=${action.tool} status=running`);
          const raw = await executeUnifiedTool(action.tool, { ...action.args }, options.userId || "", options.sessionId);
          const result = toToolResult(raw);
          console.log(`[TOOL] id=${action.tool}-${started} name=${action.tool} status=${result.success ? "success" : "error"}`);
          return { action, state: result.success ? "success" as const : "error" as const, result };
        } catch (error: any) {
          const result: ToolResult = { success: false, displayMessage: "No se pudo completar la acción.", error: error?.message || "Error de herramienta" };
          console.error(`[TOOL] id=${action.tool}-${started} name=${action.tool} status=error`);
          return { action, state: "error" as const, result };
        }
      }));
      allResults.push(...results);
      executedActions.push(...batch);
    }

    currentMessages.push({ role: "assistant", content: cleanText || "He realizado parte de la tarea." });
    currentMessages.push({
      role: "user",
      content: allResults.map(({ action, result }) => toolResultForModel(action, result)).join("\n\n") +
        "\n\nContinúa la tarea con estos resultados. Usa más herramientas si son necesarias. No expongas nombres de funciones, JSON interno, IDs, stack traces ni protocolos de ejecución al usuario.",
    });
  }

  return { response: lastCleanText || "No pude completar la tarea dentro del límite de pasos.", executedActions: executedActions.length ? executedActions : undefined };
}
