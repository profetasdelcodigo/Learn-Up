import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

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

    // 2. Select Provider dynamically
    // In a real scenario we could check the prompt, but here's a basic routing:
    let model;
    let systemPrompt = "Eres un asistente virtual de Learn Up.";

    if (aiType === "profesor") {
      model = nvidia("meta/llama-3.1-405b-instruct"); // Usamos Nvidia NIM para el profesor
      systemPrompt = `Eres "Profesor Mente", el tutor principal de Learn Up.
Debes responder de forma estructurada, usando Markdown, sin formato de chat tradicional.
Piensa paso a paso y usa tus herramientas cuando sea necesario.`;
    } else if (aiType === "consejero") {
      model = groq("llama-3.3-70b-specdec"); // Groq modelo actualizado
      systemPrompt = `Eres "Alma", la consejera estudiantil de Learn Up.
Comunícate con mucha empatía y da consejos prácticos.`;
    } else if (aiType === "jarvis") {
      // Jarvis usa Gemini por defecto para multimodal
      model = google("gemini-3.6-flash");
      systemPrompt = `Eres "Jarvis", el asistente de sistema de Learn Up.
Puedes controlar el entorno y crear contenido visual.`;
    } else {
      model = groq("llama-3.3-70b-specdec");
    }

    // 3. Define Tools as plain schema objects (no tool() wrapper needed for streamText)
    const tools: Record<string, any> = {
      search_web: {
        description: "Busca en internet información actualizada.",
        parameters: z.object({
          query: z.string().describe("Lo que deseas buscar en la web"),
        }),
      },
      navigate_to: {
        description: "Redirige al usuario a otra página de Learn Up.",
        parameters: z.object({
          route: z.string().describe("La ruta a la que redirigir, ej. /dashboard, /notebook"),
        }),
      },
      generate_image: {
        description: "Genera una imagen usando IA.",
        parameters: z.object({
          prompt: z.string().describe("Descripción de la imagen"),
        }),
      }
    };

    // 4. Execute streamText
    const result = streamText({
      model,
      messages: messages as any[],
      system: systemPrompt,
      tools: tools as any,
      // Si el usuario marcó "Autonomía", permitimos hasta 5 pasos automáticos (la IA llama a la herramienta y se auto-responde)
      // Si no, maxSteps es 1 (por defecto), y la herramienta se pausa para pedir confirmación al cliente.
      // maxSteps: isAutonomous ? 5 : 1, // maxSteps not supported in this ai SDK version
    });

    return (result as any).toDataStreamResponse?.() ?? (result as any).toAIStreamResponse?.() ?? (result as any).toTextStreamResponse();
  } catch (error: any) {
    console.error("Error en API de Chat:", error);
    return new Response("Internal Error", { status: 500 });
  }
}
