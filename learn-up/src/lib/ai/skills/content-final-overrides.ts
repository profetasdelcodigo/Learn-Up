import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { searchWebStructured } from "@/lib/web-search";
import { getAICompletion, AI_MODELS } from "@/lib/ai";

const researchReport: ToolDefinition = {
  id: "generate_research_report", category: "content", description: "Genera un reporte de investigación con búsqueda web real y fuentes trazables.",
  risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ topic: z.string().min(3), source_urls: z.array(z.string().url()).max(10).default([]), max_sources: z.number().int().min(2).max(12).default(6) }),
  execute: async ({ topic, source_urls, max_sources }) => {
    const discovered = source_urls.length ? source_urls.map((url) => ({ title: url, url, snippet: "Fuente proporcionada por el usuario" })) : await searchWebStructured(topic, max_sources);
    if (!discovered.length) return { success: false, error: "No se encontraron fuentes disponibles. No se generará un reporte sin respaldo." };
    const context = discovered.map((s, i) => `[FUENTE ${i + 1}]\nTítulo: ${s.title}\nURL: ${s.url}\nContenido: ${s.snippet}`).join("\n\n");
    const completion = await getAICompletion([{ role: "user", content: `Redacta un reporte de investigación en español sobre: ${topic}. Usa EXCLUSIVAMENTE la evidencia de las fuentes siguientes. No inventes citas, autores, estadísticas ni URLs. Cada afirmación factual importante debe asociarse a [Fuente N]. Incluye: título, resumen, introducción, hallazgos principales, análisis, conclusiones y referencias numeradas. Si la evidencia no permite afirmar algo, dilo explícitamente.\n\n${context}` }], AI_MODELS.openRouterResearch.id);
    const report = String(completion?.choices?.[0]?.message?.content || "").trim();
    if (!report) return { success: false, error: "El modelo no produjo un reporte verificable." };
    return { success: true, message: `Reporte generado con ${discovered.length} fuentes trazables.`, data: { topic, report, sources: discovered.map((s, i) => ({ index: i + 1, title: s.title, url: s.url })), model: completion?._learnUp?.model } };
  },
};

export function withFinalContentOverrides(skill: Skill): Skill {
  if (skill.id !== "content_generation") return skill;
  return { ...skill, tools: skill.tools.map((tool) => tool.id === researchReport.id ? researchReport : tool) };
}
