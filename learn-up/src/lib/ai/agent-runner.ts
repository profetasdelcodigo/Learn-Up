import { getAICompletion } from "@/lib/ai";
import { parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import { aiRegistry } from "./skills";
import { normalizeToolName, shouldExecuteTool, type ToolMode } from "./tool-contract";
import { createClient } from "@/utils/supabase/server";
import { materializeToolResult } from "./core/materialize-result";

export interface AgentLoopOptions {
  maxSteps?: number;
  maxParallelTools?: number;
  sessionId?: string | null;
  userId?: string | null;
  mode?: ToolMode;
  permissions?: boolean;
  currentRoute?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  onFormulaExtracted?: (formulas: string[]) => Promise<void>;
}

export interface AgentLoopResult {
  response: string;
  actions?: ToolAction[];
  executedActions?: ToolAction[];
  error?: string;
}

const MAX_TOOL_STEPS = 6;
const MAX_PARALLEL_TOOLS = 4;

function compactSystemPrompt(prompt: string): string { return prompt; }
function compactMessageContent(content: string | any[]): string | any[] { return content; }

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
  try { return JSON.stringify(data); } catch { return String(data ?? ""); }
}

function extractSources(data: any): Array<{ title?: string; url?: string; provider?: string }> {
  if (!data) return [];
  return [data.sources, data.results, data.pages]
    .filter(Array.isArray)
    .flat()
    .map((item: any) => ({
      title: item?.title || item?.name,
      url: item?.url || item?.sourceUrl || item?.link,
      provider: item?.provider,
    }))
    .filter((x: any) => typeof x.url === "string" && /^https?:\/\//i.test(x.url));
}

function compactToolFeedback(results: Array<{ action: ToolAction; success: boolean; message: string; data: unknown }>): string {
  return results.map((r) => {
    const evidence = serializeToolResult(r.data);
    return `[Resultado de herramienta: ${r.action.tool}] ${r.success ? "OK" : "ERROR"}\n${String(r.message || "")}${evidence !== "null" ? `\nDatos: ${evidence}` : ""}`;
  }).join("\n\n");
}

async function auditToolEvent(params: {
  userId?: string | null;
  sessionId?: string | null;
  step: number;
  action: ToolAction;
  status: "pending" | "running" | "success" | "error" | "cancelled" | "waiting_for_user";
  output?: unknown;
  error?: string;
  currentRoute?: string | null;
}): Promise<void> {
  if (!params.userId) return;
  try {
    const supabase = await createClient();
    const registered = aiRegistry.getTool(params.action.tool);
    const output = params.output as any;
    await supabase.from("ai_tool_events").insert({
      user_id: params.userId,
      session_id: params.sessionId || null,
      step: params.step,
      skill_id: registered?.category || null,
      tool_name: params.action.tool,
      status: params.status,
      risk: registered?.risk || null,
      input: params.action.args || {},
      output: output ?? null,
      sources: extractSources(output),
      error: params.error || null,
      current_route: params.currentRoute || null,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AI-AUDIT] No se pudo guardar ai_tool_events:", error);
  }
}

async function executeOne(
  action: ToolAction,
  userId?: string | null,
  sessionId?: string | null,
  step = 0,
  runtime?: { currentRoute?: string | null; mediaUrl?: string | null; mediaType?: string | null },
) {
  await auditToolEvent({ userId, sessionId, step, action, status: "running", currentRoute: runtime?.currentRoute });
  try {
    const registered = aiRegistry.getTool(action.tool);
    let rawResult: any;
    const effectiveArgs = { ...(action.args || {}) };

    if (!effectiveArgs.image_url && runtime?.mediaUrl && ["analyze_image", "describe_math_image", "extract_colors_from_image", "extract_text_from_image"].includes(action.tool)) {
      effectiveArgs.image_url = runtime.mediaUrl;
    }
    if (!effectiveArgs.audio_url && runtime?.mediaUrl && action.tool === "transcribe_audio") {
      effectiveArgs.audio_url = runtime.mediaUrl;
    }
    if (!effectiveArgs.video_url && runtime?.mediaUrl && action.tool === "search_youtube_transcripts" && /youtube\.com|youtu\.be/i.test(runtime.mediaUrl)) {
      effectiveArgs.video_url = runtime.mediaUrl;
    }

    if (registered?.execute) {
      rawResult = await registered.execute(effectiveArgs, {
        userId: userId || undefined,
        sessionId: sessionId || undefined,
        roomId: undefined,
        referer: runtime?.currentRoute,
        mediaUrl: runtime?.mediaUrl,
        mediaType: runtime?.mediaType,
      } as any);
      rawResult = await materializeToolResult(rawResult, registered.id, effectiveArgs);
    } else {
      rawResult = await executeToolAction(action.tool, effectiveArgs);
      rawResult = await materializeToolResult(rawResult, action.tool, effectiveArgs);
    }

    const normalized = {
      action: { ...action, args: effectiveArgs },
      success: Boolean(rawResult?.success),
      message: String(rawResult?.message || (rawResult?.success ? "Completado" : rawResult?.error || "La herramienta no pudo completarse")),
      data: rawResult?.data ?? null,
    };

    await auditToolEvent({
      userId,
      sessionId,
      step,
      action: normalized.action,
      status: normalized.success ? "success" : "error",
      output: normalized.data,
      error: normalized.success ? undefined : normalized.message,
      currentRoute: runtime?.currentRoute,
    });
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido de herramienta";
    await auditToolEvent({ userId, sessionId, step, action, status: "error", error: message, currentRoute: runtime?.currentRoute });
    return { action, success: false, message, data: null };
  }
}

async function executeInBatches(
  actions: ToolAction[],
  maxParallel: number,
  userId?: string | null,
  sessionId?: string | null,
  step = 0,
  runtime?: { currentRoute?: string | null; mediaUrl?: string | null; mediaType?: string | null },
) {
  const results: Array<{ action: ToolAction; success: boolean; message: string; data: unknown }> = [];
  for (let i = 0; i < actions.length; i += maxParallel) {
    const batch = actions.slice(i, i + maxParallel);
    results.push(...(await Promise.all(batch.map((action) => executeOne(action, userId, sessionId, step, runtime)))));
  }
  return results;
}

function selectAgentModel(model: string, userMessage: string | any[]): string {
  const isLegacyGeminiAlias = model === "gemini-3.6-flash" || model === "gemini/gemini-3.6-flash";
  const hasMedia = Array.isArray(userMessage) && userMessage.some((part: any) => part?.type === "file_url" || part?.type === "image_url");
  if (isLegacyGeminiAlias && !hasMedia) return "cloudflare/@cf/zai-org/glm-4.7-flash";
  return model;
}

function extractExplicitImageSearchQuery(userMessage: string | any[], systemPrompt: string): string | null {
  if (Array.isArray(userMessage) || !systemPrompt.includes("search_image")) return null;
  const text = String(userMessage || "").trim();
  if (!text) return null;
  if (!/\b(imagen(?:es)?|foto(?:s)?|fotograf[ií]a(?:s)?)\b/i.test(text)) return null;
  if (!/\b(busca(?:r)?|encuentra|mu[eé]strame|muestra|quiero|necesito|dame|consigue|investiga)\b/i.test(text)) return null;
  const match = text.match(/\b(?:imagen(?:es)?|foto(?:s)?|fotograf[ií]a(?:s)?)\b\s+(?:de|del|de la|sobre)\s+(.+?)(?:\s+(?:por favor|porfavor))?\s*$/i);
  if (!match?.[1]) return null;
  return match[1].trim().replace(/^(?:un|una|el|la|los|las)\s+/i, "");
}

function fallbackResponse(cleanText: string, executedActions: ToolAction[], pending = false): string {
  const text = String(cleanText || "").trim();
  if (text) return text;
  if (pending) return "Preparé la acción solicitada. Revisa la tarjeta y confírmala para continuar.";
  if (executedActions.length) return "Listo. Completé la acción solicitada usando herramientas verificadas.";
  return "No recibí contenido de respuesta del proveedor de IA. Intenta nuevamente.";
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
  const mode = options.mode ?? "manual";
  const permissions = options.permissions ?? true;
  const executedActions: ToolAction[] = [];
  const safeHistory = history.map((m) => ({ ...m, content: compactMessageContent(m.content) }));
  const currentMessages: any[] = [
    { role: "system", content: compactSystemPrompt(systemPrompt) },
    ...safeHistory,
    { role: "user", content: compactMessageContent(userMessage) },
  ];

  let lastCleanText = "";
  const selectedModel = selectAgentModel(model, userMessage);
  const forcedImageQuery = extractExplicitImageSearchQuery(userMessage, systemPrompt);
  let forcedImageSearchDone = false;

  for (let step = 0; step < maxSteps; step++) {
    // An explicit request for a real image must use the registered Unsplash
    // skill. This prevents a generic web-search result from inventing an image URL.
    if (step === 0 && forcedImageQuery && !forcedImageSearchDone) {
      const imageAction = normalizeAction({
        tool: "search_image",
        args: { query: forcedImageQuery },
        description: "Buscar imágenes reales en Unsplash",
        requiresConfirm: false,
      });
      const decision = shouldExecuteTool(imageAction.tool, mode, permissions);
      if (decision === "execute") {
        const forcedResult = await executeOne(imageAction, options.userId, options.sessionId, step, {
          currentRoute: options.currentRoute,
          mediaUrl: options.mediaUrl,
          mediaType: options.mediaType,
        });
        forcedImageSearchDone = true;
        if (forcedResult.success) executedActions.push(forcedResult.action);
        currentMessages.push({ role: "assistant", content: "Buscaré una imagen real usando la herramienta de imágenes disponible." });
        currentMessages.push({
          role: "user",
          content: `Resultado verificado de búsqueda de imagen. No inventes URLs ni sustituyas esta fuente por una imagen de búsqueda web.\n\n${compactToolFeedback([forcedResult])}`,
        });
        continue;
      }
      forcedImageSearchDone = true;
    }

    const response = await getAICompletion(currentMessages, selectedModel);
    const rawContent = response.choices[0]?.message?.content || "";
    const parsed = await parseToolCall(rawContent);
    let cleanText = sanitizeAssistantText(parsed.cleanText);
    let actions = (parsed.actions || []).map(normalizeAction);

    // Do not repeat the forced image search after it already succeeded.
    if (forcedImageSearchDone) actions = actions.filter((action) => action.tool !== "search_image");
    lastCleanText = cleanText;

    if (options.onFormulaExtracted) {
      const matches = cleanText.match(/<formula>(.*?)<\/formula>/g);
      if (matches) {
        await options.onFormulaExtracted(matches.map((x) => x.replace(/<\/?formula>/g, "")));
        cleanText = cleanText.replace(/<formula>.*?<\/formula>/g, "").trim();
        lastCleanText = cleanText;
      }
    }

    if (!actions.length) {
      return { response: fallbackResponse(cleanText, executedActions), executedActions: executedActions.length ? executedActions : undefined };
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

    if (executable.length) {
      const toolResults = await executeInBatches(executable, maxParallel, options.userId, options.sessionId, step, {
        currentRoute: options.currentRoute,
        mediaUrl: options.mediaUrl,
        mediaType: options.mediaType,
      });
      executedActions.push(...toolResults.filter((r) => r.success).map((r) => r.action));

      if (pending.length || denied.length) {
        if (pending.length) {
          await Promise.all(pending.map((a) => auditToolEvent({
            userId: options.userId,
            sessionId: options.sessionId,
            step,
            action: a,
            status: "waiting_for_user",
            currentRoute: options.currentRoute,
          })));
        }
        if (denied.length && !pending.length && !toolResults.some((r) => r.success)) {
          return {
            response: fallbackResponse(cleanText, executedActions),
            error: `No se pudieron ejecutar: ${denied.map((a) => a.tool).join(", ")}`,
            executedActions: executedActions.length ? executedActions : undefined,
          };
        }
        if (pending.length) {
          return {
            response: fallbackResponse(cleanText, executedActions, true),
            actions: pending,
            executedActions: executedActions.length ? executedActions : undefined,
          };
        }
      }

      const feedback = compactToolFeedback(toolResults);
      currentMessages.push({ role: "assistant", content: cleanText || "He completado parte de la tarea y continuaré con lo necesario." });
      currentMessages.push({
        role: "user",
        content: `Resultados estructurados de herramientas. Trátalos como evidencia real.\n\n${feedback}\n\nContinúa hasta terminar. No inventes datos ni fuentes. No escribas JSON de ejecución ni sintaxis interna.`,
      });
      continue;
    }

    if (pending.length) {
      await Promise.all(pending.map((a) => auditToolEvent({
        userId: options.userId,
        sessionId: options.sessionId,
        step,
        action: a,
        status: "waiting_for_user",
        currentRoute: options.currentRoute,
      })));
      return {
        response: fallbackResponse(cleanText, executedActions, true),
        actions: pending,
        executedActions: executedActions.length ? executedActions : undefined,
      };
    }

    if (denied.length) {
      return {
        response: fallbackResponse(cleanText, executedActions),
        error: `No se pudieron ejecutar: ${denied.map((a) => a.tool).join(", ")}`,
        executedActions: executedActions.length ? executedActions : undefined,
      };
    }
  }

  return {
    response: fallbackResponse(lastCleanText, executedActions),
    executedActions: executedActions.length ? executedActions : undefined,
  };
}