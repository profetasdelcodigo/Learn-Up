import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { generateFalImage } from "@/lib/fal";

// Helper for pure text generation tools
async function generateContentWithAI(prompt: string, title: string) {
  const { getAICompletion } = await import("@/lib/ai");
  const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
  return { success: true, message: `${title} generado exitosamente.`, data: { title, content } };
}

// 112. generate_image
export const generateImageTool: ToolDefinition = {
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
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 113. search_image
export const searchImageTool: ToolDefinition = {
  id: "search_image",
  category: "multimedia",
  description: "Busca una foto en Unsplash por término de búsqueda.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1) }),
  execute: async (args, _context) => {
    try {
      const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
      if (!UNSPLASH_KEY) throw new Error("Unsplash API key no configurada");
      const resp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(args.query)}&per_page=3`, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      });
      if (!resp.ok) throw new Error(`Unsplash error: ${resp.status}`);
      const data = await resp.json();
      const photos = data.results?.map((p: any) => ({ url: p.urls?.regular, alt: p.alt_description, credit: p.user?.name })) || [];
      return { success: true, message: `Encontré ${photos.length} imágenes.`, data: photos };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 114. generate_video
export const generateVideoTool: ToolDefinition = {
  id: "generate_video",
  category: "multimedia",
  description: "Genera un video corto con IA usando Fal.ai.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ prompt: z.string().min(1), purpose: z.string().optional() }),
  execute: async (args, _context) => {
    try {
      const { generateFalVideo } = await import("@/lib/fal");
      const videoUrl = await generateFalVideo(args.prompt);
      return { success: true, message: `Video generado.`, data: { url: videoUrl } };
    } catch (e: any) { return { success: false, error: e.message }; }
  },
};

// 115. analyze_image
export const analyzeImageTool: ToolDefinition = {
  id: "analyze_image",
  category: "multimedia",
  description: "Describir imagen subida: contenido, OCR, Q&A visual.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ image_description: z.string().describe("Contexto sobre la imagen que se quiere analizar") }),
  execute: async (args) => {
    return { success: true, message: "Enviando directiva de análisis visual al agente principal.", data: { instruction: `Analiza detalladamente la imagen que el usuario adjuntó basándote en este contexto: ${args.image_description}` } };
  }
};

// 116. generate_mermaid_diagram
export const generateMermaidDiagramTool: ToolDefinition = {
  id: "generate_mermaid_diagram",
  category: "multimedia",
  description: "Diagrama de flujo, secuencia, clases, Gantt, ER.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ type: z.string().default("flowchart"), description: z.string() }),
  execute: async (args) => generateContentWithAI(`Crea un diagrama de tipo '${args.type}' usando sintaxis Mermaid.js para representar: ${args.description}. Solo devuelve el bloque de código Mermaid.`, `Diagrama: ${args.type}`)
};

// 117. generate_podcast_script
export const generatePodcastScriptTool: ToolDefinition = {
  id: "generate_podcast_script",
  category: "multimedia",
  description: "Guión de podcast en formato diálogo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Escribe un guión de podcast educativo dinámico sobre "${args.topic}". Debe ser un diálogo entre dos anfitriones (Ej. Host 1 y Host 2). Incluye intro, desarrollo del tema, datos curiosos y conclusión.`, `Guión Podcast: ${args.topic}`)
};

// 118. describe_math_image
export const describeMathImageTool: ToolDefinition = {
  id: "describe_math_image",
  category: "multimedia",
  description: "Extraer ecuación de foto y resolverla paso a paso.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ problem_description: z.string() }),
  execute: async (args) => {
    return { success: true, message: "Enviando directiva de matemáticas al agente principal.", data: { instruction: `El usuario quiere que resuelvas el problema matemático visible en la imagen adjunta. Contexto: ${args.problem_description}. Muestra el paso a paso detallado utilizando formato matemático (LaTeX/Markdown).` } };
  }
};

// 119. text_to_speech
export const textToSpeechTool: ToolDefinition = {
  id: "text_to_speech",
  category: "multimedia",
  description: "Convertir texto a audio MP3 (Simulado/Instrucción).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ text: z.string() }),
  execute: async () => {
    return { success: true, message: "La función TTS estará disponible en una próxima actualización del navegador de Learn Up. Por ahora, pídele al usuario que use la lectura en voz alta nativa." };
  }
};

// 120. transcribe_audio
export const transcribeAudioTool: ToolDefinition = {
  id: "transcribe_audio",
  category: "multimedia",
  description: "Transcribir nota de voz/audio a texto.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ audio_url: z.string() }),
  execute: async () => {
    return { success: true, message: "La transcripción automática se maneja a nivel del cliente de chat con Whisper. Indica al usuario que envíe un mensaje de voz directamente en la interfaz." };
  }
};

// 121. generate_infographic_layout
export const generateInfographicLayoutTool: ToolDefinition = {
  id: "generate_infographic_layout",
  category: "multimedia",
  description: "Estructura visual de infografía en Markdown.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Diseña la estructura de una infografía sobre "${args.topic}". Divide en secciones (Encabezado, Dato curioso, Gráfico 1, Cita central, Conclusión) y describe qué elemento visual y qué texto exacto iría en cada una.`, `Estructura de Infografía: ${args.topic}`)
};

// 122. generate_color_palette
export const generateColorPaletteTool: ToolDefinition = {
  id: "generate_color_palette",
  category: "multimedia",
  description: "Paleta de colores Hex para diseños.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ theme: z.string() }),
  execute: async (args) => generateContentWithAI(`Genera una paleta de 5 colores profesionales basada en el tema "${args.theme}". Para cada color proporciona el código HEX, RGB, y una breve descripción de para qué elemento de UI debería usarse (ej. fondo principal, acento, texto).`, `Paleta de Colores: ${args.theme}`)
};

// 123. extract_colors_from_image
export const extractColorsFromImageTool: ToolDefinition = {
  id: "extract_colors_from_image",
  category: "multimedia",
  description: "Detectar colores dominantes de imagen.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ image_url: z.string().optional() }),
  execute: async () => {
    return { success: true, message: "Delegando a agente visual.", data: { instruction: "Si el usuario subió una imagen, enumera los 5 colores predominantes que observas en ella con su código HEX aproximado." } };
  }
};

// 124. resize_image
export const resizeImageTool: ToolDefinition = {
  id: "resize_image",
  category: "multimedia",
  description: "Redimensionar imagen (Instrucción de uso).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ width: z.number().optional() }),
  execute: async () => {
    return { success: true, message: "Indica al usuario que actualmente las ediciones de imagen se deben realizar en un software de terceros, pero podemos generar una nueva con el prompt deseado." };
  }
};

// 125. compress_image
export const compressImageTool: ToolDefinition = {
  id: "compress_image",
  category: "multimedia",
  description: "Comprimir imagen (Instrucción de uso).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    return { success: true, message: "Indica al usuario que la plataforma comprime automáticamente las imágenes al subirlas al chat." };
  }
};

// 126. generate_qr_code
export const generateQrCodeTool: ToolDefinition = {
  id: "generate_qr_code",
  category: "multimedia",
  description: "Crear código QR desde URL.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }),
  execute: async (args) => {
    // Generate a simple markdown image pointing to a public QR generation API
    const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=\${encodeURIComponent(args.url)}\`;
    const md = \`![Código QR para \${args.url}](\${qrUrl})\n\n[Enlace original](\${args.url})\`;
    return { success: true, message: "Código QR generado.", data: md };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SKILL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export const multimediaSkill: Skill = {
  id: "multimedia",
  name: "Multimedia",
  category: "content",
  description: "Generación de imágenes, videos y herramientas visuales y de audio.",
  tools: [
    generateImageTool,
    searchImageTool,
    generateVideoTool,
    analyzeImageTool,
    generateMermaidDiagramTool,
    generatePodcastScriptTool,
    describeMathImageTool,
    textToSpeechTool,
    transcribeAudioTool,
    generateInfographicLayoutTool,
    generateColorPaletteTool,
    extractColorsFromImageTool,
    resizeImageTool,
    compressImageTool,
    generateQrCodeTool
  ],
};
