import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
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

export const maxDuration = 60; // Allow longer execution for multi-step reasoning

export async function POST(req: Request) {
  try {
    const { messages, aiType, isAutonomous } = await req.json();

    // 1. Auth & Rate Limiting Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Load Agent Config
    const agentId = (aiType || "jarvis") as AiAgentId;
    const agentConfig = AI_AGENT_REGISTRY[agentId] || AI_AGENT_REGISTRY["jarvis"];
    
    // 3. Select Provider dynamically
    let model;
    if (agentId === "profesor") {
      model = nvidia("meta/llama-3.1-405b-instruct"); // Usamos Nvidia NIM para el profesor
    } else if (agentId === "jarvis") {
      model = google("gemini-3.6-flash");
    } else {
      model = groq("llama-3.3-70b-specdec");
    }

    // 4. Build System Prompt from Agent Config
    const systemPrompt = `Eres "${agentConfig.name}".
PROPÓSITO: ${agentConfig.purpose}
REGLAS DE SEGURIDAD:
${agentConfig.safety.map(r => "- " + r).join("\n")}
`;

    // 5. Build native Vercel AI SDK Tools
    const tools = buildToolsForAgent(agentConfig.tools, isAutonomous === true, user.id);

    // 6. Execute streamText with AI SDK v6 API
    const result = streamText({
      model,
      messages: messages as any[],
      system: systemPrompt,
      tools: tools as any,
      // AI SDK v6: use stopWhen with stepCountIs for multi-step tool loops
      stopWhen: stepCountIs(isAutonomous ? 8 : 1),
    });

    // AI SDK v6: toUIMessageStreamResponse includes tool invocation data
    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Error en API de Chat:", error);
    return new Response("Internal Error", { status: 500 });
  }
}
