import { getAICompletion } from "@/lib/ai";

export async function materializeToolResult(result: any) {
  if (!result?.success || !result?.data?.instruction) return result;

  const instruction = String(result.data.instruction).trim();
  if (!instruction) return result;

  const supportingData = { ...result.data };
  delete supportingData.instruction;
  const context = JSON.stringify(supportingData, (_key, value) => {
    if (typeof value === "string" && value.length > 12000) return `${value.slice(0, 12000)}...[truncado]`;
    return value;
  });

  try {
    const completion = await getAICompletion([
      {
        role: "user",
        content: `${instruction}\n\nDATOS REALES DISPONIBLES:\n${context}\n\nReglas: usa únicamente los datos proporcionados. No inventes hechos, URLs, estadísticas ni resultados externos. Devuelve una respuesta útil para el estudiante, sin JSON de herramientas, sin etiquetas internas y sin mencionar que recibiste una instrucción interna.`,
      },
    ], "gemini-3.6-flash");

    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { ...result, success: false, error: "La herramienta produjo una instrucción pero no se pudo materializar el resultado." };
    }

    return {
      success: true,
      message: result.message || "Resultado generado.",
      data: {
        ...supportingData,
        content,
        materialized: true,
        provider: "gemini-3.6-flash",
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "No se pudo materializar el resultado de la herramienta.",
    };
  }
}
