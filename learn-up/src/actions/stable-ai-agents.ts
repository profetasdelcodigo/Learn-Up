"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { type ToolAction } from "@/lib/ai-tools";
import { getRegistryToolCatalog, normalizeSkillPacks, ALL_PACKS } from "@/lib/ai/core/tool-catalog";
import type { ToolMode } from "@/lib/ai/tool-contract";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";
import { runWorkflowAgent, resumeWorkflow, cancelWorkflowAction } from "@/lib/ai/workflow-agent-compat";
import { createPendingWorkflow, updateWorkflow } from "@/lib/ai/core/workflow-store";
import { AI_MODELS } from "@/lib/ai/model-catalog";
import { getTimeContext } from "@/lib/ai/time-context";
import { searchWebStructured, shouldSearchWeb } from "@/lib/web-search";

const TEXT_MODEL = AI_MODELS.groqReasoning.id;
const MULTIMODAL_MODEL = AI_MODELS.geminiFast.id;

function extractSkills(message: string, defaults: string[]) {
  const match = message.match(/\[Skills Activas:\s*(.*?)\]\s*/i);
  if (!match) return { skills: defaults, text: message, explicit: false };
  const skills = normalizeSkillPacks(match[1].split(","));
  return { skills: skills.length ? skills : defaults, text: message.replace(match[0], ""), explicit: true };
}

function extractMode(modelId?: string): { mode: ToolMode; model: string } {
  const raw = modelId || TEXT_MODEL;
  const autopilot = /::autopilot$/i.test(raw);
  return { mode: autopilot ? "autopilot" : "manual", model: raw.replace(/::autopilot$/i, "") };
}

function normalizeTextModel(modelId?: string): string {
  const { model } = extractMode(modelId);
  const raw = model.trim();
  if (!raw) return TEXT_MODEL;

  const legacyMap: Record<string, string> = {
    "openrouter/free": AI_MODELS.openRouterResearch.id,
    "openrouter/openrouter/free": AI_MODELS.openRouterResearch.id,
    "openrouter/dots-studio/dots-3-note-preview:free": AI_MODELS.openRouterResearch.id,
    "openrouter/nvidia/nemotron-3.5-lightning:free": AI_MODELS.nvidiaSuper.id,
    "openrouter/nvidia/nemotron-3.5-lightning": AI_MODELS.nvidiaSuper.id,
    "openrouter/openai/gpt-oss-120b:free": AI_MODELS.openRouterFree.id,
    "openrouter/openai/gpt-oss-20b:free": AI_MODELS.openRouterFree.id,
    "openai/gpt-oss-120b:free": AI_MODELS.groqReasoning.id,
    "openai/gpt-oss-20b:free": AI_MODELS.groqFast.id,
    "gemini-3.5-flash": AI_MODELS.geminiFast.id,
    "gemini-3.6-flash": AI_MODELS.geminiFast.id,
    "gemini-3.7-flash": AI_MODELS.geminiFast.id,
    "gemini-3.8-flash": AI_MODELS.geminiFast.id,
    "nvidia/nemotron-3-ultra-550b-a55b": AI_MODELS.nvidiaSuper.id,
    "groq/llama-3.3-70b-versatile": AI_MODELS.groqReasoning.id,
    "llama-3.3-70b-versatile": AI_MODELS.groqReasoning.id,
  };

  if (legacyMap[raw]) return legacyMap[raw];
  if (/^(groq|gemini|nvidia|openrouter)\//.test(raw)) return raw;
  return TEXT_MODEL;
}

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado. Por favor inicia sesión.");
  return user.id;
}

function stableArgs(value: Record<string, unknown>) {
  const normalize = (input: any): any => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    return input;
  };
  return JSON.stringify(normalize(value || {}));
}

function isConfirmation(text: string) {
  return /^(sí|si|s[ií]|confirmo|confirmado|dale|hazlo|hazlo ya|proced[eé]|acepto|adelante|ok|okay|yes)[.!\s]*$/i.test(text.trim());
}

function isCancellation(text: string) {
  return /^(no|cancelar|cancela|cancelado|detente|detener|olvídalo|olvidalo)[.!\s]*$/i.test(text.trim());
}

function tomorrowInLima() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function parseClock(text: string) {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toLowerCase().replace(/\./g, "");
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addMinutes(clock: string, minutes: number) {
  const [hour, minute] = clock.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function parseCalendarCreateIntent(text: string): ToolAction | null {
  if (!/(agrega|añade|anade|crea|programa|agenda|pon|anota)\b/i.test(text) || !/\bevento\b/i.test(text)) return null;
  const quoted = text.match(/["“]([^"”]+)["”]/);
  const titleMatch = text.match(/\bllamad[oa](?:\s+como)?\s+["“]?(.+?)["”]?(?:\.|$)/i);
  const title = quoted?.[1]?.trim() || titleMatch?.[1]?.replace(/[“”"]+$/g, "").trim();
  const start = parseClock(text);
  if (!title || !start || !/\bmañana\b|\bmanana\b/i.test(text)) return null;
  const date = tomorrowInLima();
  const end = addMinutes(start, 60);
  return {
    tool: "add_calendar_event",
    args: { title, date, start_time: start, end_time: end },
    description: `Programar “${title}” para mañana ${date}, de ${start} a ${end}. Duración predeterminada: 1 hora.`,
    requiresConfirm: true,
  };
}

async function findPendingWorkflow(userId: string, sessionId?: string | null) {
  if (!sessionId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_workflows")
    .select("id,pending_actions,session_id,model,mode,messages,ai_type,status")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("status", "waiting_for_user")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function handleExistingPendingWorkflow(userId: string, sessionId: string | null | undefined, text: string) {
  const workflow: any = await findPendingWorkflow(userId, sessionId);
  if (!workflow || !Array.isArray(workflow.pending_actions) || !workflow.pending_actions.length) return null;
  const action = workflow.pending_actions[0];

  if (isConfirmation(text)) return resumeWorkflow(workflow.id, action.tool, action.args);
  if (isCancellation(text)) return cancelWorkflowAction(workflow.id, action.tool, action.args);

  if (action.tool === "add_calendar_event") {
    const durationMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(min|minuto|minutos|h|hora|horas)\b/i);
    if (durationMatch && action.args?.start_time) {
      const value = Number(durationMatch[1]);
      const unit = String(durationMatch[2]).toLowerCase();
      const minutes = /min/.test(unit) ? value : value * 60;
      const updated = { ...action, args: { ...action.args, end_time: addMinutes(String(action.args.start_time), minutes) }, description: `Programar “${action.args.title}” el ${action.args.date}, de ${action.args.start_time} a ${addMinutes(String(action.args.start_time), minutes)}.` };
      const pending = [updated, ...workflow.pending_actions.slice(1)];
      await updateWorkflow(workflow.id, { pending_actions: pending, messages: [...(workflow.messages || []), { role: "user", content: text }] });
      return { response: `📅 Vista previa actualizada: “${updated.args.title}”, ${updated.args.date}, ${updated.args.start_time}–${updated.args.end_time}. ¿Confirmas que lo cree?`, actions: [{ ...updated, workflowId: workflow.id }], executedActions: [] };
    }
  }

  return null;
}

function injectVerifiedSources(response: string, sources: Array<{ title: string; url: string; provider?: string }>) {
  if (!sources.length) return response;
  const lines = sources.slice(0, 8).map((source, index) => `${index + 1}. [${source.title || source.url}](${source.url})${source.provider ? ` — ${source.provider}` : ""}`).join("\n");
  const evidence = `Fuentes consultadas por API:\n${lines}`;
  if (/<thinking>[\s\S]*?<\/thinking>/i.test(response)) return response.replace(/<\/thinking>/i, `\n${evidence}\n</thinking>`);
  return `<thinking>1. Se realizó una búsqueda web real antes de redactar la respuesta.\n${evidence}\n2. Esta es una traza resumida de acciones y fuentes, no el razonamiento interno privado del modelo.</thinking>\n\n${response}`;
}

export async function approveStableToolAction(tool: string, args: Record<string, unknown>, workflowId?: string) {
  const userId = await getUserId();
  if (workflowId) return resumeWorkflow(workflowId, tool, args as Record<string, any>);
  const supabase = await createClient();
  const { data: waiting } = await supabase.from("ai_workflows").select("id,pending_actions,session_id").eq("user_id", userId).eq("status", "waiting_for_user").order("updated_at", { ascending: false }).limit(50);
  const match = (waiting || []).find((workflow: any) => (workflow.pending_actions || []).some((action: any) => action.tool === tool && stableArgs(action.args || {}) === stableArgs(args)));
  if (match) return resumeWorkflow(match.id, tool, args as Record<string, any>);
  return { success: false, message: "La confirmación ya no está disponible. Envía nuevamente la solicitud para crear una acción nueva y verificable." };
}

export async function cancelStableToolAction(tool: string, args: Record<string, unknown>, workflowId?: string) {
  const userId = await getUserId();
  if (workflowId) return cancelWorkflowAction(workflowId, tool, args as Record<string, any>);
  const supabase = await createClient();
  const { data: waiting } = await supabase.from("ai_workflows").select("id,pending_actions").eq("user_id", userId).eq("status", "waiting_for_user").order("updated_at", { ascending: false }).limit(50);
  const match = (waiting || []).find((workflow: any) => (workflow.pending_actions || []).some((action: any) => action.tool === tool && stableArgs(action.args || {}) === stableArgs(args)));
  if (!match) return { success: true, status: "not_found" };
  return cancelWorkflowAction(match.id, tool, args as Record<string, any>);
}

async function runStableAgent(agentId: "profesor" | "consejero" | "nutrirecetas", message: string, history: { role: "user" | "assistant"; content: string | any[] }[], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {
  const userId = await getUserId();
  const defaults = ALL_PACKS;

  const persisted = await getPersistedSkillPacks(sessionId);
  const { skills: explicitSkills, text, explicit } = extractSkills(message, defaults);
  const skills = explicitSkills.length ? explicitSkills : (persisted.length ? persisted : defaults);
  if (explicit) await Promise.allSettled([saveSkillPacks(skills, sessionId), saveSkillPacks(skills)]);

  const pendingResult = await handleExistingPendingWorkflow(userId, sessionId, text);
  if (pendingResult) return pendingResult as any;

  const calendarIntent = parseCalendarCreateIntent(text);
  const { mode } = extractMode(modelId);
  const isMultimedia = Boolean(mediaUrl);
  const model = isMultimedia ? MULTIMODAL_MODEL : normalizeTextModel(modelId);

  if (calendarIntent && sessionId) {
    const workflow = await createPendingWorkflow({
      userId,
      sessionId,
      aiType: agentId,
      mode,
      model,
      step: 0,
      messages: [{ role: "user", content: text }],
      pendingActions: [calendarIntent],
      executedResults: [],
    });
    const action = { ...calendarIntent, workflowId: workflow.id } as ToolAction;
    return {
      response: `<thinking>1. Detecté una solicitud de calendario y preparé una acción real sobre tu calendario personal.\n2. La acción queda pendiente de confirmación explícita antes de escribir en la base de datos.\n3. Esta es una traza resumida de acciones y fuentes, no el razonamiento interno privado del modelo.</thinking>\n\n📅 Evento propuesto\n- Título: ${calendarIntent.args.title}\n- Fecha: ${calendarIntent.args.date}\n- Hora: ${calendarIntent.args.start_time}–${calendarIntent.args.end_time}\n\n¿Confirmas que lo cree?`,
      actions: [action],
      executedActions: [],
    };
  }

  let groundedSources: Array<{ title: string; url: string; provider?: string; snippet?: string }> = [];
  let groundedContent = text;
  if (shouldSearchWeb(text)) {
    groundedSources = await searchWebStructured(text, 6);
    if (groundedSources.length) {
      groundedContent = `${text}\n\nEVIDENCIA WEB REAL RECUPERADA POR API (usa exclusivamente estas fuentes cuando hagas afirmaciones actuales):\n${JSON.stringify(groundedSources.map(({ title, url, provider, snippet }) => ({ title, url, provider, snippet })))}\n\nNo inventes otras URLs.`;
    }
  }

  const systemPrompt = `${getTimeContext()}\n\n${buildAgentSystemPrompt(agentId)}\n\nCONTEXTO DE EJECUCIÓN:\n- Learn Up expone las 10 skills universales: ${ALL_PACKS.join(", ")}.\n- Todas las skills son invocables desde Profesor, Consejero y Nutrirecetas; las skills activas se usan como prioridad contextual, no como una barrera de disponibilidad.\n- Usa solamente herramientas reales registradas.\n- Una solicitud puede combinar múltiples skills y múltiples tools.\n- Continúa el workflow hasta finalizar, pedir un dato, encontrar un error real o requerir confirmación.\n- Manual: solo las acciones sin confirmación se ejecutan automáticamente; las demás quedan pendientes.\n- Autopilot: solo herramientas permitidas por la política se ejecutan automáticamente.\n- Nunca inventes fuentes, URLs, estadísticas, IDs, rutas ni acciones terminadas.\n- Si una API no está configurada o falla, informa el error real.\n- No muestres JSON, function calls, prompts internos ni bloques de pensamiento ocultos al estudiante.\n- MODO: ${mode}\n- SKILLS PRIORIZADAS: ${skills.join(", ") || "ninguna"}\n\nCATÁLOGO DE HERRAMIENTAS UNIVERSALES:\n${getRegistryToolCatalog(ALL_PACKS)}`;

  const { content } = await buildUserMessage(groundedContent, mediaUrl, mediaType);
  const result = await runWorkflowAgent(systemPrompt, history, content, model, { sessionId, aiType: agentId, userId, mode, maxSteps: 8, maxParallelTools: 4, mediaUrl, mediaType });

  if (groundedSources.length) {
    const searchAction: ToolAction = { tool: "search_web", args: { query: text, limit: groundedSources.length }, description: `Búsqueda web real mediante las APIs configuradas. ${groundedSources.length} fuente(s) verificable(s).`, requiresConfirm: false };
    return { ...result, response: injectVerifiedSources(result.response, groundedSources), executedActions: [searchAction, ...(result.executedActions || [])] };
  }

  return result;
}

export async function askProfessorStable(message: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("profesor", message, history, mediaUrl, mediaType, modelId, sessionId); }
export async function askCounselorStable(problem: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("consejero", problem, history, mediaUrl, mediaType, modelId, sessionId); }
export async function generateRecipeStable(ingredients: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("nutrirecetas", ingredients, history, mediaUrl, mediaType, modelId, sessionId); }
