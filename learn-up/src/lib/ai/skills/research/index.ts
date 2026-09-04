import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { searchTavily, searchSerper } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";

export const searchWebTool: ToolDefinition = {
  id: "search_web",
  category: "research",
  description: "Busca en internet con Tavily/Serper. Resumen automático del top 3.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1),
  }),
  execute: async (args, context) => {
    try {
      const results = await searchTavily(args.query, 3);
      if (results.length === 0) {
        return { success: false, error: "No se encontraron resultados" };
      }
      return {
        success: true,
        message: `Búsqueda completada para: ${args.query}`,
        data: {
          results,
          sources: results.map((r: any) => ({ title: r.title, url: r.url })) 
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al buscar en internet" }; 
    }
  }
};

export const browseWebPageTool: ToolDefinition = {
  id: "browse_web_page",
  category: "research",
  description: "Extraer contenido completo de URL como Markdown limpio.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    url: z.string().url(),
  }),
  execute: async (args, context) => {
    try {
      const result = await browseWebPage(args.url);
      if (!result.success) {
        return { success: false, error: result.content };
      }
      return {
        success: true,
        message: `Contenido extraído de: ${args.url}`,
        data: {
          title: result.title,
          content: result.content,
          sources: [{ url: args.url, title: result.title }]
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al leer la página web" };
    }
  }
};

export const searchWikipediaTool: ToolDefinition = {
  id: "search_wikipedia",
  category: "research",
  description: "Busca información enciclopédica en Wikipedia en español.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1),
  }),
  execute: async (args, context) => {
    try {
      const res = await fetch(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(args.query)}&utf8=&format=json&origin=*`);
      const data = await res.json();
      const results = data.query?.search || [];
      if (results.length === 0) {
        return { success: false, error: "No se encontraron resultados en Wikipedia" };
      }
      return {
        success: true,
        message: `Búsqueda en Wikipedia completada para: ${args.query}`,
        data: {
          results: results.slice(0, 3).map((r: any) => ({
            title: r.title,
            snippet: r.snippet.replace(/<[^>]*>?/gm, ''), // Remove HTML tags
            url: `https://es.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`
          }))
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al buscar en Wikipedia" };
    }
  }
};

export const searchLibraryTool: ToolDefinition = {
  id: "search_library",
  category: "research",
  description: "Busca documentos, apuntes y recursos en la biblioteca interna de Learn Up.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1),
    subject: z.string().optional().describe("Filtro opcional por materia (ej. Matemáticas, Historia)"),
  }),
  execute: async (args, context) => {
    try {
      const { searchLibrary } = await import("@/actions/library");
      const results = await searchLibrary(args.query, { subject: args.subject });
      
      if (results.length === 0) {
        return { success: false, error: "No se encontraron materiales en la biblioteca" };
      }
      
      return {
        success: true,
        message: `Se encontraron ${results.length} materiales en la biblioteca.`,
        data: {
          results: results.slice(0, 5).map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            subject: r.subject,
            author: r.profiles?.full_name || r.profiles?.username || "Usuario",
            url: `/library/${r.id}`
          }))
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al buscar en la biblioteca" };
    }
  }
};

export const deepSummaryTool: ToolDefinition = {
  id: "deep_summary",
  category: "research",
  description: "Estructura y resume un texto largo en puntos clave, conclusiones y entidades principales.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    text: z.string().describe("El texto largo a resumir (máx 10000 caracteres recomendados)"),
  }),
  execute: async (args) => {
    // Delegamos la tarea de resumen al LLM principal mediante una directiva
    return {
      success: true,
      message: "Directiva de resumen profundo aceptada.",
      data: {
        instruction: "Analiza el texto proporcionado en tus argumentos y genera un resumen estructurado usando Markdown. Incluye: 1. Puntos Clave, 2. Conclusiones principales, 3. Entidades o conceptos importantes."
      }
    };
  }
};

export const extractMetadataTool: ToolDefinition = {
  id: "extract_metadata",
  category: "research",
  description: "Extrae metadatos estructurados (título, autor, fecha, keywords) de un texto o documento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    text: z.string().describe("El texto del cual extraer los metadatos"),
  }),
  execute: async (args) => {
    return {
      success: true,
      message: "Directiva de extracción de metadatos aceptada.",
      data: {
        instruction: "Extrae los metadatos del texto proporcionado y preséntalos en un bloque JSON estructurado con las claves: 'title', 'author', 'date', 'keywords' (array de strings), y 'summary'."
      }
    };
  }
};

export const researchSkill: Skill = {
  id: "research",
  name: "Investigación",
  category: "research",
  description: "Búsqueda web e investigación en profundidad con validación de fuentes reales y resumen estructurado.",
  tools: [searchWebTool, browseWebPageTool, searchWikipediaTool, searchLibraryTool, deepSummaryTool, extractMetadataTool]
};
