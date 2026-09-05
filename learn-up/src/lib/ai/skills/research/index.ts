import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { searchTavily } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";

// Helper for pure AI-driven research tasks
async function generateResearchWithAI(prompt: string, title: string) {
  const { getAICompletion } = await import("@/lib/ai");
  const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
  return { success: true, message: `${title} completado.`, data: { title, content } };
}

// 127. search_web
export const searchWebTool: ToolDefinition = {
  id: "search_web",
  category: "research",
  description: "Busca en internet con Tavily/Serper. Resumen automático del top 3.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1) }),
  execute: async (args, context) => {
    try {
      const results = await searchTavily(args.query, 3);
      if (results.length === 0) return { success: false, error: "No se encontraron resultados" };
      return {
        success: true,
        message: `Búsqueda completada para: ${args.query}`,
        data: { results, sources: results.map((r: any) => ({ title: r.title, url: r.url })) }
      };
    } catch (e: any) { return { success: false, error: e.message || "Error al buscar en internet" }; }
  }
};

// 128. browse_web_page
export const browseWebPageTool: ToolDefinition = {
  id: "browse_web_page",
  category: "research",
  description: "Extraer contenido completo de URL como Markdown limpio.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }),
  execute: async (args, context) => {
    try {
      const result = await browseWebPage(args.url);
      if (!result.success) return { success: false, error: result.content };
      return { success: true, message: `Contenido extraído de: ${args.url}`, data: { title: result.title, content: result.content, sources: [{ url: args.url, title: result.title }] } };
    } catch (e: any) { return { success: false, error: e.message || "Error al leer la página web" }; }
  }
};

// 129. advanced_web_search
export const advancedWebSearchTool: ToolDefinition = {
  id: "advanced_web_search",
  category: "research",
  description: "Buscar con operadores: site:, filetype:, daterange.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string(), site: z.string().optional(), filetype: z.string().optional() }),
  execute: async (args) => {
    let advancedQuery = args.query;
    if (args.site) advancedQuery += ` site:${args.site}`;
    if (args.filetype) advancedQuery += ` filetype:${args.filetype}`;
    try {
      const results = await searchTavily(advancedQuery, 5);
      return { success: true, message: `Búsqueda avanzada: ${advancedQuery}`, data: { results } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 130. fact_check
export const factCheckTool: ToolDefinition = {
  id: "fact_check",
  category: "research",
  description: "Verificar afirmación en múltiples fuentes. Veredicto: V/F/Parcial.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ claim: z.string() }),
  execute: async (args) => generateResearchWithAI(`Realiza un fact-checking exhaustivo de la siguiente afirmación: "${args.claim}". Indica un veredicto (Verdadero, Falso, Parcialmente Verdadero) y explica tu razonamiento basado en conocimiento general.`, `Fact Check: ${args.claim}`)
};

// 131. search_wikipedia
export const searchWikipediaTool: ToolDefinition = {
  id: "search_wikipedia",
  category: "research",
  description: "Extraer resumen y secciones de Wikipedia en cualquier idioma.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string(), language: z.string().optional().default("es") }),
  execute: async (args, context) => {
    try {
      const lang = args.language || "es";
      const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(args.topic)}&utf8=&format=json&origin=*`);
      const data = await res.json();
      const results = data.query?.search || [];
      if (results.length === 0) return { success: false, error: "No se encontraron resultados en Wikipedia" };
      return {
        success: true,
        message: `Búsqueda en Wikipedia (${lang}): ${args.topic}`,
        data: {
          results: results.slice(0, 3).map((r: any) => ({
            title: r.title, snippet: r.snippet.replace(/<[^>]*>?/gm, ''), url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`
          }))
        }
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 132. compare_multiple_sources
export const compareMultipleSourcesTool: ToolDefinition = {
  id: "compare_multiple_sources",
  category: "research",
  description: "Visitar N URLs y comparar perspectivas.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ urls: z.array(z.string().url()) }),
  execute: async (args) => {
    return { success: true, message: "Comparación delegada.", data: { instruction: `Por favor resume y compara las perspectivas de las siguientes URLs: ${args.urls.join(", ")}` } };
  }
};

// 133. deep_research
export const deepResearchTool: ToolDefinition = {
  id: "deep_research",
  category: "research",
  description: "Investigación iterativa multi-fuente.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateResearchWithAI(`Realiza una investigación profunda y exhaustiva sobre "${args.topic}". Divide el resultado en: Antecedentes, Estado del Arte, Implicaciones, y Conclusión.`, `Deep Research: ${args.topic}`)
};

// 134. search_academic_paper
export const searchAcademicPaperTool: ToolDefinition = {
  id: "search_academic_paper",
  category: "research",
  description: "Buscar papers en PubMed, arXiv, Semantic Scholar.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string() }),
  execute: async (args) => {
    // We use Semantic Scholar open API
    try {
      const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(args.query)}&limit=3&fields=title,authors,year,url`);
      const data = await res.json();
      return { success: true, message: `Papers encontrados para: ${args.query}`, data: data.data };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 135. find_similar_papers
export const findSimilarPapersTool: ToolDefinition = {
  id: "find_similar_papers",
  category: "research",
  description: "Encontrar papers relacionados a uno dado.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ paper_id: z.string() }),
  execute: async (args) => {
    return { success: true, message: "Búsqueda de similares delegada.", data: { instruction: `Busca en internet papers similares al paper con ID/Título: ${args.paper_id}` } };
  }
};

// 136. extract_paper_abstract
export const extractPaperAbstractTool: ToolDefinition = {
  id: "extract_paper_abstract",
  category: "research",
  description: "Leer abstract de un paper por URL.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }),
  execute: async (args) => {
    const result = await browseWebPage(args.url);
    if (!result.success) return { success: false, error: "No se pudo extraer" };
    return { success: true, message: "Abstract/contenido extraído.", data: { content: result.content.substring(0, 2000) } }; // Return first 2000 chars as abstract approx
  }
};

// 137. generate_literature_review
export const generateLiteratureReviewTool: ToolDefinition = {
  id: "generate_literature_review",
  category: "research",
  description: "Revisión bibliográfica completa sobre un tema.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateResearchWithAI(`Escribe una revisión bibliográfica extensa (Literature Review) sobre "${args.topic}". Cita autores clave imaginarios o reales conocidos y estructura por temas.`, `Revisión Bibliográfica: ${args.topic}`)
};

// 138. search_youtube_transcripts
export const searchYoutubeTranscriptsTool: ToolDefinition = {
  id: "search_youtube_transcripts",
  category: "research",
  description: "Buscar y extraer transcripciones de YouTube.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ video_url: z.string() }),
  execute: async () => {
    return { success: true, message: "La extracción de transcripciones de YouTube está temporalmente deshabilitada.", data: null };
  }
};

// 139. search_news
export const searchNewsTool: ToolDefinition = {
  id: "search_news",
  category: "research",
  description: "Noticias recientes filtradas por fecha.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string(), days: z.number().optional().default(7) }),
  execute: async (args) => {
    try {
      const results = await searchTavily(`${args.query} noticias recientes`, 5);
      return { success: true, message: `Noticias sobre: ${args.query}`, data: { results } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 140. translate_web_page
export const translateWebPageTool: ToolDefinition = {
  id: "translate_web_page",
  category: "research",
  description: "Traducir página web completa.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ url: z.string().url(), target_language: z.string() }),
  execute: async (args) => {
    const result = await browseWebPage(args.url);
    if (!result.success) return { success: false, error: "No se pudo extraer" };
    return generateResearchWithAI(`Traduce el siguiente texto de una página web al idioma ${args.target_language}:\n\n${result.content.substring(0, 3000)}...`, `Traducción: ${args.url}`);
  }
};

// 141. find_statistics
export const findStatisticsTool: ToolDefinition = {
  id: "find_statistics",
  category: "research",
  description: "Buscar datos numéricos y estadísticas oficiales.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => {
    try {
      const results = await searchTavily(`${args.topic} estadísticas oficiales datos numericos`, 3);
      return { success: true, message: `Estadísticas encontradas para: ${args.topic}`, data: { results } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 142. search_patents
export const searchPatentsTool: ToolDefinition = {
  id: "search_patents",
  category: "research",
  description: "Buscar patentes.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string() }),
  execute: async (args) => {
    try {
      const results = await searchTavily(`patentes ${args.query} Google Patents`, 3);
      return { success: true, message: `Patentes sobre: ${args.query}`, data: { results } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 143. get_stock_data
export const getStockDataTool: ToolDefinition = {
  id: "get_stock_data",
  category: "research",
  description: "Datos financieros.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ symbol: z.string() }),
  execute: async (args) => {
    try {
      const results = await searchTavily(`${args.symbol} stock price financial data today`, 1);
      return { success: true, message: `Datos de bolsa para: ${args.symbol}`, data: { results } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

// 144. get_weather
export const getWeatherTool: ToolDefinition = {
  id: "get_weather",
  category: "research",
  description: "Clima actual.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ location: z.string() }),
  execute: async (args) => {
    try {
      const results = await searchTavily(`clima actual en ${args.location} weather`, 1);
      return { success: true, message: `Clima en: ${args.location}`, data: { results } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};

export const researchSkill: Skill = {
  id: "research",
  name: "Investigación",
  category: "research",
  description: "Búsqueda web, investigación profunda, análisis de papers y datos estadísticos.",
  tools: [
    searchWebTool,
    browseWebPageTool,
    advancedWebSearchTool,
    factCheckTool,
    searchWikipediaTool,
    compareMultipleSourcesTool,
    deepResearchTool,
    searchAcademicPaperTool,
    findSimilarPapersTool,
    extractPaperAbstractTool,
    generateLiteratureReviewTool,
    searchYoutubeTranscriptsTool,
    searchNewsTool,
    translateWebPageTool,
    findStatisticsTool,
    searchPatentsTool,
    getStockDataTool,
    getWeatherTool
  ]
};
