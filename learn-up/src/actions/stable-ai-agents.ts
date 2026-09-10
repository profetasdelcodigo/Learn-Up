"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { type ToolAction } from "@/lib/ai-tools";
import { getRegistryToolCatalog, normalizeSkillPacks, ALL_PACKS } from "@/lib/ai/core/tool-catalog";
import type { ToolMode } from "@/lib/ai/tool-contract";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";
import { runWorkflowAgent, resumeWorkflow, cancelWorkflowAction } from "@/lib/ai/workflow-agent";
import { AI_MODELS } from "@/lib/ai/model-catalog";

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

  // Compatibilidad interna únicamente: las opciones antiguas ya no se muestran ni se usan como destino.
  const legacyMap: Record<string, string> = {
    "openrouter/free": AI_MODELS.openRouterResearch.id,
    "openrouter/openrouter/free": AI_MODELS.openRouterResearch.id,
    "openrouter/dots-studio/dots-3-note-preview:free": AI_MODELS.openRouterResearch.id,
    "openrouter/nvidia/nemotron-3.5-lightning:free": AI_MODELS.nvidiaSuper.id,
    "openrouter/nvidia/nemotron-3.5-lightning": AI_MODELS.nvidiaSuper.id,
    "openrouter/openai/gpt-oss-120b:free": AI_MODELS.groqReasoning.id,
    "openrouter/openai/gpt-oss-20b:free": AI_MODELS.groqFast.id,
    "openai/gpt-oss-120b:free": AI_MODELS.groqReasoning.id,
    "openai/gpt-oss-20b:free": AI_MODELS.groqFast.id,
    "gemini-3.5-flash": AI_MODELS.geminiLegacy.id,
    "gemini-3.6-flash": AI_MODELS.geminiBalanced.id,
    "gemini-3.7-flash": AI_MODELS.geminiAgentic.id,
    "gemini-3.8-flash": AI_MODELS.geminiFast.id,
    "nvidia/nemotron-3-ultra-550b-a55b": AI_MODELS.nvidiaSuper.id,
    "groq/llama-3.3-70b-versatile": AI_MODELS.groqReasoning.id,
    "llama-3.3-70b-versatile": AI_MODELS.groqReasoning.id,
  };

  if (legacyMap[raw]) return legacyMap[raw];
  if (raw.startsWith("openrouter/") || raw.startsWith("groq/") || raw.startsWith("gemini/") || raw.startsWith("nvidia/")) return raw;
  return `openrouter/${raw}`;
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
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    }
    return input;
  };
  return JSON.stringify(normalize(value || {}));
}

export async function approveStableToolAction(tool: string, args: Record<string, unknown>, workflowId?: string) {
  const userId = await getUserId();
  if (workflowId) return resumeWorkflow(workflowId, tool, args as Record<string, any>);
  const supabase = await createClient();
  const { data: waiting } = await supabase.from("ai_workflows").select("id,pending_actions,session_id").eq("user_id", userId).eq("status", "waiting_for_user").order("updated_at", { ascending: false }).limit(50);
  const match = (waiting || []).find((workflow: any) => (workflow.pending_actions || []).some((action: any) => action.tool === tool && stableArgs(action.args || {}) === stableArgs(args)));
  if (match) return resumeWorkflow(match.id, tool, args);
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

  const { mode } = extractMode(modelId);
  const isMultimedia = Boolean(mediaUrl);
  const model = isMultimedia ? MULTIMODAL_MODEL : normalizeTextModel(modelId);
  const systemPrompt = `${buildAgentSystemPrompt(agentId)}\n\nCONTEXTO DE EJECUCIÓN:\n- Learn Up expone las 10 skills universales: ${ALL_PACKS.join(", ")}.\n- Todas las skills son invocables desde Profesor, Consejero y Nutrirecetas; las skills activas se usan como prioridad contextual, no como una barrera de disponibilidad.\n- Usa solamente herramientas reales registradas.\n- Una solicitud puede combinar múltiples skills y múltiples tools.\n- Continúa el workflow hasta finalizar, pedir un dato, encontrar un error real o requerir confirmación.\n- Manual: solo las acciones sin confirmación se ejecutan automáticamente; las demás quedan pendientes.\n- Autopilot: solo herramientas permitidas por la política se ejecutan automáticamente.\n- Nunca inventes fuentes, URLs, estadísticas, IDs, rutas ni acciones terminadas.\n- Si una API no está configurada o falla, informa el error real.\n- No muestres JSON, function calls, prompts internos ni bloques de pensamiento ocultos al estudiante.\n- MODO: ${mode}\n- SKILLS PRIORIZADAS: ${skills.join(", ") || "ninguna"}\n\nCATÁLOGO DE HERRAMIENTAS UNIVERSALES:\n${getRegistryToolCatalog(ALL_PACKS)}`;

  const { content } = await buildUserMessage(text, mediaUrl, mediaType);
  return runWorkflowAgent(systemPrompt, history, content, model, { sessionId, aiType: agentId, userId, mode, maxSteps: 8, maxParallelTools: 4, mediaUrl, mediaType });
}

export async function askProfessorStable(message: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("profesor", message, history, mediaUrl, mediaType, modelId, sessionId); }
export async function askCounselorStable(problem: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("consejero", problem, history, mediaUrl, mediaType, modelId, sessionId); }
export async function generateRecipeStable(ingredients: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("nutrirecetas", ingredients, history, mediaUrl, mediaType, modelId, sessionId); }
