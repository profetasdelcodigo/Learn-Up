import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { createClient } from "@/utils/supabase/server";

const searchLibraryTool: ToolDefinition = {
  id: "search_library",
  category: "library",
  description: "Busca materiales en la biblioteca aprobada de Learn Up por título, materia o autor.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("Término de búsqueda"),
  }),
  execute: async (args, context) => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("library_items")
        .select("id, title, subject, description, type, file_url, created_at")
        .or(`title.ilike.%${args.query}%,subject.ilike.%${args.query}%,description.ilike.%${args.query}%`)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return { success: true, message: `Encontré ${data.length} materiales.`, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const searchDocumentsTool: ToolDefinition = {
  id: "search_documents",
  category: "library",
  description: "Busca semánticamente en los documentos indexados del usuario (RAG con pgvector).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("Pregunta o tema a buscar en tus documentos"),
  }),
  execute: async (args, context) => {
    try {
      const { search_documents } = await import("@/actions/ai-tutor");
      const result = await search_documents(args.query);
      return { success: true, message: "Búsqueda en documentos completada.", data: result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const viewOwnLibraryTool: ToolDefinition = {
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
      const { data, error } = await supabase
        .from("library_items")
        .select("*")
        .eq("uploaded_by", context.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { success: true, message: `Encontré ${data.length} materiales subidos por ti.`, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const queryRepositoriesTool: ToolDefinition = {
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
        return { success: true, message: "No se encontró información relevante en los repositorios.", data: [] };
      }
      const formatted = data.map((c: any, i: number) =>
        `[Fuente ${i + 1}: ${c.metadata?.repo || "Repositorio"}]\n${c.content}`
      ).join("\n\n---\n\n");
      return { success: true, message: "Información encontrada en los repositorios.", data: formatted };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

export const librarySkill: Skill = {
  id: "library",
  name: "Biblioteca y Documentos",
  category: "knowledge",
  description: "Búsqueda en biblioteca, documentos indexados y repositorios de conocimiento.",
  tools: [
    searchLibraryTool,
    searchDocumentsTool,
    viewOwnLibraryTool,
    queryRepositoriesTool,
  ],
};
