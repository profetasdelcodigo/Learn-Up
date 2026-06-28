import { getAICompletion } from "@/lib/ai";

export async function runAcademicCouncil(topic: string, text: string): Promise<string> {
  const evaluate = async (role: string, prompt: string) => {
    try {
      const res = await getAICompletion(
        [
          { role: "system", content: prompt },
          { role: "user", content: `Tema: ${topic}\n\nTexto a evaluar:\n${text}` }
        ]
      );
      return res?.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      return `Error del agente ${role}: ${e.message}`;
    }
  };

  const [grammar, logic, creativity] = await Promise.all([
    evaluate("Gramática", "Eres el Agente de Ortografía y Gramática del Tribunal Académico de Learn Up. Evalúa el texto, corrige errores y sugiere mejoras de vocabulario. Sé directo, breve y útil."),
    evaluate("Lógica", "Eres el Agente de Lógica y Estructura del Tribunal Académico de Learn Up. Evalúa si los argumentos tienen sentido, si la estructura es clara y si las conclusiones se derivan de las premisas. Sé analítico y breve."),
    evaluate("Creatividad", "Eres el Agente de Creatividad y Originalidad del Tribunal Académico de Learn Up. Evalúa el tono, el impacto y propone ideas para hacer el texto más interesante y cautivador. Sé inspirador y breve.")
  ]);

  const judgePrompt = `
Eres el Juez del Tribunal Académico Multi-Agente de Learn Up.
Has recibido los reportes de tus 3 agentes especialistas sobre un texto escrito por un estudiante (Tema: ${topic}).
Debes sintetizar estos reportes en un Veredicto Final estructurado y amigable en Markdown.

Reporte de Gramática:
${grammar}

Reporte de Lógica:
${logic}

Reporte de Creatividad:
${creativity}

Genera un único reporte consolidado usando ### para títulos. No copies y pegues los reportes tal cual, intégralos en un análisis maestro con una calificación simbólica o palabras de aliento al final.
`;

  try {
    const result = await getAICompletion(
      [{ role: "user", content: judgePrompt }]
    );
    const responseText = result?.choices?.[0]?.message?.content || "El consejo no pudo procesar esta solicitud.";

    // Extraer solo la respuesta del presidente
    const presidentMatch = responseText.match(/PRESIDENTE:([\s\S]*)/i);
    const finalResponse = presidentMatch ? presidentMatch[1].trim() : responseText;

    return finalResponse;
  } catch (e: any) {
    throw new Error(`Fallo en el Juez Supremo: ${e.message}`);
  }
}
