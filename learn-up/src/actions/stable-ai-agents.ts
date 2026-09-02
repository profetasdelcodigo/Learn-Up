"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { runAgentLoop } from "@/lib/ai/agent-runner";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { getToolDefinitions, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import type { ToolMode } from "@/lib/ai/tool-contract";

const TEXT_MODEL = "openrouter/free";
const MULTIMODAL_MODEL = "google/gemini-3-flash-preview";

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

REGLAS DE EJECUCIÓN DE LEARN UP:
- Usa las herramientas reales cuando la tarea lo necesite.
- Nunca muestres JSON, llamadas de tools, IDs internos ni bloques de pensamiento.
- En acciones que cambian datos, espera la confirmación de la interfaz salvo que el modo sea autopilot.
- En consultas web o investigación, puedes encadenar varias fuentes y herramientas.
- Los datos obtenidos por tools son la fuente de verdad para describir acciones realizadas.
- MODO ACTUAL: ${mode}. Respeta la política de ejecución del servidor.
- Nunca escribas sintaxis de herramientas como texto visible. Genera tool calls estructuradas únicamente cuando el proveedor las soporte.

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
