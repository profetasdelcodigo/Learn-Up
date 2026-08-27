"use server";

import { getAICompletion } from "@/lib/ai";
import { buildUserMessage } from "./ai-tutor";
import { getTimeContext } from "@/lib/ai/time-context";
import { createClient } from "@/utils/supabase/server";
import { getToolDefinitions, parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import { runAgentLoop } from "@/lib/ai/agent-runner";
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

    // Parse active skills from message
    let activeSkills: string[] = ["research_pack", "library_pack", "learning_pack", "content_pack", "edu_pack"];
    let cleanedMessage = message;
    const skillsMatch = message.match(/\[Skills Activas: (.*?)\]\n\n/);
    if (skillsMatch) {
      activeSkills = skillsMatch[1].split(",");
      cleanedMessage = message.replace(skillsMatch[0], "");
    }

    const toolDefs = `\n${getToolDefinitions(activeSkills)}`;

    const systemPrompt = `${getTimeContext()}

${buildAgentSystemPrompt("jarvis")}

CONTEXTO DEL USUARIO:
- Perfil: ${JSON.stringify(profile || {})}
- Conceptos recientes (Learn Graph): ${JSON.stringify(nodes)}

INSTRUCCIONES ADICIONALES:
- Responde de forma natural, cálida y breve. Eres el asistente central.
- Si detectas que la tarea es académica y no necesita herramientas, adopta el tono de Profesor Mente.
- Regla de Oro: Siempre que el usuario pida algo que requiera una herramienta (ej. "genera una imagen", "haz un video", "busca en internet", "agenda esto"), **ESTÁS OBLIGADO a usar la herramienta correspondiente**. No respondas que no tienes herramientas.
${toolDefs}`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(cleanedMessage, mediaUrl, mediaType);

    const truncatedHistory = history.slice(-15);

    const result = await runAgentLoop(
      systemPrompt,
      truncatedHistory,
      finalMessageContent,
      finalModel || modelId || "groq/openai/gpt-oss-20b",
      {
        userId: user.id,
      }
    );

    return result;
  } catch (error: any) {
    console.error("Error en askJarvis:", error);
    return {
      response: "",
      error: "Disculpa, tuve un problema al procesar tu solicitud como Jarvis. ¡Inténtalo de nuevo!",
    };
  }
}
