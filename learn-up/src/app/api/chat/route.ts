import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/utils/supabase/server";
import { AI_AGENT_REGISTRY, AiAgentId } from "@/lib/ai/agent-registry";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";
import { AI_MODELS } from "@/lib/ai";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const nvidia = createOpenAI({
  baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

export const maxDuration = 60;

function hasMultimedia(messages: any[]): boolean {
  return messages.some((message) => Array.isArray(message?.content) && message.content.some((part: any) =>
    part?.type === "image" || part?.type === "image_url" || part?.type === "file" || part?.type === "file_url"
  ));
}

export async function POST(req: Request) {
  try {
    const { messages, aiType, isAutonomous, sessionId } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const agentId = (aiType || "jarvis") as AiAgentId;
    const agentConfig = AI_AGENT_REGISTRY[agentId] || AI_AGENT_REGISTRY.jarvis;
    const multimodal = hasMultimedia(messages || []);

    let model;
    if (multimodal) {
      // Multimedia is always routed to a Gemini multimodal model.
      model = google(AI_MODELS.geminiMultimodal);
    } else if (agentId === "profesor") {
      model = nvidia(process.env.NVIDIA_MODEL || AI_MODELS.nvidiaReasoning);
    } else if (agentId === "jarvis") {
      model = google(AI_MODELS.geminiFast);
    } else {
      model = groq(AI_MODELS.groqFast);
    }

    const systemPrompt = `Eres "${agentConfig.name}".\nPROPÓSITO: ${agentConfig.purpose}\nREGLAS DE SEGURIDAD:\n${agentConfig.safety.map(r => "- " + r).join("\n")}\n\nNo reveles herramientas internas, JSON de llamadas, argumentos ni detalles del servidor al usuario.`;
    const tools = buildToolsForAgent(agentConfig.tools, isAutonomous === true, user.id, sessionId || null);

    const result = (streamText as any)({
      model,
      messages: messages as any[],
      system: systemPrompt,
      tools,
      maxSteps: 8,
    });

    return (result as any).toDataStreamResponse?.() ?? (result as any).toAIStreamResponse?.() ?? (result as any).toTextStreamResponse();
  } catch (error: any) {
    console.error("Error en API de Chat:", error);
    return new Response("Internal Error", { status: 500 });
  }
}
