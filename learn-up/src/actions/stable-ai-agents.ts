"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { getToolDefinitions, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import type { ToolMode } from "@/lib/ai/tool-contract";
import { getPersistedSkillPacks } from "@/lib/ai/core/skill-state";
import { runWorkflowAgent, resumeWorkflow, cancelWorkflow } from "@/lib/ai/workflow-agent";
import { aiRegistry } from "@/lib/ai/skills";

const TEXT_MODEL = "openrouter/openrouter/free";
const MULTIMODAL_MODEL = "gemini/gemini-3.8-flash";

function extractSkills(message: string, defaults: string[]) {
  const match = message.match(/\[Skills Activas:\s*(.*?)\]\s*/i);
  if (!match) return { skills: defaults, text: message };
  const skills = match[1].split(",").map((item) => item.trim()).filter(Boolean);
  return { skills: skills.length ? skills : defaults, text: message.replace(match[0], "") };
}

function extractMode(modelId?: string): { mode: ToolMode; model: string } {
  const raw = modelId || TEXT_MODEL;
  const autopilot = /::autopilot$/i.test(raw);
  return { mode: autopilot ? "autopilot" : "manual", model: raw.replace(/::autopilot$/i, "") };
}

function normalizeTextModel(modelId?: string): string {
  const { model } = extractMode(modelId);
  if (!model) return TEXT_MODEL;

  // Legacy aliases are normalized, but an explicit provider selection is never
  // silently redirected to another provider. The backend validates/handles
  // the selected provider in getAICompletion.
  if (model === "openrouter/free") return TEXT_MODEL;
  if (model === "openrouter/openrouter/free") return TEXT_MODEL;
  if (model === "openrouter/openai/gpt-oss-120b:free" || model === "openai/gpt-oss-120b:free") {
    return "openrouter/openai/gpt-oss-120b:free";
  }
  if (model === "openrouter/openai/gpt-oss-20b:free" || model === "openai/gpt-oss-20b:free") {
    return "openrouter/openai/gpt-oss-20b:free";
  }
  if (model.startsWith("openrouter/") || model.startsWith("groq/") || model.startsWith("gemini/") || model.startsWith("nvidia/")) {
    return model;
  }

  // Model ids without an explicit provider are treated as OpenRouter ids for
  // backwards compatibility, rather than being guessed as Groq/Gemini/NVIDIA.
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
  const { data: waiting } = await supabase
    .from("ai_workflows")
    .select("id,pending_actions,session_id")
    .eq("user_id", userId)
    .eq("status", "waiting_for_user")
    .order("updated_at", { ascending: false })
    .limit(20);

  const match = (waiting || []).find((workflow: any) =>
    (workflow.pending_actions || []).some((action: any) =>
      action.tool === tool && JSON.stringify(action.args || {}) === JSON.stringify(args || {})
    )
  );

  if (match) {
    console.log(`[TOOL] approved workflow=${match.id} name=${tool}`);
    return resumeWorkflow(match.id, tool, args);
  }

  const registryTool = aiRegistry.getTool(tool);
  if (registryTool?.execute) {
    const parsed = registryTool.schema?.safeParse ? registryTool.schema.safeParse(args) : { success: true, data: args };
    if (!parsed.success) return { success: false, message: "Argumentos inválidos para la herramienta." };
    return registryTool.execute(parsed.data, { userId } as any);
  }
  return executeToolAction(tool, { ...args, user_id: userId });
}

export async function cancelStableToolAction(tool: string, args: Record<string, unknown>) {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data: waiting } = await supabase.from("ai_workflows").select("id,pending_actions")
    .eq("user_id", userId).eq("status", "waiting_for_user").order("updated_at", { ascending: false }).limit(20);
  const match = (waiting || []).find((workflow: any) => (workflow.pending_actions || []).some((action: any) =>
    action.tool === tool && JSON.stringify(action.args || {}) === JSON.stringify(args || {})
  ));
  if (!match) return { success: true, status: "not_found" };
  await cancelWorkflow(match.id);
  console.log(`[TOOL] cancelled workflow=${match.id} name=${tool}`);
  return { success: true, status: "cancelled", workflowId: match.id };
}

async function runStableAgent(
  agentId: "profesor" | "consejero" | "nutrirecetas",
  message: string,
  history: { role: "user" | "assistant"; content: string | any[] }[],
  mediaUrl?: string,
  mediaType?: string,
  modelId?: string,
  sessionId?: string | null,
): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {
  const userId = await getUserId();
  const defaults = agentId === "profesor"
    ? ["library_pack", "learning_pack", "content_pack", "research_pack", "edu_pack", "media_pack"]
    : agentId === "consejero"
      ? ["calendar_pack", "stats_pack", "profile_pack", "learning_pack"]
      : ["content_pack", "media_pack", "research_pack"];

  const persisted = await getPersistedSkillPacks(sessionId);
  const { skills: explicitSkills, text } = extractSkills(message, []);
  const skills = explicitSkills.length ? explicitSkills : (persisted.length ? persisted : defaults);
  const { mode } = extractMode(modelId);
  const isMultimedia = Boolean(mediaUrl);
  const model = isMultimedia ? MULTIMODAL_MODEL : normalizeTextModel(modelId);

  const systemPrompt = `${buildAgentSystemPrompt(agentId)}

RUTA Y HERRAMIENTAS:
- Usa únicamente las herramientas reales expuestas.
- Nunca inventes URLs, resultados, fuentes, estadísticas, IDs ni acciones completadas.
- Una solicitud puede utilizar múltiples skills y múltiples tools en secuencia o paralelo.
- Continúa mientras existan pasos necesarios y permitidos; detente solo por confirmación, falta de datos, error real o finalización.
- En manual, las acciones con confirmación quedan pendientes.
- En autopilot, ejecuta solamente herramientas permitidas por su política.
- Si faltan datos, pregunta. No inventes valores.
- No muestres JSON interno, function calls, prompts ni sintaxis de implementación.
- Considera hechos solamente los datos devueltos por las herramientas.
- MODO ACTUAL: ${mode}
- SKILLS ACTIVAS: ${skills.join(", ") || "ninguna"}

${getToolDefinitions(skills)}`;

  const { content } = await buildUserMessage(text, mediaUrl, mediaType);
  return runWorkflowAgent(systemPrompt, history.slice(-10), content, model, {
    sessionId,
    aiType: agentId,
    userId,
    mode,
    maxSteps: 8,
    maxParallelTools: 4,
  });
}

export async function askProfessorStable(message: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) {
  return runStableAgent("profesor", message, history, mediaUrl, mediaType, modelId, sessionId);
}

export async function askCounselorStable(problem: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) {
  return runStableAgent("consejero", problem, history, mediaUrl, mediaType, modelId, sessionId);
}

export async function generateRecipeStable(ingredients: string, history: { role: "user" | "assistant"; content: string | any[] }[] = [], mediaUrl?: string, mediaType?: string, modelId?: string, sessionId?: string | null) {
  return runStableAgent("nutrirecetas", ingredients, history, mediaUrl, mediaType, modelId, sessionId);
}
