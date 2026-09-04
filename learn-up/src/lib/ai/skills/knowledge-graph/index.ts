import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { createClient } from "@/utils/supabase/server";
import { findRelatedConcepts, linkConcepts, getGraphStats } from "@/lib/knowledge-graph";
import { getAIEmbedding } from "@/lib/ai";

export const saveLearnedConceptTool: ToolDefinition = {
  id: "save_learned_concept",
  category: "knowledge_graph",
  description: "Guarda un nuevo concepto que el estudiante acaba de aprender en su grafo de conocimiento mental.",
  risk: "write",
  requiresConfirmation: false, // Transparent learning background process
  supportsAutopilot: true,
  schema: z.object({
    title: z.string().min(1).describe("Título corto del concepto"),
    description: z.string().optional().describe("Descripción breve de lo que aprendió"),
  }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID provided in context");
      const supabase = await createClient();
      const embedding = await getAIEmbedding(`Título: ${args.title}\nDescripción: ${args.description || ""}`);

      const { data: newNode, error } = await supabase
        .from("knowledge_nodes")
        .insert({
          user_id: context.userId,
          title: args.title,
          description: args.description || "",
          embedding: `[${embedding.join(',')}]`,
          source_type: "chat_ia"
        })
        .select("id")
        .single();

      if (error) throw error;
      return { success: true, message: `Concepto '${args.title}' guardado exitosamente en el grafo.` };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al guardar concepto" };
    }
  },
};

export const searchKnowledgeGraphTool: ToolDefinition = {
  id: "search_knowledge_graph",
  category: "knowledge_graph",
  description: "Busca conceptos relacionados en el grafo mental del estudiante (memoria a largo plazo).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("El tema o pregunta a buscar en la memoria"),
  }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID provided in context");
      const concepts = await findRelatedConcepts(context.userId, args.query, 5);
      return {
        success: true,
        message: `Búsqueda en grafo de conocimiento completada.`,
        data: concepts
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al buscar en el grafo" };
    }
  },
};

export const viewProgressBySubjectTool: ToolDefinition = {
  id: "view_progress_by_subject",
  category: "knowledge_graph",
  description: "Consulta estadísticas generales del dominio y progreso del estudiante basado en su grafo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    subject: z.string().optional(),
  }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID provided in context");
      const stats = await getGraphStats(context.userId);
      return {
        success: true,
        message: `Estadísticas del grafo obtenidas.`,
        data: stats
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al obtener estadísticas del grafo" };
    }
  },
};

export const knowledgeGraphSkill: Skill = {
  id: "knowledge_graph",
  name: "Grafo de Conocimiento",
  category: "learning",
  description: "Memoria semántica a largo plazo y seguimiento del aprendizaje del estudiante.",
  tools: [saveLearnedConceptTool, searchKnowledgeGraphTool, viewProgressBySubjectTool],
};
