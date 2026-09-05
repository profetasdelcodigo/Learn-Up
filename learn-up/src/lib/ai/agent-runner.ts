import { getAICompletion } from "@/lib/ai";
import { parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import { aiRegistry } from "./skills";
import { normalizeToolName, shouldExecuteTool, type ToolMode } from "./tool-contract";

export interface AgentLoopOptions {
  maxSteps?: number;
  maxParallelTools?: number;
  sessionId?: string | null;
  userId?: string | null;
  mode?: ToolMode;
  permissions?: boolean;
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
const MAX_SYSTEM_PROMPT_CHARS = 9000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 6000;

function compactSystemPrompt(prompt: string): string {
  if (prompt.length <= MAX_SYSTEM_PROMPT_CHARS) return prompt;
  const headSize = 5200;
  const tailSize = MAX_SYSTEM_PROMPT_CHARS - headSize;
  return `${prompt.slice(0, headSize)}\n\n[Catálogo de herramientas reducido para mantener estabilidad]\n\n${prompt.slice(-tailSize)}`;
}

function compactMessageContent(content: string | any[]): string | any[] {
  if (typeof content !== "string" || content.length <= MAX_MESSAGE_CHARS) return content;
  return `${content.slice(0, MAX_MESSAGE_CHARS)}\n...[mensaje truncado para estabilidad]...`;
}

function sanitizeAssistantText(text: string): string {
  return String(text || "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function_call>[\s\S]*?<\/function_call>/gi, "")
    .replace(/```(?:tool|function_call|json)\s*[\s\S]*?```/gi, "")
    .replace(/^\s*\{\s*"(?:tool|function|function_call)"[\s\S]*?\}\s*$/gim, "")
    .trim();
}

function normalizeAction(action: ToolAction): ToolAction {
  const tool = normalizeToolName(action.tool);
  const registered = aiRegistry.getTool(tool);
  return {
    ...action,
    tool,
    description: action.description || registered?.description || `Preparando ${tool}`,
    requiresConfirm: registered?.requiresConfirmation ?? action.requiresConfirm,
  };
}

function serializeToolResult(data: unknown): string {
  try {
    return JSON.stringify(data, (_key, value) => {
      if (typeof value === "string" && value.length > 8000) return `${value.slice(0, 8000)}...[truncado]`;
      return value;
    });
  } catch {
    return String(data ?? "");
  }
}

function compactToolFeedback(toolResults: Array<{ action: ToolAction; success: boolean; message: string; data: unknown }>): string {
  return toolResults.map((result) => {
    const evidence = serializeToolResult(result.data);
    const safeMessage = String(result.message || (result.success ? "Completado" : "Error al ejecutar")).slice(0, 2500);
    return `[Resultado de herramienta: ${result.action.tool}] ${result.success ? "OK" : "ERROR"}\n${safeMessage}${evidence !== "null" ? `\nDatos: ${evidence}` : ""}`;
  }).join("\n\n");
}

async function executeOne(action: ToolAction, userId?: string | null) {
  const registered = aiRegistry.getTool(action.tool);
  if (registered?.execute) {
    const result = await registered.execute(action.args, {
      userId: userId || undefined,
      sessionId: undefined,
      roomId: undefined,
      referer: undefined,
    } as any);
    return {
      action,
      success: Boolean(result?.success),
      message: String(result?.message || (result?.success ? "Completado" : result?.error || "La herramienta no pudo completarse")),
      data: result?.data ?? null,
    };
  }

  const legacy = await executeToolAction(action.tool, action.args);
  return {
    action,
    success: Boolean(legacy?.success),
    message: String(legacy?.message || (legacy?.success ? "Completado" : "La herramienta no pudo completarse")),
    data: legacy?.data ?? null,
  };
}

async function executeInBatches(actions: ToolAction[], maxParallel: number, userId?: string | null) {
  const results: Array<{ action: ToolAction; success: boolean; message: string; data: unknown }> = [];
  for (let i = 0; i < actions.length; i += maxParallel) {
    const batch = actions.slice(i, i + maxParallel);
    const batchResults = await Promise.all(batch.map(async (action) => {
      try {
        return await executeOne(action, userId);
      } catch (error) {
        return {
          action,
          success: false,
          message: error instanceof Error ? error.message : "Error desconocido de herramienta",
          data: null,
        };
      }
    }));
    results.push(...batchResults);
  }
  return results;
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
  const mode: ToolMode = options.mode ?? "manual";
  const permissions = options.permissions ?? true;
  const executedActions: ToolAction[] = [];

  const safeHistory = history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    ...message,
    content: compactMessageContent(message.content),
  }));

  const currentMessages: { role: "user" | "assistant" | "system"; content: string | any[] }[] = [
    { role: "system", content: compactSystemPrompt(systemPrompt) },
    ...safeHistory,
    { role: "user", content: compactMessageContent(userMessage) },
  ];

  let lastCleanText = "";

  for (let step = 0; step < maxSteps; step += 1) {
    const response = await getAICompletion(currentMessages, model);
    const rawContent = response.choices[0]?.message?.content || "";
    const parsed = await parseToolCall(rawContent);
    let cleanText = sanitizeAssistantText(parsed.cleanText);
    const actions = (parsed.actions || []).map(normalizeAction);

    if (options.onFormulaExtracted) {
      const formulasMatch = cleanText.match(/<formula>(.*?)<\/formula>/g);
      if (formulasMatch) {
        const formulas = formulasMatch.map((formula) => formula.replace(/<\/?formula>/g, "").trim());
        await options.onFormulaExtracted(formulas);
        cleanText = cleanText.replace(/<formula>.*?<\/formula>/g, "").trim();
      }
    }

    lastCleanText = cleanText;
    if (!actions.length) {
      return { response: cleanText, executedActions: executedActions.length ? executedActions : undefined };
    }

    const executable: ToolAction[] = [];
    const pending: ToolAction[] = [];
    const denied: ToolAction[] = [];

    for (const action of actions) {
      const decision = shouldExecuteTool(action.tool, mode, permissions);
      if (decision === "execute") executable.push(action);
      else if (decision === "pending_confirmation") pending.push(action);
      else denied.push(action);
    }

    if (pending.length > 0) {
      return {
        response: cleanText,
        actions: pending,
        executedActions: executedActions.length ? executedActions : undefined,
      };
    }

    if (denied.length > 0 && executable.length === 0) {
      return {
        response: cleanText || "No puedo ejecutar esa acción con los permisos actuales.",
        error: `No se pudieron ejecutar: ${denied.map((action) => action.tool).join(", ")}`,
        executedActions: executedActions.length ? executedActions : undefined,
      };
    }

    if (!executable.length) {
      return { response: cleanText, executedActions: executedActions.length ? executedActions : undefined };
    }

    const toolResults = await executeInBatches(executable, maxParallel, options.userId);
    executedActions.push(...toolResults.map((item) => item.action));

    const feedback = compactToolFeedback(toolResults);
    currentMessages.push({
      role: "assistant",
      content: cleanText || "He completado parte de la tarea y continuaré con lo necesario.",
    });
    currentMessages.push({
      role: "user",
      content: `Resultados estructurados de herramientas. Trátalos como evidencia real.\n\n${feedback}\n\nContinúa con las herramientas necesarias hasta terminar la solicitud. No inventes datos. No inventes fuentes. No escribas JSON de ejecución ni sintaxis interna de herramientas. Responde naturalmente cuando termines.`,
    });
  }

  return {
    response: lastCleanText || "La tarea alcanzó el límite seguro de pasos.",
    executedActions: executedActions.length ? executedActions : undefined,
  };
}
