import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/utils/supabase/server";
import { AI_AGENT_REGISTRY, AiAgentId } from "@/lib/ai/agent-registry";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";

const groq = createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
const nvidia = createOpenAI({ baseURL: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY });

export const maxDuration = 90;

function normalizeActiveSkills(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()))];
  if (typeof value === "string") return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  return [];
}

function routeContextFromRequest(req: Request): string {
  const referer = req.headers.get("referer") || "";
  try { return referer ? new URL(referer).pathname : "desconocida"; } catch { return "desconocida"; }
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

    const persistedSkills = explicitSkills.length ? explicitSkills : await getPersistedSkillPacks(sessionId);
    if (explicitSkills.length) {
      await saveSkillPacks(explicitSkills, sessionId);
      await saveSkillPacks(explicitSkills);
    }

    const agentId = (aiType || "jarvis") as AiAgentId;
    const agentConfig = AI_AGENT_REGISTRY[agentId] || AI_AGENT_REGISTRY["jarvis"];
    let model;
    if (agentId === "profesor") model = nvidia("meta/llama-3.1-405b-instruct");
    else if (agentId === "jarvis") model = google("gemini-3.6-flash");
    else model = groq("llama-3.3-70b-specdec");

    const systemPrompt = `Eres "${agentConfig.name}".
PROPÓSITO: ${agentConfig.purpose}
RUTA ACTUAL REAL: ${currentRoute}
SKILLS ACTIVAS: ${persistedSkills.join(", ") || "ninguna seleccionada; puedes usar las capacidades disponibles"}

REGLAS DE EJECUCIÓN:
- Usa únicamente las herramientas expuestas por el servidor.
- Nunca inventes URLs, rutas, resultados, fuentes, IDs ni acciones completadas.
- Una solicitud puede utilizar múltiples skills y múltiples herramientas.
- Continúa el workflow hasta terminar o hasta que una acción necesite aprobación.
- En modo manual, herramientas que requieran confirmación quedan pendientes; las de lectura se pueden ejecutar.
- En piloto automático, solo herramientas compatibles con autopilot se ejecutan automáticamente.
- Si faltan datos o hay ambigüedad, pregunta.
- No escribas JSON de herramientas, function calls ni sintaxis interna en el texto visible.

REGLAS DEL AGENTE:
${agentConfig.safety.map((r) => `- ${r}`).join("\n")}`;

    const tools = buildToolsForAgent(agentConfig.tools, isAutonomous === true, user.id, agentId, persistedSkills);
    const result = streamText({ model, messages: messages as any[], system: systemPrompt, tools: tools as any, maxSteps: 8 });
    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("[CHAT] Error en API de Chat:", error);
    return new Response("Internal Error", { status: 500 });
  }
}
