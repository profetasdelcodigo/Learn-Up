import { getAICompletion } from "@/lib/ai";
import { executeToolAction } from "@/lib/ai-tools";

function looksDelegatedOrFake(result: any): boolean {
  const message = String(result?.message || "").toLowerCase();
  const data = result?.data;
  return Boolean(
    result?.success && (
      data?.instruction ||
      message.includes("delegad") ||
      message.includes("registrada en el sistema") ||
      message.includes("recibida correctamente") ||
      message.includes("simulad") ||
      message.includes("próxima actualización") ||
      message.includes("proxima actualizacion") ||
      message.includes("temporal") ||
      message.includes("directiva")
    )
  );
}

export async function materializeToolResult(result: any, toolName?: string, args?: Record<string, unknown>) {
  if (!result?.success) return result;

  if (looksDelegatedOrFake(result) && toolName) {
    try {
      const legacy = await executeToolAction(toolName, args || {});
      if (legacy?.success && !looksDelegatedOrFake(legacy)) return legacy;
      if (legacy?.success && legacy?.data?.instruction) result = legacy;
      else if (!legacy?.success) return { success: false, error: legacy?.message || "La herramienta no pudo ejecutarse realmente." };
      else return { success: false, error: `La herramienta ${toolName} no tiene una implementación real disponible.` };
    } catch (error: any) {
      return { success: false, error: error?.message || `La herramienta ${toolName} no pudo ejecutarse.` };
    }
  }

  if (!result?.data?.instruction) return result;

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
        content: `${instruction}\n\nDATOS REALES DISPONIBLES:\n${context}\n\nReglas: usa únicamente los datos proporcionados. No inventes hechos, URLs, estadísticas ni resultados externos. Devuelve una respuesta útil para el estudiante, sin JSON de herramientas, sin etiquetas internas y sin mencionar instrucciones internas.`,
      },
    ], "gemini-3.6-flash");

    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { success: false, error: "La herramienta produjo datos insuficientes y no se pudo generar un resultado verificable." };
    }

    return {
      success: true,
      message: result.message || "Resultado generado.",
      data: { ...supportingData, content, materialized: true, provider: "gemini-3.6-flash" },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "No se pudo materializar el resultado de la herramienta." };
  }
}
