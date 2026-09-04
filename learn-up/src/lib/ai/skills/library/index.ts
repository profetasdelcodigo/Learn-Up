import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { createClient } from "@/utils/supabase/server";
import { 
  searchLibrary, 
  deleteOwnLibraryItem, 
  getUserIndexedDocuments, 
  deleteAiDocument 
} from "@/actions/library";
import { search_documents, indexAiDocumentFromUrl } from "@/actions/ai-tutor";
import { sendMessage, ensurePrivateRoom } from "@/actions/chat";

// Helper function to fetch document chunks for LLM context
async function getDocumentContent(documentId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_document_chunks")
    .select("content")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(30); // Prevent context overflow
  
  if (error || !data || data.length === 0) return "";
  return data.map(d => d.content).join("\n\n");
}

// 53. search_library
export const searchLibraryTool: ToolDefinition = {
  id: "search_library",
  category: "library",
  description: "Busca materiales en la biblioteca aprobada de Learn Up por título, materia o autor.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1).describe("Término de búsqueda") }),
  execute: async (args) => {
    try {
      const results = await searchLibrary(args.query);
      return { success: true, message: `Encontré ${results.length} materiales.`, data: results.slice(0, 5) };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 54. upload_library_file
export const uploadLibraryFileTool: ToolDefinition = {
  id: "upload_library_file",
  category: "library",
  description: "Da instrucciones para subir un archivo a la biblioteca pública.",
  risk: "write",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    return { success: true, message: "Para subir un archivo a la biblioteca pública, por favor usa el botón de subir en la sección de Biblioteca de la interfaz." };
  },
};

// 55. view_own_library_items
export const viewOwnLibraryTool: ToolDefinition = {
  id: "view_own_library_items",
  category: "library",
  description: "Lista los materiales que el usuario ha subido a la biblioteca.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async (_args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const supabase = await createClient();
      const { data, error } = await supabase.from("library_items").select("*").eq("user_id", context.userId);
      if (error) throw error;
      return { success: true, message: `Encontré ${data.length} materiales subidos por ti.`, data };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 56. delete_own_library_item
export const deleteOwnLibraryItemTool: ToolDefinition = {
  id: "delete_own_library_item",
  category: "library",
  description: "Elimina un material propio de la biblioteca pública.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ item_id: z.string().describe("ID del item a eliminar") }),
  execute: async (args) => {
    try {
      await deleteOwnLibraryItem(args.item_id);
      return { success: true, message: "Material eliminado." };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 57. search_documents
export const searchDocumentsTool: ToolDefinition = {
  id: "search_documents",
  category: "library",
  description: "Busca semánticamente en los documentos indexados del usuario (RAG).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1).describe("Tema a buscar") }),
  execute: async (args) => {
    try {
      const result = await search_documents(args.query);
      return { success: true, message: "Búsqueda completada.", data: result };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 58. index_document
export const indexDocumentTool: ToolDefinition = {
  id: "index_document",
  category: "library",
  description: "Indexa un documento para usarlo en RAG a partir de una URL.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ url: z.string().url().describe("URL del documento"), title: z.string().describe("Título del documento") }),
  execute: async (args) => {
    try {
      const result = await indexAiDocumentFromUrl({ title: args.title, url: args.url });
      return { success: result.success, message: result.success ? "Documento indexado." : result.error };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 59. list_indexed_documents
export const listIndexedDocumentsTool: ToolDefinition = {
  id: "list_indexed_documents",
  category: "library",
  description: "Ve todos los documentos privados indexados por el usuario.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    try {
      const docs = await getUserIndexedDocuments();
      return { success: true, message: `Tienes ${docs.length} documentos indexados.`, data: docs };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 60. delete_indexed_document
export const deleteIndexedDocumentTool: ToolDefinition = {
  id: "delete_indexed_document",
  category: "library",
  description: "Elimina un documento privado del índice RAG.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ document_id: z.string().describe("ID del documento AI") }),
  execute: async (args) => {
    try {
      await deleteAiDocument(args.document_id);
      return { success: true, message: "Documento eliminado del índice." };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 61. summarize_document
export const summarizeDocumentTool: ToolDefinition = {
  id: "summarize_document",
  category: "library",
  description: "Genera un resumen ejecutivo de un documento indexado.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_id: z.string().describe("ID del documento AI") }),
  execute: async (args) => {
    try {
      const content = await getDocumentContent(args.document_id);
      if (!content) return { success: false, error: "No se encontró contenido para este documento." };
      return { success: true, message: "Instruye al usuario a leer el resumen.", data: { instruction: "Resume el siguiente texto en viñetas estructuradas:", content } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 62. extract_questions_from_doc
export const extractQuestionsTool: ToolDefinition = {
  id: "extract_questions_from_doc",
  category: "library",
  description: "Genera preguntas evaluativas sobre un documento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_id: z.string().describe("ID del documento AI") }),
  execute: async (args) => {
    try {
      const content = await getDocumentContent(args.document_id);
      if (!content) return { success: false, error: "No se encontró contenido." };
      return { success: true, message: "Instrucciones enviadas.", data: { instruction: "Genera 5 preguntas evaluativas (con respuestas) sobre el siguiente texto:", content } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 63. compare_two_documents
export const compareDocumentsTool: ToolDefinition = {
  id: "compare_two_documents",
  category: "library",
  description: "Compara similitudes y diferencias entre 2 documentos indexados.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ doc_id_1: z.string(), doc_id_2: z.string() }),
  execute: async (args) => {
    try {
      const content1 = await getDocumentContent(args.doc_id_1);
      const content2 = await getDocumentContent(args.doc_id_2);
      return { success: true, message: "Contenido recuperado.", data: { instruction: "Compara los siguientes dos textos, señalando similitudes y diferencias:", text1: content1, text2: content2 } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 64. generate_table_of_contents
export const generateTocTool: ToolDefinition = {
  id: "generate_table_of_contents",
  category: "library",
  description: "Extrae una tabla de contenidos de un documento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_id: z.string() }),
  execute: async (args) => {
    try {
      const content = await getDocumentContent(args.document_id);
      return { success: true, message: "Listo.", data: { instruction: "Genera una tabla de contenidos jerárquica para este texto:", content } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 65. cite_source
export const citeSourceTool: ToolDefinition = {
  id: "cite_source",
  category: "library",
  description: "Genera una cita bibliográfica de un documento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_id: z.string(), format: z.enum(["APA", "MLA", "Chicago", "IEEE", "Vancouver"]).default("APA") }),
  execute: async (args) => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("ai_documents").select("title, source_url, created_at").eq("id", args.document_id).single();
      return { success: true, message: "Metadatos obtenidos.", data: { instruction: `Genera una cita en formato ${args.format} usando los siguientes datos:`, metadata: data } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 66. index_url_as_document
export const indexUrlAsDocumentTool: ToolDefinition = {
  id: "index_url_as_document",
  category: "library",
  description: "Extrae una URL como Markdown e indexa para RAG.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ url: z.string().url() }),
  execute: async (args) => {
    try {
      const result = await indexAiDocumentFromUrl({ title: args.url, url: args.url });
      return { success: result.success, message: result.success ? "URL indexada exitosamente." : result.error };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 67. extract_text_from_image
export const extractTextFromImageTool: ToolDefinition = {
  id: "extract_text_from_image",
  category: "library",
  description: "OCR para extraer texto de una imagen por URL.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url() }),
  execute: async (args) => {
    return { success: true, message: "El modelo de visión procesará la URL proporcionada.", data: { instruction: "Extrae todo el texto visible en la imagen adjunta:", image_url: args.image_url } };
  },
};

// 68. generate_study_guide_from_docs
export const generateStudyGuideTool: ToolDefinition = {
  id: "generate_study_guide_from_docs",
  category: "library",
  description: "Genera una guía de estudio con definiciones a partir de documentos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_ids: z.array(z.string()) }),
  execute: async (args) => {
    try {
      let combined = "";
      for (const id of args.document_ids) {
        combined += (await getDocumentContent(id)) + "\n\n";
      }
      return { success: true, message: "Listo.", data: { instruction: "Crea una guía de estudio con conceptos clave y definiciones basándote en:", content: combined } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 69. search_material_by_subject
export const searchMaterialBySubjectTool: ToolDefinition = {
  id: "search_material_by_subject",
  category: "library",
  description: "Filtra biblioteca pública por materia y nivel educativo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string(), level: z.string().optional() }),
  execute: async (args) => {
    try {
      const supabase = await createClient();
      let q = supabase.from("library_items").select("*").eq("is_approved", true).ilike("subject", `%${args.subject}%`);
      const { data, error } = await q.limit(10);
      if (error) throw error;
      return { success: true, message: `Se encontraron ${data.length} materiales de ${args.subject}`, data };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 70. share_document_with_friend
export const shareDocumentWithFriendTool: ToolDefinition = {
  id: "share_document_with_friend",
  category: "library",
  description: "Comparte un documento de la biblioteca con un amigo vía chat.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ document_url: z.string().url(), friend_id: z.string() }),
  execute: async (args) => {
    try {
      const roomId = await ensurePrivateRoom(args.friend_id);
      await sendMessage(roomId, `¡Hola! Mira este material de la biblioteca: ${args.document_url}`);
      return { success: true, message: "Documento compartido por chat." };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 71. download_as_pdf
export const downloadAsPdfTool: ToolDefinition = {
  id: "download_as_pdf",
  category: "library",
  description: "Informa al usuario cómo descargar un documento como PDF.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    return { success: true, message: "Para descargar esto como PDF, usa el botón de imprimir de tu navegador y selecciona 'Guardar como PDF' o usa el botón de exportación integrado si está disponible." };
  },
};

// 72. analyze_source_credibility
export const analyzeSourceCredibilityTool: ToolDefinition = {
  id: "analyze_source_credibility",
  category: "library",
  description: "Evalúa la credibilidad de una URL usando IA.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }),
  execute: async (args) => {
    return { success: true, message: "Analizando...", data: { instruction: `Evalúa la credibilidad, sesgos y tipo de fuente de la siguiente URL: ${args.url}` } };
  },
};

// 73. create_document_collection
export const createDocumentCollectionTool: ToolDefinition = {
  id: "create_document_collection",
  category: "library",
  description: "Agrupa documentos en una colección temática (simulado).",
  risk: "write",
  requiresConfirmation: false,
  supportsAutopilot: false,
  schema: z.object({ name: z.string(), document_ids: z.array(z.string()) }),
  execute: async (args) => {
    return { success: true, message: `Colección '${args.name}' creada con ${args.document_ids.length} documentos.` };
  },
};

// 74. translate_document
export const translateDocumentTool: ToolDefinition = {
  id: "translate_document",
  category: "library",
  description: "Traduce el texto de un documento a otro idioma.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_id: z.string(), target_language: z.string() }),
  execute: async (args) => {
    try {
      const content = await getDocumentContent(args.document_id);
      return { success: true, message: "Traduciendo...", data: { instruction: `Traduce el siguiente texto al idioma ${args.target_language}:`, content } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 74.1 query_repositories (from Lote 1)
export const queryRepositoriesTool: ToolDefinition = {
  id: "query_repositories",
  category: "library",
  description: "Consulta el Cerebro Único con conocimiento de repositorios de agentes IA.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("Pregunta para el Cerebro Único"),
  }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const supabase = await createClient();
      const { getAIEmbedding } = await import("@/lib/ai");
      const embedding = await getAIEmbedding(args.query);
      const embeddingStr = `[${embedding.join(",")}]`;

      const { data, error } = await supabase.rpc("match_repository_chunks", {
        query_embedding: embeddingStr,
        match_threshold: 0.5,
        match_count: 5,
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        return { success: true, message: "No se encontró información relevante.", data: [] };
      }
      const formatted = data.map((c: any, i: number) =>
        `[Fuente ${i + 1}: ${c.metadata?.repo || "Repositorio"}]\n${c.content}`
      ).join("\n\n---\n\n");
      return { success: true, message: "Información encontrada.", data: formatted };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SKILL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export const librarySkill: Skill = {
  id: "library",
  name: "Biblioteca y Documentos",
  category: "library",
  description: "Búsqueda en biblioteca, documentos indexados, OCR, RAG y repositorios de conocimiento.",
  tools: [
    searchLibraryTool,
    uploadLibraryFileTool,
    viewOwnLibraryTool,
    deleteOwnLibraryItemTool,
    searchDocumentsTool,
    indexDocumentTool,
    listIndexedDocumentsTool,
    deleteIndexedDocumentTool,
    summarizeDocumentTool,
    extractQuestionsTool,
    compareDocumentsTool,
    generateTocTool,
    citeSourceTool,
    indexUrlAsDocumentTool,
    extractTextFromImageTool,
    generateStudyGuideTool,
    searchMaterialBySubjectTool,
    shareDocumentWithFriendTool,
    downloadAsPdfTool,
    analyzeSourceCredibilityTool,
    createDocumentCollectionTool,
    translateDocumentTool,
    queryRepositoriesTool
  ],
};
