import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { createClient } from "@/utils/supabase/server";
import { findRelatedConcepts, linkConcepts, getGraphStats } from "@/lib/knowledge-graph";
import { getAIEmbedding } from "@/lib/ai";

// 75. save_learned_concept
export const saveLearnedConceptTool: ToolDefinition = {
  id: "save_learned_concept",
  category: "knowledge_graph",
  description: "Guarda un nuevo concepto que el estudiante acaba de aprender en su grafo de conocimiento mental.",
  risk: "write",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    title: z.string().min(1).describe("Título corto del concepto"),
    description: z.string().optional().describe("Descripción breve de lo que aprendió"),
    subject: z.string().optional().describe("Materia o tema general (opcional)")
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
          source_type: args.subject || "chat_ia"
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

// 76. search_knowledge_graph
export const searchKnowledgeGraphTool: ToolDefinition = {
  id: "search_knowledge_graph",
  category: "knowledge_graph",
  description: "Busca semánticamente conceptos en el grafo mental del estudiante (memoria a largo plazo).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1).describe("El tema o pregunta a buscar en la memoria") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const concepts = await findRelatedConcepts(context.userId, args.query, 10);
      return { success: true, message: `Búsqueda en grafo completada.`, data: concepts };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 77. view_related_concepts
export const viewRelatedConceptsTool: ToolDefinition = {
  id: "view_related_concepts",
  category: "knowledge_graph",
  description: "Muestra N conceptos cercanos semánticamente en el grafo de conocimiento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ concept_id: z.string().describe("ID del concepto central") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const supabase = await createClient();
      // First, get the concept title
      const { data: node } = await supabase.from("knowledge_nodes").select("title").eq("id", args.concept_id).single();
      if (!node) return { success: false, error: "Concepto no encontrado" };
      // Then, use the semantic search
      const concepts = await findRelatedConcepts(context.userId, node.title, 5);
      return { success: true, message: `Conceptos relacionados a ${node.title}:`, data: concepts.filter(c => c.id !== args.concept_id) };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 78. create_learning_path
export const createLearningPathTool: ToolDefinition = {
  id: "create_learning_path",
  category: "knowledge_graph",
  description: "Genera una ruta de aprendizaje ordenada basada en lo que el estudiante ya sabe y lo que le falta.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string().describe("Materia o tema a planificar") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const knownConcepts = await findRelatedConcepts(context.userId, args.subject, 20);
      return { 
        success: true, 
        message: "Instrucciones enviadas al IA", 
        data: { 
          instruction: `El estudiante quiere una ruta de aprendizaje para '${args.subject}'. Basado en los siguientes conceptos que ya conoce (o parcialmente conoce), genera una ruta de aprendizaje paso a paso que construya sobre su conocimiento previo.`, 
          knownConcepts: knownConcepts.map(c => c.title).join(", ")
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 79. detect_knowledge_gaps
export const detectKnowledgeGapsTool: ToolDefinition = {
  id: "detect_knowledge_gaps",
  category: "knowledge_graph",
  description: "Compara el conocimiento actual del usuario contra un currículo esperado para detectar lagunas.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string().describe("Materia o tema a analizar") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const knownConcepts = await findRelatedConcepts(context.userId, args.subject, 30);
      return { 
        success: true, 
        message: "Instrucciones enviadas al IA", 
        data: { 
          instruction: `Actúa como un evaluador experto en '${args.subject}'. El estudiante conoce los siguientes conceptos. Identifica al menos 3 lagunas críticas de conocimiento (knowledge gaps) que el estudiante DEBE aprender para dominar la materia de forma integral.`, 
          knownConcepts: knownConcepts.map(c => c.title).join(", ")
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 80. spaced_repetition_review
export const spacedRepetitionReviewTool: ToolDefinition = {
  id: "spaced_repetition_review",
  category: "knowledge_graph",
  description: "Obtiene conceptos que el estudiante no ha repasado recientemente para repetición espaciada.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async (_args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const supabase = await createClient();
      // Mocking SR by taking concepts with lowest confidence or oldest created_at
      const { data, error } = await supabase
        .from("knowledge_nodes")
        .select("title, description, confidence_level")
        .eq("user_id", context.userId)
        .order("confidence_level", { ascending: true })
        .limit(5);
      
      if (error) throw error;
      return { 
        success: true, 
        message: "Generando sesión de repaso...", 
        data: { 
          instruction: `Inicia una sesión de repetición espaciada. Hazle 1 pregunta al estudiante sobre cada uno de estos conceptos, uno por uno. NO des las respuestas inmediatamente.`, 
          conceptsToReview: data
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 81. export_knowledge_graph
export const exportKnowledgeGraphTool: ToolDefinition = {
  id: "export_knowledge_graph",
  category: "knowledge_graph",
  description: "Exporta el grafo de conocimiento del estudiante.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ format: z.enum(["json", "markdown"]).default("json") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const supabase = await createClient();
      const { data } = await supabase.from("knowledge_nodes").select("id, title, description, confidence_level").eq("user_id", context.userId);
      
      if (args.format === "markdown") {
        const md = data?.map(n => `- **${n.title}** (Confianza: ${n.confidence_level}): ${n.description}`).join('\n');
        return { success: true, message: "Exportación lista.", data: md };
      }
      return { success: true, message: "Exportación lista.", data: JSON.stringify(data, null, 2) };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 82. generate_concept_map
export const generateConceptMapTool: ToolDefinition = {
  id: "generate_concept_map",
  category: "knowledge_graph",
  description: "Genera la estructura de un mapa conceptual (nodos y relaciones) usando Mermaid.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const concepts = await findRelatedConcepts(context.userId, args.topic, 10);
      return { 
        success: true, 
        message: "Instrucciones enviadas", 
        data: { 
          instruction: `Usa la sintaxis de Mermaid.js para crear un grafo (graph TD) que conecte lógicamente los siguientes conceptos sobre '${args.topic}':`, 
          concepts: concepts.map(c => c.title).join(", ") 
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 83. view_progress_by_subject
export const viewProgressBySubjectTool: ToolDefinition = {
  id: "view_progress_by_subject",
  category: "knowledge_graph",
  description: "Consulta estadísticas generales del dominio y progreso del estudiante basado en su grafo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string().optional() }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const stats = await getGraphStats(context.userId);
      return { success: true, message: `Estadísticas del grafo obtenidas.`, data: stats };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 84. connect_two_concepts
export const connectTwoConceptsTool: ToolDefinition = {
  id: "connect_two_concepts",
  category: "knowledge_graph",
  description: "Crea una relación explícita entre dos conceptos en el grafo de conocimiento.",
  risk: "write",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ concept_a_id: z.string(), concept_b_id: z.string(), relationship: z.string().default("related_to") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const success = await linkConcepts(context.userId, args.concept_a_id, args.concept_b_id, args.relationship);
      return { success, message: success ? "Conceptos conectados exitosamente." : "Error al conectar." };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 85. generate_flashcards_from_graph
export const generateFlashcardsFromGraphTool: ToolDefinition = {
  id: "generate_flashcards_from_graph",
  category: "knowledge_graph",
  description: "Genera flashcards automáticas desde el Knowledge Graph del usuario.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string().describe("Materia o tema") }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const concepts = await findRelatedConcepts(context.userId, args.subject, 10);
      return { 
        success: true, 
        message: "Instrucciones enviadas", 
        data: { 
          instruction: `Genera 5-10 tarjetas de memorización (Flashcards) formato Pregunta/Respuesta basadas en los siguientes conceptos del estudiante:`, 
          concepts 
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 86. quiz_from_graph
export const quizFromGraphTool: ToolDefinition = {
  id: "quiz_from_graph",
  category: "knowledge_graph",
  description: "Inicia un quiz sobre conceptos guardados para poner a prueba al estudiante.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string() }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const concepts = await findRelatedConcepts(context.userId, args.subject, 5);
      return { 
        success: true, 
        message: "Generando quiz...", 
        data: { 
          instruction: `Diseña un examen corto (quiz) de opción múltiple con 5 preguntas sobre los siguientes temas que el estudiante dice conocer. Hazle la primera pregunta y espera su respuesta:`, 
          concepts: concepts.map(c => c.title).join(", ") 
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 87. import_concepts_from_document
export const importConceptsFromDocTool: ToolDefinition = {
  id: "import_concepts_from_document",
  category: "knowledge_graph",
  description: "Instruye a la IA para que extraiga conceptos clave de un documento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ document_id: z.string() }),
  execute: async (args) => {
    return { success: true, message: "Listo.", data: { instruction: `Extrae los 5 conceptos más importantes del documento proporcionado y ofrécele al estudiante la opción de usar la herramienta save_learned_concept para guardarlos.`, document_id: args.document_id } };
  },
};

// 88. recommend_next_topic
export const recommendNextTopicTool: ToolDefinition = {
  id: "recommend_next_topic",
  category: "knowledge_graph",
  description: "Recomienda qué estudiar basándose en el grafo de conocimiento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async (_args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const stats = await getGraphStats(context.userId);
      return { 
        success: true, 
        message: "Analizando...", 
        data: { 
          instruction: `El estudiante ha estado estudiando recientemente: ${stats.recentConcepts.join(", ")}. Basado en esto, recomienda 3 temas o conceptos nuevos que serían el siguiente paso lógico en su aprendizaje. Explica por qué.`, 
        } 
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 89. calculate_mastery_score
export const calculateMasteryScoreTool: ToolDefinition = {
  id: "calculate_mastery_score",
  category: "knowledge_graph",
  description: "Calcula el porcentaje de dominio por materia/tema.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string() }),
  execute: async (args, context) => {
    try {
      if (!context?.userId) throw new Error("No user ID");
      const supabase = await createClient();
      const { data, error } = await supabase.from("knowledge_nodes").select("confidence_level").eq("user_id", context.userId).ilike("source_type", `%${args.subject}%`);
      if (error) throw error;
      if (!data || data.length === 0) return { success: true, message: "No hay suficientes datos.", data: { score: 0 } };
      
      const sum = data.reduce((acc, curr) => acc + (curr.confidence_level || 0), 0);
      const avg = sum / data.length;
      return { success: true, message: `El nivel de dominio en ${args.subject} es aproximadamente ${(avg * 10).toFixed(1)}/100`, data: { score: avg * 10 } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SKILL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export const knowledgeGraphSkill: Skill = {
  id: "knowledge_graph",
  name: "Aprendizaje y Knowledge Graph",
  category: "learning",
  description: "Memoria semántica a largo plazo y seguimiento del aprendizaje del estudiante.",
  tools: [
    saveLearnedConceptTool,
    searchKnowledgeGraphTool,
    viewRelatedConceptsTool,
    createLearningPathTool,
    detectKnowledgeGapsTool,
    spacedRepetitionReviewTool,
    exportKnowledgeGraphTool,
    generateConceptMapTool,
    viewProgressBySubjectTool,
    connectTwoConceptsTool,
    generateFlashcardsFromGraphTool,
    quizFromGraphTool,
    importConceptsFromDocTool,
    recommendNextTopicTool,
    calculateMasteryScoreTool
  ],
};
