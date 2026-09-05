import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/utils/supabase/server";
import { AI_AGENT_REGISTRY, AiAgentId } from "@/lib/ai/agent-registry";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

export const maxDuration = 90;

function normalizeActiveSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
}

function routeContextFromRequest(req: Request): string {
  const referer = req.headers.get("referer") || "";
  try {
    const url = referer ? new URL(referer) : null;
    return url ? `${url.pathname}${url.search}` : "desconocida";
  } catch {
    return "desconocida";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, aiType, isAutonomous } = body;
    const activeSkills = normalizeActiveSkills(body.activeSkills ?? body.activeSkill);
    const currentRoute = typeof body.currentRoute === "string" ? body.currentRoute : routeContextFromRequest(req);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const agentId = (aiType || "jarvis") as AiAgentId;
    const agentConfig = AI_AGENT_REGISTRY[agentId] || AI_AGENT_REGISTRY["jarvis"];

    let model;
    if (agentId === "profesor") {
      model = nvidia("meta/llama-3.1-405b-instruct");
    } else if (agentId === "jarvis") {
      model = google("gemini-3.6-flash");
    } else {
      model = groq("llama-3.3-70b-specdec");
    }

    const systemPrompt = `Eres "${agentConfig.name}".
PROPÓSITO: ${agentConfig.purpose}
RUTA ACTUAL REAL DE LA APLICACIÓN: ${currentRoute}

REGLAS DE SEGURIDAD:
${agentConfig.safety.map((r) => `- ${r}`).join("\n")}

REGLAS DE EJECUCIÓN:
- Usa únicamente las herramientas expuestas por el servidor.
- Nunca inventes URLs, rutas, resultados, fuentes, IDs ni acciones completadas.
- Una solicitud puede requerir múltiples skills y múltiples llamadas a herramientas.
- Continúa el workflow hasta terminar o hasta que una acción requiera aprobación del usuario.
- En modo manual, las tools con confirmación deben quedar pendientes; las de lectura/autorizadas pueden ejecutarse.
- En piloto automático, ejecuta únicamente herramientas que soporten autopilot.
- Si faltan datos, pregunta al usuario en lugar de inventarlos.
- No escribas JSON de herramientas, function calls ni Markdown de implementación en la respuesta visible.
- Cuando una herramienta de investigación devuelva fuentes, considera como hechos únicamente las URLs y datos realmente devueltos por esa herramienta.
`;

    const tools = buildToolsForAgent(
      agentConfig.tools,
      isAutonomous === true,
      user.id,
      agentId,
      activeSkills,
    );

    const result = streamText({
      model,
      messages: messages as any[],
      system: systemPrompt,
      tools: tools as any,
      // Manual también necesita poder encadenar varias operaciones seguras.
      maxSteps: 8,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("[CHAT] Error en API de Chat:", error);
    return new Response("Internal Error", { status: 500 });
  }
}
