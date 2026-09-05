"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { runAgentLoop } from "@/lib/ai/agent-runner";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { getToolDefinitions, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import type { ToolMode } from "@/lib/ai/tool-contract";

const TEXT_MODEL = "openrouter/openai/gpt-oss-120b:free";
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
  if (model === "openrouter/openrouter/free" || model === "openrouter/free") return TEXT_MODEL;
  if (model.includes("dots-studio/dots-3-note-preview") || model.includes("llama-3.1-8b-instruct:free") || model.includes("nemotron-3.5-lightning:free")) return TEXT_MODEL;
  if (model.includes("llama-3.3-70b-versatile") || model.includes("llama-3.3-70b-specdec")) return TEXT_MODEL;
  if (model === "openrouter/openai/gpt-oss-20b:free" || model === "openai/gpt-oss-20b:free") return "openrouter/openai/gpt-oss-20b:free";
  if (model.startsWith("nvidia/")) return model;
  return model;
}

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado. Por favor inicia sesión.");
  return user.id;
}

export async function approveStableToolAction(tool: string, args: Record<string, unknown>) {
  const userId = await getUserId();
  console.log(`[TOOL] approved name=${tool}`);
  return executeToolAction(tool, { ...args, user_id: userId });
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

  const { skills, text } = extractSkills(message, defaults);
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

${getToolDefinitions(skills)}`;

  let content: string | any[] = text;
  if (isMultimedia) {
    const built = await buildUserMessage(text, mediaUrl, mediaType);
    content = built.content;
  }

  return runAgentLoop(systemPrompt, history.slice(-10), content, model, {
    sessionId,
    userId,
    permissions: true,
    mode,
    maxSteps: 8,
    maxParallelTools: 4,
  });
}

export async function askProfessorStable(
  message: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
  modelId?: string,
  sessionId?: string | null,
) {
  return runStableAgent("profesor", message, history, mediaUrl, mediaType, modelId, sessionId);
}

export async function askCounselorStable(
  problem: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
  modelId?: string,
  sessionId?: string | null,
) {
  return runStableAgent("consejero", problem, history, mediaUrl, mediaType, modelId, sessionId);
}

export async function generateRecipeStable(
  ingredients: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
  modelId?: string,
  sessionId?: string | null,
) {
  return runStableAgent("nutrirecetas", ingredients, history, mediaUrl, mediaType, modelId, sessionId);
}
