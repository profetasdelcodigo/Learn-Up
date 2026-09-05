import { getAICompletion } from "@/lib/ai";
import { searchTavily } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";

const RESEARCH_TOOLS = new Set([
  "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_wikipedia",
  "compare_multiple_sources", "deep_research", "search_academic_paper", "find_similar_papers",
  "extract_paper_abstract", "generate_literature_review", "search_youtube_transcripts", "search_news",
  "translate_web_page", "find_statistics", "search_github_code", "search_open_education",
  "analyze_seo", "search_doi_isbn", "deep_research_multi_source", "search_scientific_images",
  "analyze_search_trends", "search_legislation", "create_bibliography_from_search",
]);

/**
 * Tool results must contain evidence/data, not instructions for another model.
 * This helper deliberately refuses to turn delegated or simulated tool output into
 * a fabricated success. The only special case is generate_research_report, whose
 * implementation below performs the actual multi-source retrieval itself.
 */
function looksDelegatedOrFake(result: any): boolean {
  const message = String(result?.message || "").toLowerCase();
  const data = result?.data;
  return Boolean(
    result?.success &&
      (data?.instruction ||
        message.includes("delegad") ||
        message.includes("simulad") ||
        message.includes("próxima actualización") ||
        message.includes("proxima actualizacion") ||
        message.includes("directiva")),
  );
}

async function materializeResearchReport(args: Record<string, unknown>) {
  const topic = String(args.topic || "").trim();
  if (!topic) return { success: false, error: "Falta el tema del reporte de investigación." };

  try {
    const results = await searchTavily(topic, 8);
    const sources = (results || [])
      .filter((result: any) => result?.url)
      .slice(0, 8)
      .map((result: any) => ({
        title: result.title || result.url,
        url: result.url,
        snippet: result.content || result.snippet || "",
        provider: "tavily",
      }));

    if (!sources.length) {
      return {
        success: false,
        error: "No se encontraron fuentes web verificables para generar el reporte.",
      };
    }

    const pages = await Promise.allSettled(
      sources.map((source: any) => browseWebPage(source.url)),
    );

    const evidence = pages
      .map((page: any, index: number) => {
        if (page.status !== "fulfilled" || !page.value?.success) return null;
        return {
          title: page.value.title || sources[index].title,
          url: sources[index].url,
          content: String(page.value.content || "").slice(0, 7000),
        };
      })
      .filter(Boolean);

    if (!evidence.length) {
      return {
        success: false,
        error:
          "Se encontraron resultados de búsqueda, pero ninguna fuente pudo ser extraída de forma verificable.",
        data: { sources },
      };
    }

    const prompt = `Redacta un reporte de investigación sobre "${topic}" usando exclusivamente la evidencia proporcionada. No inventes fuentes, autores, cifras ni afirmaciones. Cuando una afirmación no esté respaldada por la evidencia, indícalo. Incluye una sección de fuentes con las URLs exactas proporcionadas.\n\nEVIDENCIA:\n${JSON.stringify(evidence)}`;
    const completion = await getAICompletion(
      [{ role: "user", content: prompt }],
      process.env.GEMINI_TEXT_MODEL || "gemini-3-flash-preview",
    );
    const content = completion?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return {
        success: false,
        error: "No se pudo generar el reporte a partir de la evidencia recuperada.",
      };
    }

    return {
      success: true,
      message: `Reporte generado con ${evidence.length} fuentes extraídas.`,
      data: {
        content,
        sources: evidence.map((item: any) => ({ title: item.title, url: item.url })),
        evidenceCount: evidence.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Error en la investigación del reporte.",
    };
  }
}

export async function materializeToolResult(
  result: any,
  toolName?: string,
  args?: Record<string, unknown>,
) {
  if (!result?.success) return result;

  if (toolName === "generate_research_report" && args) {
    return materializeResearchReport(args);
  }

  // A real tool result must never be converted into another LLM prompt merely
  // because it returned an `instruction`. That hides missing implementations.
  if (looksDelegatedOrFake(result)) {
    const isResearchTool = Boolean(toolName && RESEARCH_TOOLS.has(toolName));
    return {
      success: false,
      error: isResearchTool
        ? `La herramienta ${toolName} no devolvió evidencia de investigación real.`
        : `La herramienta ${toolName || "solicitada"} devolvió una instrucción en lugar de un resultado ejecutado.`,
    };
  }

  return result;
}
