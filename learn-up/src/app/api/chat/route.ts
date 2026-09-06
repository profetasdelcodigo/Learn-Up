import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/utils/supabase/server";
import { AI_AGENT_REGISTRY, AiAgentId } from "@/lib/ai/agent-registry";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";
import { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";
import { normalizeSkillPacks } from "@/lib/ai/core/tool-catalog";

export const maxDuration = 90;

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-120b:free";

function normalizeModel(value: unknown): { provider: "openrouter" | "groq" | "nvidia" | "google"; model: string } {
  const raw = typeof value === "string" ? value.replace(/::autopilot$/i, "").trim() : "";
  if (!raw || raw === "openrouter/free" || raw === "openrouter/openrouter/free") return { provider: "openrouter", model: DEFAULT_OPENROUTER_MODEL };
  const slash = raw.indexOf("/");
  if (slash > 0) {
    const prefix = raw.slice(0, slash).toLowerCase();
    const model = raw.slice(slash + 1).trim();
    if (["openrouter", "groq", "nvidia", "google", "gemini"].includes(prefix) && model) {
      return { provider: prefix === "gemini" ? "google" : prefix as "openrouter" | "groq" | "nvidia" | "google", model };
    }
  }
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
    return createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: key })(selection.model);
  }
  if (selection.provider === "nvidia") {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) throw new Error("NVIDIA_API_KEY no configurada");
    return createOpenAI({ baseURL: "https://integrate.api.nvidia.com/v1", apiKey: key })(selection.model);
  }
  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  return google(selection.model, { apiKey: key });
}

function routeContextFromRequest(req: Request): string {
  const referer = req.headers.get("referer") || "";
  try { return referer ? new URL(referer).pathname : "desconocida"; } catch { return "desconocida"; }
}

function extractMediaContext(messages: unknown): { mediaUrl: string | null; mediaType: string | null } {
  if (!Array.isArray(messages)) return { mediaUrl: null, mediaType: null };
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message: any = messages[i];
    if (!Array.isArray(message?.content)) continue;
    for (const part of [...message.content].reverse()) {
      const url = part?.image_url?.url || part?.file_url?.url || part?.url;
      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        const type = part?.type === "image_url" ? "image" : part?.type === "file_url" ? "file" : null;
        return { mediaUrl: url, mediaType: type };
      }
    }
  }
  return { mediaUrl: null, mediaType: null };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, aiType, isAutonomous } = body;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const hasExplicitSkills = Object.prototype.hasOwnProperty.call(body, "activeSkills") || Object.prototype.hasOwnProperty.call(body, "activeSkill");
    const explicitSkills = normalizeSkillPacks(body.activeSkills ?? body.activeSkill);
    const currentRoute = typeof body.currentRoute === "string" ? body.currentRoute : routeContextFromRequest(req);
    const bodyMediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl : typeof body.media_url === "string" ? body.media_url : null;
    const bodyMediaType = typeof body.mediaType === "string" ? body.mediaType : typeof body.media_type === "string" ? body.media_type : null;
    const messageMedia = extractMediaContext(messages);
    const mediaUrl = bodyMediaUrl || messageMedia.mediaUrl;
    const mediaType = bodyMediaType || messageMedia.mediaType;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const persisted = hasExplicitSkills
      ? explicitSkills
      : await getPersistedSkillPacks(sessionId);

    if (hasExplicitSkills) {
      await Promise.all([
        saveSkillPacks(persisted, sessionId),
        saveSkillPacks(persisted),
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
SKILLS ACTIVAS: ${persisted.join(", ") || "ninguna seleccionada"}

REGLAS DE EJECUCIÓN:
- Usa únicamente herramientas expuestas por el servidor.
- Nunca inventes URLs, rutas, resultados, fuentes, IDs ni acciones completadas.
- Una solicitud puede utilizar múltiples skills y múltiples herramientas en varias rondas.
- Continúa hasta terminar, hasta necesitar datos del estudiante o hasta que una acción requiera autorización.
- En modo manual, las acciones que requieran confirmación no deben ejecutarse silenciosamente.
- En piloto automático, ejecuta únicamente herramientas compatibles con autopilot.
- Si faltan datos o existe ambigüedad, pregunta al estudiante.
- No muestres JSON de herramientas, function calls, prompts internos ni sintaxis de implementación.
- Las fuentes deben provenir de resultados reales de herramientas.

SEGURIDAD DEL AGENTE:
${agentConfig.safety.map((r) => `- ${r}`).join("\n")}`;

    const tools = buildToolsForAgent(
      agentConfig.tools,
      isAutonomous === true,
      user.id,
      agentId,
      persisted,
      { sessionId, currentRoute, mediaUrl, mediaType },
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
