"use server";

import { createClient } from "@/utils/supabase/server";
import { buildUserMessage } from "./ai-tutor";
import { runAgentLoop } from "@/lib/ai/agent-runner";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";
import { getToolDefinitions, type ToolAction } from "@/lib/ai-tools";

const TEXT_MODEL = "openrouter/openrouter/free";
const MULTIMODAL_MODEL = "gemini/gemini-3.6-flash";

function extractSkills(message: string, defaults: string[]) {
  const match = message.match(/\[Skills Activas:\s*(.*?)\]\s*/i);
  if (!match) return { skills: defaults, text: message };
  const skills = match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return { skills: skills.length ? skills : defaults, text: message.replace(match[0], "") };
}

function buildMultimodalMessage(message: string, mediaUrl?: string) {
  if (!mediaUrl) return message;
  return [
    { type: "text", text: message || "Analiza el archivo adjunto y responde a mi solicitud." },
    { type: "file_url", file_url: { url: mediaUrl } },
  ];
}

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado. Por favor inicia sesión.");
  return user.id;
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
  const systemPrompt = `${buildAgentSystemPrompt(agentId)}

REGLAS DE EJECUCIÓN DE LEARN UP:
- Usa las herramientas reales cuando la tarea lo necesite.
- Nunca muestres JSON, llamadas de tools, IDs internos ni bloques de pensamiento.
- En acciones que cambian datos, espera la confirmación de la interfaz salvo que el modo sea autopilot.
- En consultas web o investigación, puedes encadenar varias fuentes y herramientas.
- Los datos obtenidos por tools son la fuente de verdad para describir acciones realizadas.

${getToolDefinitions(skills)}`;

  const isMultimedia = Boolean(mediaUrl);
  let content: string | any[] = text;
  let model = modelId || TEXT_MODEL;

  if (isMultimedia) {
    content = buildMultimodalMessage(text, mediaUrl);
    model = MULTIMODAL_MODEL;
  }

  // Re-use the existing media builder only when it provides a real multimedia payload;
  // for text we deliberately bypass its historical Gemini default.
  if (isMultimedia) {
    const built = await buildUserMessage(text, mediaUrl, mediaType);
    content = built.content;
  }

  return runAgentLoop(
    systemPrompt,
    history.slice(-10),
    content,
    model,
    {
      sessionId,
      userId,
      permissions: true,
      mode: "manual",
    },
  );
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
) {
  return runStableAgent("consejero", problem, history, mediaUrl, mediaType, modelId);
}

export async function generateRecipeStable(
  ingredients: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
  modelId?: string,
) {
  return runStableAgent("nutrirecetas", ingredients, history, mediaUrl, mediaType, modelId);
}
