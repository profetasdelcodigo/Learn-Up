"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { type ToolAction } from "@/lib/ai-tools";
import { getRegistryToolCatalog, normalizeSkillPacks } from "@/lib/ai/core/tool-catalog";
import type { ToolMode } from "@/lib/ai/tool-contract";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";
import { runWorkflowAgent, resumeWorkflow, cancelWorkflow } from "@/lib/ai/workflow-agent";
import { aiRegistry } from "@/lib/ai/skills";
import { AI_MODELS } from "@/lib/ai/model-catalog";

const TEXT_MODEL = AI_MODELS.groqFast.id;
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
  const legacyMap: Record<string, string> = {
    "openrouter/free": AI_MODELS.openRouterFreeLarge.id,
    "openrouter/openrouter/free": AI_MODELS.openRouterFreeLarge.id,
    "openrouter/dots-studio/dots-3-note-preview:free": AI_MODELS.openRouterFreeLarge.id,
    "openrouter/nvidia/nemotron-3.5-lightning:free": AI_MODELS.nvidiaSuper.id,
    "openrouter/nvidia/nemotron-3.5-lightning": AI_MODELS.nvidiaSuper.id,
    "openrouter/openai/gpt-oss-120b:free": AI_MODELS.openRouterFreeLarge.id,
    "openrouter/openai/gpt-oss-20b:free": AI_MODELS.openRouterFreeFast.id,
    "openai/gpt-oss-120b:free": AI_MODELS.openRouterFreeLarge.id,
    "openai/gpt-oss-20b:free": AI_MODELS.openRouterFreeFast.id,
    "gemini-3.6-flash": AI_MODELS.geminiBalanced.id,
    "gemini-3.7-flash": AI_MODELS.geminiAgentic.id,
    "gemini-3.8-flash": AI_MODELS.geminiFast.id,
    "nvidia/nemotron-3-ultra-550b-a55b": AI_MODELS.nvidiaSuper.id,
  };
  if (!model) return TEXT_MODEL;
  if (legacyMap[model]) return legacyMap[model];
  if (model.startsWith("openrouter/") || model.startsWith("groq/") || model.startsWith("gemini/") || model.startsWith("nvidia/")) return model;
  return `openrouter/${model}`;
}

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado. Por favor inicia sesión.");
  return user.id;
}

export async function approveStableToolAction(tool: string, args: Record<string, unknown>) {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data: waiting } = await supabase.from("ai_workflows").select("id,pending_actions,session_id").eq("user_id", userId).eq("status", "waiting_for_user").order("updated_at", { ascending: false }).limit(50);
  const match = (waiting || []).find((workflow: any) => (workflow.pending_actions || []).some((action: any) => action.tool === tool && JSON.stringify(action.args || {}) === JSON.stringify(args || {})));
  if (match) return resumeWorkflow(match.id, tool, args);
  const registryTool = aiRegistry.getTool(tool);
  if (!registryTool?.execute) return { success: false, message: `La herramienta ${tool} no pertenece a las 10 skills oficiales activas.` };
  const parsed = registryTool.schema?.safeParse ? registryTool.schema.safeParse(args) : { success: true, data: args };
  if (!parsed.success) return { success: false, message: "Argumentos inválidos para la herramienta." };
  return registryTool.execute(parsed.data, { userId } as any);
}

export async function cancelStableToolAction(tool: string, args: Record<string, unknown>) {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data: waiting } = await supabase.from("ai_workflows").select("id,pending_actions").eq("user_id", userId).eq("status", "waiting_for_user").order("updated_at", { ascending: false }).limit(50);
  const match = (waiting || []).find((workflow: any) => (workflow.pending_actions || []).some((action: any) => action.tool === tool && JSON.stringify(action.args || {}) === JSON.stringify(args || {})));
  if (!match) return { success: true, status: "not_found" };
  await cancelWorkflow(match.id);
  return { success: true, status: "cancelled", workflowId: match.id };
}

async function runStableAgent(agentId: "profesor" | "consejero" | "nutrirecetas", message: string, history: { role: "user" | "assistant"; content: string | any[] }[], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {
  const userId = await getUserId();
  const defaults = agentId === "profesor"
    ? ["library_pack", "learning_pack", "content_pack", "research_pack", "edu_pack", "media_pack"]
    : agentId === "consejero"
      ? ["calendar_pack", "stats_pack", "profile_pack", "learning_pack"]
      : ["content_pack", "media_pack", "research_pack"];

  const persisted = await getPersistedSkillPacks(sessionId);
  const { skills: explicitSkills, text, explicit } = extractSkills(message, []);
  const skills = explicitSkills.length ? explicitSkills : (persisted.length ? persisted : defaults);
  if (explicit) await Promise.allSettled([saveSkillPacks(skills, sessionId), saveSkillPacks(skills)]);

  const { mode } = extractMode(modelId);
  const isMultimedia = Boolean(mediaUrl);
  const model = isMultimedia ? MULTIMODAL_MODEL : normalizeTextModel(modelId);
  const systemPrompt = `${buildAgentSystemPrompt(agentId)}\n\nCONTEXTO DE EJECUCIÓN:\n- Solo existen las 10 skills oficiales: calendar_pack, chat_pack, library_pack, learning_pack, content_pack, media_pack, research_pack, stats_pack, profile_pack, edu_pack.\n- Usa solamente herramientas reales registradas.\n- Una solicitud puede combinar múltiples skills y múltiples tools.\n- Continúa el workflow hasta finalizar, pedir un dato, encontrar un error real o requerir confirmación.\n- Manual: solo las acciones sin confirmación se ejecutan automáticamente; las demás quedan pendientes.\n- Autopilot: solo herramientas permitidas por la política se ejecutan automáticamente.\n- Nunca inventes fuentes, URLs, estadísticas, IDs, rutas ni acciones terminadas.\n- Si una API no está configurada o falla, informa el error real.\n- No muestres JSON, function calls ni instrucciones internas al estudiante.\n- MODO: ${mode}\n- SKILLS ACTIVAS: ${skills.join(", ") || "ninguna"}\n\nCATÁLOGO DE HERRAMIENTAS:\n${getRegistryToolCatalog(skills)}`;

  const { content } = await buildUserMessage(text, mediaUrl, mediaType);
  return runWorkflowAgent(systemPrompt, history.slice(-10), content, model, { sessionId, aiType: agentId, userId, mode, maxSteps: 8, maxParallelTools: 4, mediaUrl, mediaType });
}

export async function askProfessorStable(message: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("profesor", message, history, mediaUrl, mediaType, modelId, sessionId); }
export async function askCounselorStable(problem: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("consejero", problem, history, mediaUrl, mediaType, modelId, sessionId); }
export async function generateRecipeStable(ingredients: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) { return runStableAgent("nutrirecetas", ingredients, history, mediaUrl, mediaType, modelId, sessionId); }
