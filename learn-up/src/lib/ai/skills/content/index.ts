import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { generateFalImage } from "@/lib/fal";

const generateImageTool: ToolDefinition = {
  id: "generate_image",
  category: "multimedia",
  description: "Genera una imagen con IA usando Fal.ai. Puede ser fotorrealista, ilustración o diagrama.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    prompt: z.string().min(1).describe("Descripción de la imagen a generar"),
    purpose: z.string().optional().describe("Propósito: receta, estudio, presentación"),
  }),
  execute: async (args, _context) => {
    try {
      const imageUrl = await generateFalImage(args.prompt);
      return { success: true, message: `Imagen generada: ${args.prompt}`, data: { url: imageUrl } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const searchImageTool: ToolDefinition = {
  id: "search_image",
  category: "multimedia",
  description: "Busca una foto en Unsplash por término de búsqueda.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("Término de búsqueda para Unsplash"),
  }),
  execute: async (args, _context) => {
    try {
      const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
      if (!UNSPLASH_KEY) throw new Error("Unsplash API key no configurada");
      const resp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(args.query)}&per_page=3`, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      });
      if (!resp.ok) throw new Error(`Unsplash error: ${resp.status}`);
      const data = await resp.json();
      const photos = data.results?.map((p: any) => ({
        url: p.urls?.regular,
        alt: p.alt_description,
        credit: p.user?.name,
      })) || [];
      return { success: true, message: `Encontré ${photos.length} imágenes.`, data: photos };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const generateVideoTool: ToolDefinition = {
  id: "generate_video",
  category: "multimedia",
  description: "Genera un video corto con IA usando Fal.ai.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    prompt: z.string().min(1).describe("Descripción del video a generar"),
    purpose: z.string().optional(),
  }),
  execute: async (args, _context) => {
    try {
      // Uses the same fal infrastructure but with video model
      const { generateFalVideo } = await import("@/lib/fal");
      const videoUrl = await generateFalVideo(args.prompt);
      return { success: true, message: `Video generado.`, data: { url: videoUrl } };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al generar video" };
    }
  },
};

const generateDocumentTool: ToolDefinition = {
  id: "generate_document",
  category: "content",
  description: "Genera un documento markdown completo y descargable sobre un tema.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    title: z.string().min(1).describe("Título del documento"),
    outline: z.string().optional().describe("Esquema o guía del contenido"),
    topic: z.string().optional().describe("Tema del documento"),
  }),
  execute: async (args, context) => {
    try {
      const { getAICompletion } = await import("@/lib/ai");
      const prompt = `Genera un documento académico completo en Markdown sobre: "${args.title}"${args.outline ? `\nEsquema: ${args.outline}` : ""}${args.topic ? `\nTema: ${args.topic}` : ""}
      
Incluye: portada, índice, introducción, desarrollo con subsecciones, conclusión, y bibliografía.
Formato: Markdown con títulos, negritas, listas y bloques de cita.
Extensión: 1500-3000 palabras.`;

      const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
      return {
        success: true,
        message: `Documento "${args.title}" generado exitosamente. Descárgalo abajo.`,
        data: { title: args.title, content },
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const createExamTool: ToolDefinition = {
  id: "create_exam",
  category: "content",
  description: "Crea un examen interactivo con rúbrica, puntajes y respuestas.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    topic: z.string().min(1).describe("Tema del examen"),
    difficulty: z.string().optional().default("intermedio"),
    question_count: z.number().optional().default(10),
  }),
  execute: async (args, _context) => {
    try {
      const { getAICompletion } = await import("@/lib/ai");
      const prompt = `Crea un examen completo sobre "${args.topic}" con:
- ${args.question_count || 10} preguntas
- Dificultad: ${args.difficulty || "intermedio"}
- Mezcla de tipos: opción múltiple, verdadero/falso, desarrollo
- Cada pregunta con puntaje (total = 100 puntos)
- Incluye rúbrica de evaluación
- Incluye las respuestas correctas al final

Formato: Markdown estructurado con ## para secciones.`;

      const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
      return {
        success: true,
        message: `Examen de "${args.topic}" generado. Descárgalo abajo.`,
        data: { title: `Examen: ${args.topic}`, content },
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const generateFlashcardsTool: ToolDefinition = {
  id: "generate_flashcards",
  category: "content",
  description: "Genera tarjetas de repaso (flashcards) con frente y reverso sobre un tema.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    topic: z.string().min(1).describe("Tema de las flashcards"),
    count: z.number().optional().default(20),
  }),
  execute: async (args, _context) => {
    try {
      const { getAICompletion } = await import("@/lib/ai");
      const prompt = `Genera ${args.count || 20} flashcards sobre "${args.topic}".
Formato JSON array: [{"front": "pregunta", "back": "respuesta"}, ...]
Solo devuelve el JSON, sin texto adicional.`;

      const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
      return {
        success: true,
        message: `${args.count || 20} flashcards generadas sobre "${args.topic}".`,
        data: { title: `Flashcards: ${args.topic}`, content },
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

export const multimediaSkill: Skill = {
  id: "multimedia",
  name: "Multimedia",
  category: "content",
  description: "Generación de imágenes, videos y búsqueda visual.",
  tools: [generateImageTool, searchImageTool, generateVideoTool],
};

export const contentSkill: Skill = {
  id: "content_generation",
  name: "Generación de Contenido",
  category: "content",
  description: "Documentos, exámenes, flashcards y material educativo.",
  tools: [generateDocumentTool, createExamTool, generateFlashcardsTool],
};
