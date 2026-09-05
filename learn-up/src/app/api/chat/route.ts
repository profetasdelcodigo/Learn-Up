import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/utils/supabase/server";
import { AI_AGENT_REGISTRY, AiAgentId } from "@/lib/ai/agent-registry";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";

export const maxDuration = 90;

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-120b:free";

function normalizeActiveSkills(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()))];
  }
  if (typeof value === "string") {
    return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  }
  return [];
}

function routeContextFromRequest(req: Request): string {
  const referer = req.headers.get("referer") || "";
  try {
    return referer ? new URL(referer).pathname : "desconocida";
  } catch {
    return "desconocida";
  }
}

function normalizeModel(value: unknown): { provider: "openrouter" | "groq" | "nvidia" | "google"; model: string } {
  const raw = typeof value === "string" ? value.replace(/::autopilot$/i, "").trim() : "";
  if (!raw || raw === "openrouter/free" || raw === "openrouter/openrouter/free") {
    return { provider: "openrouter", model: DEFAULT_OPENROUTER_MODEL };
  }

  const slash = raw.indexOf("/");
  if (slash > 0) {
    const prefix = raw.slice(0, slash).toLowerCase();
    const model = raw.slice(slash + 1).trim();
    if ((prefix === "openrouter" || prefix === "groq" || prefix === "nvidia" || prefix === "google" || prefix === "gemini") && model) {
      return { provider: prefix === "gemini" ? "google" : prefix as "openrouter" | "groq" | "nvidia" | "google", model };
    }
  }

  // Plain Google/Gemini model IDs are routed to Google; all other plain IDs are
  // treated as OpenRouter IDs so existing model selectors remain compatible.
  if (raw.startsWith("gemini-")) return { provider: "google", model: raw };
  return { provider: "openrouter", model: raw };
}

function createProviderModel(selection: ReturnType<typeof normalizeModel>) {
  if (selection.provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY no configurada");
    return createOpenRouter({ apiKey: key })(selection.model);
  }

  if (selection.provider === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY no configurada");
    const client = createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: key });
    return client(selection.model);
  }

  if (selection.provider === "nvidia") {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) throw new Error("NVIDIA_API_KEY no configurada");
    const client = createOpenAI({ baseURL: "https://integrate.api.nvidia.com/v1", apiKey: key });
    return client(selection.model);
  }

  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  return google(selection.model, { apiKey: key });
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

    const persisted = await getPersistedSkillPacks(sessionId);
    const persistedSkills = explicitSkills.length
      ? [...new Set([...persisted, ...explicitSkills])]
      : persisted;

    if (explicitSkills.length) {
      await Promise.all([
        saveSkillPacks(persistedSkills, sessionId),
        saveSkillPacks(persistedSkills),
      ]);
    }

    const agentId = (aiType || "jarvis") as AiAgentId;
    const agentConfig = AI_AGENT_REGISTRY[agentId] || AI_AGENT_REGISTRY["jarvis"];
    const selection = normalizeModel(body.model);
    const model = createProviderModel(selection);

    const systemPrompt = `Eres "${agentConfig.name}".
PROPÓSITO: ${agentConfig.purpose}
RUTA ACTUAL REAL: ${currentRoute}
PROVEEDOR/MODELO ACTUAL: ${selection.provider}/${selection.model}
SKILLS ACTIVAS: ${persistedSkills.join(", ") || "ninguna seleccionada; usa solo las capacidades disponibles"}

REGLAS DE EJECUCIÓN:
- Usa únicamente las herramientas expuestas por el servidor.
- Nunca inventes URLs, rutas, resultados, fuentes, IDs ni acciones completadas.
- Una solicitud puede utilizar múltiples skills y múltiples herramientas en varias rondas.
- Continúa hasta terminar o hasta encontrar una confirmación requerida, falta de datos o error real.
- En modo manual, herramientas con confirmación deben quedar pendientes; las de lectura pueden ejecutarse y el workflow puede continuar en rondas posteriores.
- En piloto automático, ejecuta automáticamente solo las herramientas permitidas por su política.
- Si faltan datos o existe ambigüedad, pregunta al estudiante.
- No escribas JSON de herramientas, function calls, prompts internos ni Markdown de implementación visible.
- Las fuentes deben proceder de datos reales devueltos por herramientas.

SEGURIDAD DEL AGENTE:
${agentConfig.safety.map((r) => `- ${r}`).join("\n")}`;

    const tools = buildToolsForAgent(
      agentConfig.tools,
      isAutonomous === true,
      user.id,
      agentId,
      persistedSkills,
    );

    const result = streamText({
      model,
      messages: messages as any[],
      system: systemPrompt,
      tools: tools as any,
      maxSteps: 8,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("[CHAT] Error en API de Chat:", error);
    const message = error?.message || "Internal Error";
    const status = /API_KEY no configurada/.test(message) ? 503 : 500;
    return new Response(message, { status });
  }
}
