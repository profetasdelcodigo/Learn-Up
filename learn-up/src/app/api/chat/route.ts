import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { createClient } from "@/utils/supabase/server";
import { AI_AGENT_REGISTRY, AiAgentId } from "@/lib/ai/agent-registry";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";

export const maxDuration = 90;

const OPENROUTER_MODEL = "openai/gpt-oss-120b:free";

function normalizeActiveSkills(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()))];
  if (typeof value === "string") return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  return [];
}

function routeContextFromRequest(req: Request): string {
  const referer = req.headers.get("referer") || "";
  try { return referer ? new URL(referer).pathname : "desconocida"; } catch { return "desconocida"; }
}

function normalizeModel(value: unknown): string {
  const raw = typeof value === "string" ? value.replace(/::autopilot$/i, "").trim() : "";
  if (!raw || raw === "openrouter/free" || raw === "openrouter/openrouter/free") return OPENROUTER_MODEL;
  if (raw.includes("llama-3.1-8b") || raw.includes("llama-3.3-70b") || raw.includes("dots-studio") || raw.includes("nemotron-3.5-lightning")) return OPENROUTER_MODEL;
  if (raw.startsWith("openrouter/")) return raw.replace(/^openrouter\//, "");
  return OPENROUTER_MODEL;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, aiType, isAutonomous } = body;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const explicitSkills = normalizeActiveSkills(body.activeSkills ?? body.activeSkill);
    const currentRoute = typeof body.currentRoute === "string" ? body.currentRoute : routeContextFromRequest(req);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const persistedSkills = explicitSkills.length
      ? [...new Set([...await getPersistedSkillPacks(sessionId), ...explicitSkills])]
      : await getPersistedSkillPacks(sessionId);
    if (explicitSkills.length) {
      await saveSkillPacks(persistedSkills, sessionId);
      await saveSkillPacks(persistedSkills);
    }

    const agentId = (aiType || "jarvis") as AiAgentId;
    const agentConfig = AI_AGENT_REGISTRY[agentId] || AI_AGENT_REGISTRY["jarvis"];
    const selectedModel = normalizeModel(body.model);
    if (!process.env.OPENROUTER_API_KEY) {
      return new Response("OPENROUTER_API_KEY no configurada", { status: 503 });
    }

    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const model = openrouter(selectedModel);

    const systemPrompt = `Eres "${agentConfig.name}".
PROPÓSITO: ${agentConfig.purpose}
RUTA ACTUAL REAL: ${currentRoute}
SKILLS ACTIVAS: ${persistedSkills.join(", ") || "ninguna seleccionada; usa las capacidades disponibles cuando sean necesarias"}

REGLAS DE EJECUCIÓN:
- Usa únicamente las herramientas expuestas por el servidor.
- Nunca inventes URLs, rutas, resultados, fuentes, IDs ni acciones completadas.
- Una solicitud puede utilizar múltiples skills y múltiples herramientas en varias rondas.
- Continúa hasta terminar o hasta encontrar una confirmación requerida, falta de datos o error real.
- En modo manual, herramientas con confirmación deben quedar pendientes; las de lectura pueden ejecutarse.
- En piloto automático, ejecuta automáticamente solo las herramientas permitidas por su política.
- Si faltan datos o existe ambigüedad, pregunta al estudiante.
- No escribas JSON de herramientas, function calls, prompts internos ni Markdown de implementación visible.
- Las fuentes deben proceder de datos reales devueltos por herramientas.

SEGURIDAD DEL AGENTE:
${agentConfig.safety.map((r) => `- ${r}`).join("\n")}`;

    const tools = buildToolsForAgent(agentConfig.tools, isAutonomous === true, user.id, agentId, persistedSkills);
    const result = streamText({ model, messages: messages as any[], system: systemPrompt, tools: tools as any, maxSteps: 8 });
    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("[CHAT] Error en API de Chat:", error);
    return new Response(error?.message || "Internal Error", { status: 500 });
  }
}
