"use server";

import { getAICompletion } from "@/lib/ai";
import { buildUserMessage } from "./ai-tutor";
import { getTimeContext } from "@/lib/ai/time-context";
import { createClient } from "@/utils/supabase/server";
import { TOOL_DEFINITIONS, parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";

export async function askJarvis(
  message: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
  modelId?: string,
): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { response: "", error: "No autorizado. Por favor inicia sesión." };

    const { checkJarvisSecurity } = await import("../lib/ai/jarvis-guard");
    const securityCheck = await checkJarvisSecurity(null as any, user.id, message);
    if (!securityCheck.safe) {
      return { response: securityCheck.message || "Error de seguridad detectado." };
    }

    if (!message.trim() && !mediaUrl)
      return {
        response: "",
        error: "Por favor escribe una solicitud o envía un archivo.",
      };

    // 1. Obtener contexto de lectura (Perfil + Learn Graph)
    // Extraemos perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    const { findRelatedConcepts } = await import("@/lib/knowledge-graph");
    const nodes = await findRelatedConcepts(user.id, message);

    // Fast-Path
    const isSimpleMessage = message.trim().length < 50 && !message.includes("?") && !message.includes("/") && !mediaUrl;
    const isGreeting = /^(hola|buenas|hey|buenos|que tal|como estas|gracias|adios|ok|vale|perfecto)/i.test(message.trim());
    
    const toolDefs = (isSimpleMessage && isGreeting) ? "\n" : `\n${TOOL_DEFINITIONS}`;

    const systemPrompt = `${getTimeContext()}

${buildAgentSystemPrompt("jarvis")}

CONTEXTO DEL USUARIO:
- Perfil: ${JSON.stringify(profile || {})}
- Conceptos recientes (Learn Graph): ${JSON.stringify(nodes)}

INSTRUCCIONES ADICIONALES:
- Responde de forma natural, cálida y breve. Eres el asistente central.
- Si detectas que la tarea es académica y no necesita herramientas, adopta el tono de Profesor Mente.
${toolDefs}`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(message, mediaUrl, mediaType);

    const truncatedHistory = history.slice(-15);

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...truncatedHistory,
        { role: "user", content: finalMessageContent },
      ],
      modelId || "nvidia/nemotron-3-ultra-550b",
    );

    const rawContent = response.choices[0]?.message?.content || "";
    const { cleanText, action } = await parseToolCall(rawContent);

    if (action) {
      if (!action.requiresConfirm) {
        const result = await executeToolAction(action.tool, action.args);
        
        // Si es una herramienta de solo lectura, generar respuesta natural
        if (["search_web", "search_library", "query_learn_graph"].includes(action.tool)) {
          const followUpPrompt = `Resultados de la herramienta ${action.tool}:\n${result.message}\n\nPor favor, responde a la petición del usuario incorporando esta información de forma natural.`;
          
          const followUpResponse = await getAICompletion(
            [
              { role: "system", content: systemPrompt },
              ...truncatedHistory,
              { role: "user", content: finalMessageContent },
              { role: "assistant", content: cleanText },
              { role: "user", content: followUpPrompt },
            ],
            modelId || "nvidia/nemotron-3-ultra-550b"
          );
          
          return { response: followUpResponse.choices[0]?.message?.content || cleanText + "\n" + result.message };
        }
        
        return { response: cleanText + "\n\n" + result.message };
      } else {
        // Requiere confirmación
        return { response: cleanText, actions: [action] };
      }
    }

    return { response: cleanText };
  } catch (error: any) {
    console.error("Error en askJarvis:", error);
    return {
      response: "",
      error: "Disculpa, tuve un problema al procesar tu solicitud como Jarvis. ¡Inténtalo de nuevo!",
    };
  }
}
