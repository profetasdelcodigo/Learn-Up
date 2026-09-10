import type { Skill, ToolDefinition } from "../core/types";
import { getAICompletion, AI_MODELS } from "@/lib/ai";

const RESEARCH_TOOL_IDS = new Set([
  "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_wikipedia", "compare_multiple_sources",
  "deep_research", "search_academic_paper", "find_similar_papers", "extract_paper_abstract", "generate_literature_review",
  "search_youtube_transcripts", "search_news", "translate_web_page", "find_statistics", "search_github_code",
  "search_open_education", "analyze_seo", "search_doi_isbn", "deep_research_multi_source", "search_scientific_images",
  "analyze_search_trends", "search_legislation", "create_bibliography_from_search",
]);

function isInstructionResult(result: any): boolean {
  return Boolean(result?.success && result?.data?.instruction && typeof result.data.instruction === "string");
}

function cloneWithoutInstruction(data: Record<string, unknown>) {
  const clean = { ...data };
  delete clean.instruction;
  return clean;
}

function wrapTool(tool: ToolDefinition): ToolDefinition {
  if (!tool.execute || RESEARCH_TOOL_IDS.has(tool.id)) return tool;

  return {
    ...tool,
    execute: async (args: any, context: any) => {
      const result = await tool.execute!(args, context);
      if (!isInstructionResult(result)) return result;

      const supportingData = cloneWithoutInstruction(result.data || {});
      const prompt = [
        "Ejecuta directamente la tarea descrita por la herramienta.",
        "No describas lo que debería hacerse: realiza la tarea ahora.",
        "Usa únicamente los datos reales proporcionados; no inventes datos, fuentes, URLs, IDs ni acciones externas.",
        "Devuelve el resultado final útil para el estudiante, sin JSON ni instrucciones internas.",
        "",
        "TAREA:", String(result.data.instruction),
        "",
        "DATOS REALES:", JSON.stringify(supportingData),
      ].join("\n");

      const completion = await getAICompletion(
        [{ role: "user", content: prompt }],
        AI_MODELS.openRouterResearch.id,
      );
      const content = completion?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        return { success: false, error: `La herramienta ${tool.id} no pudo producir un resultado verificable.` };
      }

      return {
        success: true,
        message: result.message || `${tool.name || tool.id} completado.`,
        data: { ...supportingData, content, generatedByTool: true, model: completion?._learnUp?.model || AI_MODELS.openRouterResearch.id },
      };
    },
  };
}

export function withExecutableGenerativeTools(skill: Skill): Skill {
  return { ...skill, tools: skill.tools.map(wrapTool) };
}
