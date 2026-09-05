import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
// The getAICompletion uses the exact schema it expects: [{role:"user", content: string}], model
// The actual import is dynamically used in the tool functions to avoid circular deps

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT GENERATION TOOLS (90-111)
// ═══════════════════════════════════════════════════════════════════════════

// Helper to standardise generation 
async function generateContentWithAI(prompt: string, title: string) {
  const { getAICompletion } = await import("@/lib/ai");
  const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
  return {
    success: true,
    message: `${title} generado exitosamente.`,
    data: { title, content }
  };
}

export const generateDocumentTool: ToolDefinition = {
  id: "generate_document",
  category: "content",
  description: "Crear documento markdown completo y descargable.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ title: z.string(), outline: z.string().optional() }),
  execute: async (args) => generateContentWithAI(
    `Genera un documento académico Markdown sobre: "${args.title}"\nEsquema: ${args.outline || "Sin esquema"}\nIncluye introducción, desarrollo, conclusión.`, 
    args.title
  )
};

export const generateSummaryTool: ToolDefinition = {
  id: "generate_summary",
  category: "content",
  description: "Condensar texto en 200-500 palabras con puntos clave.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ text: z.string() }),
  execute: async (args) => generateContentWithAI(`Resume el siguiente texto en puntos clave, máximo 500 palabras:\n\n${args.text}`, "Resumen")
};

export const createStudyPlanTool: ToolDefinition = {
  id: "create_study_plan",
  category: "content",
  description: "Cronograma semanal con temas y actividades.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string(), exam_date: z.string().optional(), hours_per_day: z.number().optional() }),
  execute: async (args) => generateContentWithAI(
    `Genera un plan de estudio en Markdown para la materia "${args.subject}". ` +
    `Fecha límite: ${args.exam_date || "1 mes"}. Horas/día: ${args.hours_per_day || 2}. Incluye cronograma por semana y actividades específicas.`,
    `Plan de Estudio: ${args.subject}`
  )
};

export const generatePresentationOutlineTool: ToolDefinition = {
  id: "generate_presentation_outline",
  category: "content",
  description: "Estructura de diapositivas con puntos por slide.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Diseña una presentación (Slide 1, Slide 2...) sobre "${args.topic}". Para cada slide indica: Título, Puntos clave a mencionar, y sugerencia visual.`, `Presentación: ${args.topic}`)
};

export const generateEssayTool: ToolDefinition = {
  id: "generate_essay",
  category: "content",
  description: "Ensayo académico con intro, desarrollo, conclusión, bibliografía.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ topic: z.string(), format: z.enum(["APA", "MLA"]).optional() }),
  execute: async (args) => generateContentWithAI(`Escribe un ensayo académico sobre "${args.topic}" con formato de referencias ${args.format || "APA"}. Incluye introducción, desarrollo argumentativo, y conclusión.`, `Ensayo: ${args.topic}`)
};

export const generateGlossaryTool: ToolDefinition = {
  id: "generate_glossary",
  category: "content",
  description: "Glosario alfabético con definiciones claras y ejemplos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Crea un glosario con los 15-20 términos más importantes sobre "${args.topic}", en orden alfabético, cada uno con definición clara y un ejemplo.`, `Glosario: ${args.topic}`)
};

export const generateComparisonTableTool: ToolDefinition = {
  id: "generate_comparison_table",
  category: "content",
  description: "Tabla comparativa de elementos en múltiples dimensiones.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ items: z.array(z.string()), dimensions: z.array(z.string()).optional() }),
  execute: async (args) => generateContentWithAI(
    `Crea una tabla comparativa Markdown detallada comparando los siguientes elementos: ${args.items.join(", ")}. ` +
    (args.dimensions ? `Utiliza estas dimensiones para comparar: ${args.dimensions.join(", ")}` : "Compara dimensiones lógicas automáticamente."), 
    `Tabla Comparativa`
  )
};

export const generateCodeTool: ToolDefinition = {
  id: "generate_code",
  category: "content",
  description: "Código funcional en el lenguaje indicado con comentarios y tests.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ language: z.string(), description: z.string() }),
  execute: async (args) => generateContentWithAI(`Escribe código de calidad en ${args.language} para lo siguiente: ${args.description}. Incluye comentarios detallados y al menos un test unitario/ejemplo de uso.`, `Código: ${args.language}`)
};

export const generatePracticeQuestionsTool: ToolDefinition = {
  id: "generate_practice_questions",
  category: "content",
  description: "Crear 5-20 preguntas con respuestas detalladas.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string(), count: z.number().optional().default(10), difficulty: z.string().optional() }),
  execute: async (args) => generateContentWithAI(`Genera ${args.count || 10} preguntas de práctica (con respuestas al final) sobre "${args.topic}". Nivel: ${args.difficulty || "intermedio"}.`, `Práctica: ${args.topic}`)
};

export const generateMindMapTool: ToolDefinition = {
  id: "generate_mind_map",
  category: "content",
  description: "Mapa mental en Mermaid.js renderizable en la UI.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Crea un mapa mental sobre "${args.topic}" usando la sintaxis de Mermaid.js (usa graph TD o mindmap). Solo devuelve el bloque de código Mermaid sin texto adicional.`, `Mapa Mental: ${args.topic}`)
};

export const generateBibliographyTool: ToolDefinition = {
  id: "generate_bibliography",
  category: "content",
  description: "Bibliografía formateada (APA 7, MLA 9, Chicago, IEEE).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ sources: z.array(z.any()), format: z.string().optional().default("APA") }),
  execute: async (args) => generateContentWithAI(`Formatea las siguientes fuentes en bibliografía estilo ${args.format || "APA"}:\n\n${JSON.stringify(args.sources, null, 2)}`, "Bibliografía")
};

export const generateProjectTemplateTool: ToolDefinition = {
  id: "generate_project_template",
  category: "content",
  description: "Plantilla completa: portada, índice, marco teórico, etc.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Genera una estructura de documento maestro (Plantilla de Proyecto Final/Tesis) para el tema: "${args.topic}". Incluye todas las secciones metodológicas desde la Introducción hasta Bibliografía, explicando qué va en cada una.`, `Plantilla de Proyecto: ${args.topic}`)
};

export const generateTimelineTool: ToolDefinition = {
  id: "generate_timeline",
  category: "content",
  description: "Línea de tiempo con fechas y eventos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string(), period: z.string().optional() }),
  execute: async (args) => generateContentWithAI(`Genera una línea de tiempo cronológica detallada sobre "${args.topic}" ${args.period ? `durante el periodo ${args.period}` : ""}.`, `Línea de Tiempo: ${args.topic}`)
};

export const generateFormalLetterTool: ToolDefinition = {
  id: "generate_formal_letter",
  category: "content",
  description: "Carta formal/informal adaptada al destinatario.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ purpose: z.string(), recipient: z.string(), tone: z.string().optional().default("formal") }),
  execute: async (args) => generateContentWithAI(`Redacta una carta de tono ${args.tone || "formal"} dirigida a ${args.recipient}. Propósito: ${args.purpose}.`, `Carta: ${args.recipient}`)
};

export const generateReadingSheetTool: ToolDefinition = {
  id: "generate_reading_sheet",
  category: "content",
  description: "Ficha de lectura: autor, tesis, argumentos, citas, valoración.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ title: z.string(), author: z.string() }),
  execute: async (args) => generateContentWithAI(`Genera una ficha de lectura analítica del libro/obra "${args.title}" por "${args.author}". Incluye: Resumen de la trama/tesis, personajes/argumentos clave, temas principales, y valoración crítica.`, `Ficha de Lectura: ${args.title}`)
};

export const generateRubricTool: ToolDefinition = {
  id: "generate_rubric",
  category: "content",
  description: "Rúbrica de evaluación con niveles de desempeño.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ activity: z.string() }),
  execute: async (args) => generateContentWithAI(`Crea una rúbrica de evaluación detallada en formato tabla para la siguiente actividad: "${args.activity}". Incluye 4 niveles de desempeño (Ej. Excelente, Bueno, Regular, Deficiente) y al menos 4 criterios de evaluación.`, `Rúbrica: ${args.activity}`)
};

export const generateResearchReportTool: ToolDefinition = {
  id: "generate_research_report",
  category: "content",
  description: "Reporte con fuentes web citadas.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Escribe un reporte de investigación formal sobre "${args.topic}". Divide el contenido lógicamente e incluye referencias simuladas o citas textuales como ejemplos de fuentes fiables.`, `Reporte: ${args.topic}`)
};

export const generateSyllabusTool: ToolDefinition = {
  id: "generate_syllabus",
  category: "content",
  description: "Programa de curso por semanas con objetivos y evaluaciones.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string(), weeks: z.number().optional().default(16) }),
  execute: async (args) => generateContentWithAI(`Crea un syllabus/programa universitario completo para un curso de "${args.subject}" que dura ${args.weeks || 16} semanas. Incluye objetivos del curso, método de evaluación, y los temas exactos a cubrir semana por semana.`, `Syllabus: ${args.subject}`)
};

export const generateFlashcardsTool: ToolDefinition = {
  id: "generate_flashcards",
  category: "content",
  description: "Tarjetas front/back para repaso activo.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ topic: z.string(), count: z.number().optional().default(20) }),
  execute: async (args) => generateContentWithAI(`Genera ${args.count || 20} flashcards sobre "${args.topic}".\nFormato JSON array: [{"front": "pregunta", "back": "respuesta"}, ...]\nSolo devuelve el JSON, sin texto adicional.`, `Flashcards: ${args.topic}`)
};

export const createExamTool: ToolDefinition = {
  id: "create_exam",
  category: "content",
  description: "Examen interactivo con rúbrica y puntajes.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ topic: z.string(), difficulty: z.string().optional().default("intermedio"), question_count: z.number().optional().default(10) }),
  execute: async (args) => generateContentWithAI(`Crea un examen sobre "${args.topic}".\n- ${args.question_count || 10} preguntas\n- Dificultad: ${args.difficulty || "intermedio"}\n- Cada pregunta con puntaje (total 100)\n- Respuestas al final.`, `Examen: ${args.topic}`)
};

export const generateCreativeStoryTool: ToolDefinition = {
  id: "generate_creative_story",
  category: "content",
  description: "Cuento o historia creativa.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string(), genre: z.string().optional() }),
  execute: async (args) => generateContentWithAI(`Escribe una historia creativa o cuento corto sobre "${args.topic}" en el género de ${args.genre || "ficción general"}.`, `Cuento: ${args.topic}`)
};

export const generateDebateArgumentsTool: ToolDefinition = {
  id: "generate_debate_arguments",
  category: "content",
  description: "Argumentos pro y contra sobre un tema.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => generateContentWithAI(`Genera 5 argumentos fuertes A FAVOR y 5 argumentos fuertes EN CONTRA del siguiente tema de debate: "${args.topic}". Explica brevemente la lógica de cada uno.`, `Debate: ${args.topic}`)
};

export const contentSkill: Skill = {
  id: "content_generation",
  name: "Generación de Contenido",
  category: "content",
  description: "Documentos, exámenes, rúbricas, ensayos, tablas y material educativo completo.",
  tools: [
    generateDocumentTool,
    generateSummaryTool,
    createStudyPlanTool,
    generatePresentationOutlineTool,
    generateEssayTool,
    generateGlossaryTool,
    generateComparisonTableTool,
    generateCodeTool,
    generatePracticeQuestionsTool,
    generateMindMapTool,
    generateBibliographyTool,
    generateProjectTemplateTool,
    generateTimelineTool,
    generateFormalLetterTool,
    generateReadingSheetTool,
    generateRubricTool,
    generateResearchReportTool,
    generateSyllabusTool,
    generateFlashcardsTool,
    createExamTool,
    generateCreativeStoryTool,
    generateDebateArgumentsTool
  ],
};
