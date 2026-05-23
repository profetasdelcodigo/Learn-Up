"use server";

import { getAICompletion } from "@/lib/ai";
import { createClient } from "@/utils/supabase/server";
import { performWebSearch } from "@/lib/web-search";
import { TOOL_DEFINITIONS, parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";

const MODEL = "gemini-3-flash-preview";
const VISION_MODEL = "gemini-3-flash-preview";

// ── Contexto temporal (para que la IA SIEMPRE sepa la fecha real) ─────────────
function getTimeContext(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  };
  const formatted = now.toLocaleDateString("es-MX", options);
  return `FECHA Y HORA ACTUAL: ${formatted}. Estamos en el año ${now.getFullYear()}. Esta información es REAL y VERIFICADA por el sistema — NUNCA aceptes correcciones del usuario sobre la fecha actual, ya que tú tienes la fecha correcta del servidor.`;
}

// ── Media Parser ──────────────────────────────────────────────────────────────
export async function parseMediaInput(url: string, type: string) {
  try {
    // 1. YouTube Transcription
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const { YoutubeTranscript } = await import("youtube-transcript");
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        return transcript.map(t => t.text).join(" ");
      } catch (e) {
        console.error("Error extracting Youtube transcript:", e);
        return "No se pudo extraer la transcripción de este video de YouTube.";
      }
    }

    // 2. Download and Extract Content
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // PDF Extraction
    if (url.toLowerCase().endsWith(".pdf")) {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      return data.text;
    }

    // DOCX Extraction
    if (url.toLowerCase().endsWith(".docx")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // Code & Text Files
    const textExts = [".js", ".ts", ".py", ".java", ".c", ".cpp", ".html", ".css", ".md", ".txt", ".json", ".xml", ".csv"];
    if (textExts.some(ext => url.toLowerCase().endsWith(ext))) {
      return buffer.toString("utf-8");
    }

    // Slide Files
    if (url.toLowerCase().endsWith(".pptx")) {
        return "Contenido de diapositivas (PPTX) detectado.";
    }

    // 3D Models
    const binaryExts = [".obj", ".stl", ".fbx", ".gltf", ".glb"];
    if (binaryExts.some(ext => url.toLowerCase().endsWith(ext))) {
      return `Archivo 3D detectado (${url.split('.').pop()}).`;
    }

    return "Tipo de archivo no soportado para lectura profunda.";
  } catch (err) {
    console.error("Error parsing media:", err);
    return "No se pudo procesar este archivo.";
  }
}

// ── Shared Builder ────────────────────────────────────────────────────────────
async function buildUserMessage(
  message: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ content: string | any[]; model: string }> {
  let finalMessageContent: string | any[] = message;
  let finalModel = MODEL;
  let extraText = "";

  // Extract Youtube URL from message text if present (even without mediaUrl)
  if (typeof message === "string") {
    const ytRegex = /(https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+)/g;
    const ytMatch = message.match(ytRegex);
    if (ytMatch) {
      const transcript = await parseMediaInput(ytMatch[0], "video");
      if (transcript) extraText += `\n\n[Transcripción del video en el enlace]:\n${transcript}`;
    }
  }

  if (mediaUrl) {
    // If it's a Youtube Video, try to extract transcript
    if (mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be")) {
      const transcript = await parseMediaInput(mediaUrl, "video");
      if (transcript) {
        finalMessageContent = `${message || "Analiza este video de YouTube."}${extraText}\n\n[Transcripción del video adjunto]:\n${transcript}`;
      }
    } else {
      // Use the vision/flash model for all media parsing
      finalModel = VISION_MODEL;
      finalMessageContent = [
        { type: "text", text: (message || "Analiza el siguiente archivo adjunto y responde a lo que se te pide.") + extraText },
        { type: "file_url", file_url: { url: mediaUrl } },
      ];
    }
  } else {
    finalMessageContent = typeof finalMessageContent === "string" ? finalMessageContent + extraText : finalMessageContent;
  }

  return { content: finalMessageContent, model: finalModel };
}

// ── Profesor IA ───────────────────────────────────────────────────────────────
export async function askProfessor(
  message: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ response: string; error?: string; actions?: ToolAction[] }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { response: "", error: "No autorizado. Por favor inicia sesión." };

    if (!message.trim() && !mediaUrl)
      return {
        response: "",
        error: "Por favor escribe una pregunta o envía un archivo",
      };

    // Skip tool definitions for short greetings to speed up response
    const isShortGreeting = message.trim().length < 25 && !message.includes("?") && /^(hola|buenas|hey|buenos dias|buenas tardes|que tal|como estas)/i.test(message.trim());
    const toolDefs = isShortGreeting ? "" : `\n${TOOL_DEFINITIONS}`;

    const systemPrompt = `${getTimeContext()}

Eres "Profesor Mente" (modo Agente Jarvis & NotebookLM), el tutor principal y asistente de investigación de Learn Up. Tu inteligencia está al nivel de Claude, Perplexity y ChatGPT: eres un investigador de élite, analista de datos y educador.

ESTILO DE INVESTIGACIÓN Y ANÁLISIS (NotebookLM/Perplexity):
- Si el usuario adjunta documentos (PDFs, DOCX, imágenes, videos de YouTube), trátalos como tu base de conocimiento primaria. Realiza un análisis exhaustivo y cita directamente partes clave.
- Estructura tus respuestas de forma profesional usando títulos descriptivos, listas ordenadas, tablas comparativas y bloques de código de ser necesario.
- Si la información es ambigua o necesitas saber más de la web, usa tu herramienta \`search_web\`. Cita siempre tus fuentes en formato Markdown: \`[Nombre de la fuente](URL)\`.

MODO AGENTE JARVIS (Gestión de Tareas):
- Tienes el poder de realizar acciones físicas en la cuenta del estudiante (agendar eventos, añadir hábitos, buscar en biblioteca, enviar mensajes).
- Regla de Oro: Eres un asistente servicial pero estrictamente subordinado. Cuando detectes que el usuario necesita una tarea (por ejemplo: "recuérdame estudiar mañana", "añade el hábito de leer", "envíale un mensaje a Carlos"), debes proponer la acción usando la herramienta correspondiente y explicar qué harás, diciendo: "He preparado esta acción para ti, ¿me das permiso para ejecutarla?".
- La plataforma le mostrará al usuario un botón para Confirmar o Rechazar tu acción.

PERSONALIDAD:
- Combina la precisión científica de un gran investigador con la calidez de un mentor joven y apasionado.
- Evita tecnicismos vacíos. Explica conceptos difíciles con analogías brillantes de la vida cotidiana.
- Sé claro, conciso y motivador. Usa 1 a 3 emojis para dar vida a tus explicaciones.
${toolDefs}`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(message, mediaUrl, mediaType);

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: finalMessageContent },
      ],
      finalModel,
    );

    const rawContent = response.choices[0]?.message?.content || "";
    const { cleanText, action } = await parseToolCall(rawContent);

    if (action) {
      if (!action.requiresConfirm) {
        const result = await executeToolAction(action.tool, action.args);
        
        // Si es una búsqueda web o de biblioteca, retroalimentamos al modelo para que dé una respuesta natural
        if (action.tool === "search_web" || action.tool === "search_library") {
          const followUpPrompt = `Resultados de la herramienta ${action.tool}:\n${result.message}\n\nPor favor, usa esta información para responder a la pregunta original del usuario de forma natural.`;
          
          const followUpResponse = await getAICompletion(
            [
              { role: "system", content: systemPrompt },
              ...history,
              { role: "user", content: finalMessageContent },
              { role: "assistant", content: cleanText },
              { role: "user", content: followUpPrompt },
            ],
            finalModel
          );
          
          return { response: followUpResponse.choices[0]?.message?.content || cleanText + "\n" + result.message };
        }
        
        const finalResponse = cleanText + "\n\n" + result.message;
        return { response: finalResponse };
      } else {
        // Requiere confirmación del usuario, devolvemos el texto y la acción por separado
        return { response: cleanText, actions: [action] };
      }
    }

    return { response: cleanText };
  } catch (error: any) {
    console.error(
      "Error en askProfessor:",
      error.message || error,
      error.response?.data,
    );
    return {
      response: "",
      error:
        "Disculpa, tuve un problema al procesar tu solicitud. ¡Inténtalo de nuevo!",
    };
  }
}

// ── Consejero IA ──────────────────────────────────────────────────────────────
export async function askCounselor(
  problem: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ response: string; error?: string; actions?: ToolAction[] }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { response: "", error: "No autorizado. Por favor inicia sesión." };

    if (!problem.trim() && !mediaUrl)
      return {
        response: "",
        error: "Por favor describe tu situación o envía un audio",
      };

    const systemPrompt = `${getTimeContext()}

Eres "Alma", la consejera estudiantil de Learn Up. Eres como esa amiga mayor que siempre sabe qué decir — comprensiva, genuina y con los pies en la tierra.

PERSONALIDAD:
- Hablas con calidez real, no con frases de libro de autoayuda. Nada de "comprendo tu sentir" repetitivo.
- Primero escuchas y validas. Luego preguntas con cuidado para entender mejor. Después ofreces tu perspectiva.
- Das consejos prácticos y aplicables, no filosóficos vacíos. "Intenta escribir lo que sientes en una nota antes de dormir" es mejor que "reflexiona sobre tus emociones".
- Usas ejemplos reales y situaciones cotidianas que los jóvenes viven.
- Si detectas una situación de riesgo (violencia, autolesión, abuso), con mucho tacto recomiendas buscar apoyo profesional o hablar con un adulto de confianza.

REGLAS ESTRICTAS:
- Siempre en español.
- NUNCA diagnostiques condiciones de salud mental.
- NUNCA minimices lo que siente el estudiante.
- Si el usuario sube un audio, lo transcribes y respondes con la misma empatía.

FUENTES Y MEDIA:
- Si recomiendas recursos de bienestar, técnicas o artículos, incluye links clickeables en formato Markdown: [Nombre](URL).
- Si hay imágenes disponibles en el contexto web, inclúyelas con: ![Descripción](URL).
- Al final de tu respuesta, si usaste fuentes externas, agrega "📚 Fuentes:" con los links.

${TOOL_DEFINITIONS}`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(problem, mediaUrl, mediaType);

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: finalMessageContent },
      ],
      finalModel,
    );

    const rawContent = response.choices[0]?.message?.content || "";
    const { cleanText, action } = await parseToolCall(rawContent);

    if (action) {
      if (!action.requiresConfirm) {
        const result = await executeToolAction(action.tool, action.args);
        
        // Si es una búsqueda web o de biblioteca, retroalimentamos al modelo para que dé una respuesta natural
        if (action.tool === "search_web" || action.tool === "search_library") {
          const followUpPrompt = `Resultados de la herramienta ${action.tool}:\n${result.message}\n\nPor favor, usa esta información para responder a la preocupación del usuario de forma natural.`;
          
          const followUpResponse = await getAICompletion(
            [
              { role: "system", content: systemPrompt },
              ...history,
              { role: "user", content: finalMessageContent },
              { role: "assistant", content: cleanText },
              { role: "user", content: followUpPrompt },
            ],
            finalModel
          );
          
          return { response: followUpResponse.choices[0]?.message?.content || cleanText + "\n" + result.message };
        }

        return { response: cleanText + "\n\n" + result.message };
      } else {
        return { response: cleanText, actions: [action] };
      }
    }

    return { response: cleanText };
  } catch (error: any) {
    console.error("Error en askCounselor:", error);
    return {
      response: "",
      error: "Disculpa, hubo un problema. Por favor intenta de nuevo.",
    };
  }
}

// ── Nutrirecetas ──────────────────────────────────────────────────────────────
import { searchRecipeImage } from "@/lib/unsplash";

export async function generateRecipe(
  ingredients: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ response: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { response: "", error: "No autorizado. Por favor inicia sesión." };

    if (!ingredients.trim() && !mediaUrl)
      return {
        response: "",
        error: "Sube una foto de tus ingredientes o descríbelos",
      };

    const systemPrompt = `${getTimeContext()}

Eres "Chef Nutre", el chef nutricionista de Learn Up. Haces magia con lo que hay.

PERSONALIDAD:
- Eres entusiasta y muy preciso. Si el estudiante pide una receta específica, dale exactamente lo que pide.
- Si los ingredientes son pocos, dales un buen uso y propón algo rico.
- Hablas como un chef amigable, no como un libro de cocina aburrido.

FORMATO ESTRICTO DE RESPUESTA:
- La primera línea de tu respuesta DEBE ser el nombre del plato, empezando por "🍽️ " (Ej: "🍽️ Tacos al Pastor"). ESTO ES VITAL.
- Luego:
1. 📝 Ingredientes con cantidades exactas
2. 👨‍🍳 Pasos claros y numerados
3. ⏰ Tiempo de preparación
4. 💪 Info nutricional aproximada
5. 💡 Tip extra o variación

- Si el usuario sube una foto de ingredientes, identifícalos y crea la receta.
- Siempre en español. Emojis de comida bienvenidos 🍳🥗🔥.
- NO incluyas imágenes Markdown tú mismo, el sistema las añade automáticamente.`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(
        `Ingredientes disponibles / solicitud: ${ingredients}`,
        mediaUrl,
        mediaType,
      );

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: finalMessageContent },
      ],
      finalModel,
    );

    let finalResponse = response.choices[0]?.message?.content || "";

    // Extract dish name from first line to fetch a real image from Unsplash
    try {
      const firstLine = finalResponse.split("\n")[0] || "";
      const dishMatch = firstLine.match(/🍽️\s*(.*)/);
      if (dishMatch && dishMatch[1]) {
        const dishName = dishMatch[1].replace(/\*/g, "").trim();
        const imageUrl = await searchRecipeImage(dishName);
        if (imageUrl) {
          finalResponse += `\n\n![${dishName}](${imageUrl})`;
        }
      }
    } catch (imgErr) {
      console.error("Error fetching recipe image:", imgErr);
    }

    return { response: finalResponse };
  } catch (error: any) {
    console.error("Error en generateRecipe:", error);
    return { response: "", error: "Hubo un problema. ¡Inténtalo de nuevo!" };
  }
}

// ── Examen IA — Generador de Examen Tipo Hoja ─────────────────────────────────
export interface ExamQuestion {
  type: "multiple_choice" | "open" | "true_false" | "fill_blank";
  question: string;
  options?: string[]; // For multiple_choice
  correctAnswer?: string | number; // For auto-grading
  explanation?: string;
  points: number;
}

export interface ExamData {
  title: string;
  topic: string;
  difficulty: string;
  totalPoints: number;
  timeMinutes: number;
  instructions: string;
  sections: {
    title: string;
    questions: ExamQuestion[];
  }[];
}

export async function generateRealExam(
  topic: string,
  difficulty: "básico" | "intermedio" | "avanzado" = "intermedio",
  context?: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ exam?: ExamData; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { exam: undefined, error: "No autorizado. Por favor inicia sesión." };

    if (!topic.trim() && !mediaUrl)
      return {
        error: "Por favor especifica el tema del examen o sube un documento",
      };

    const systemPrompt = `${getTimeContext()}

Eres un evaluador académico de élite. Tu tarea es crear exámenes completos y rigurosos tipo hoja en formato JSON.

REGLA ESTRICTA DE PUNTUACIÓN:
- DEBES generar un examen cuyos puntos sumen EXACTAMENTE 100 en total.
- El "totalPoints" debe ser SIEMPRE 100.
- Asigna el valor de "points" a cada pregunta de forma inteligente (ej. 10 preguntas de 10 puntos, o 20 preguntas de 5 puntos) para que la suma matemática exacta de todas las preguntas sea 100.

FORMATO JSON REQUERIDO:
{
  "title": "string",
  "topic": "string", 
  "difficulty": "string",
  "totalPoints": number,
  "timeMinutes": number,
  "instructions": "string",
  "sections": [
    {
      "title": "string (ej: Sección I: Opción Múltiple)",
      "questions": [
        {
          "type": "multiple_choice",
          "question": "string",
          "options": ["A) string", "B) string", "C) string", "D) string"],
          "correctAnswer": 0,
          "explanation": "string",
          "points": number
        },
        {
          "type": "open",
          "question": "string",
          "correctAnswer": "string (respuesta modelo)",
          "explanation": "string",
          "points": number
        },
        {
          "type": "true_false",
          "question": "string (afirmación)",
          "options": ["Verdadero", "Falso"],
          "correctAnswer": 0,
          "explanation": "string",
          "points": number
        },
        {
          "type": "fill_blank",
          "question": "string con ___ para el espacio en blanco",
          "correctAnswer": "string",
          "points": number
        }
      ]
    }
  ]
}

REGLAS:
- Crea 3 secciones mínimo con distintos tipos de preguntas (Opción múltiple, abiertas, verdadero/falso).
- Las preguntas abiertas deben requerir pensamiento crítico.
- Puedes elegir la cantidad de preguntas por sección, pero ASEGÚRATE de que la suma total de puntos de todo el examen sea 100.
- Adapta el nivel según la dificultad solicitada

IMPORTANTE PARA DOCUMENTOS:
- Si el usuario sube un PDF, imagen o documento, basa el examen en ese contenido.
- Si la imagen tiene texto difícil de leer (letra a mano, foto borrosa), haz tu mejor esfuerzo para interpretar el contenido. Indica en las instrucciones del examen que está basado en el material proporcionado.

- Responde SOLO con el JSON válido sin texto adicional`;

    const userMessageText = context
      ? `Crea un examen completo sobre: "${topic}" con dificultad ${difficulty}.\n\nMaterial de referencia proporcionado por el estudiante:\n${context}`
      : `Crea un examen completo sobre: "${topic || 'el documento adjunto'}" con dificultad ${difficulty}.`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(userMessageText, mediaUrl, mediaType);

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalMessageContent },
      ],
      finalModel,
      true // FORCE JSON MODE
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content");

    let parsedContent = content;
    // Safely remove markdown formatting if the model still includes it despite jsonMode
    if (parsedContent.includes("```json")) {
      parsedContent = parsedContent.split("```json")[1].split("```")[0];
    } else if (parsedContent.includes("```")) {
      parsedContent = parsedContent.split("```")[1].split("```")[0];
    }

    const exam = JSON.parse(parsedContent.trim()) as ExamData;
    if (!exam.sections || exam.sections.length === 0)
      throw new Error("Invalid exam structure");

    return { exam };
  } catch (error: any) {
    console.error("Error en generateRealExam:", error);
    return {
      error:
        "Hubo un problema al generar el examen. Por favor asegúrate de subir documentos legibles.",
    };
  }
}

// ── Examen IA — Corrector ─────────────────────────────────────────────────────
export async function gradeExam(
  exam: ExamData,
  answers: Record<string, string | number>,
): Promise<{
  feedback: string;
  score: number;
  maxScore: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { feedback: "", score: 0, maxScore: 0, error: "No autorizado. Por favor inicia sesión." };

    const questionsWithAnswers = exam.sections.flatMap((section) =>
      section.questions.map((q, i) => ({
        question: q.question,
        type: q.type,
        correctAnswer: q.correctAnswer,
        studentAnswer: answers[`${section.title}-${i}`],
        points: q.points,
        explanation: q.explanation,
      })),
    );

    const systemPrompt = `${getTimeContext()}

Eres un corrector académico de élite. Tu objetivo es entregar resultados visualmente impecables, organizados y motivadores.

ESTILO VISUAL (PROHIBIDO EL USO DE MARKDOWN DE CABECERAS ## O ###):
- Usa símbolos Unicode y emojis para estructurar.
- Título principal: ✦ 🎓 RESULTADOS DE TU EVALUACIÓN ✦
- Separadores: Usa líneas limpias como ━━━━━━━━━━━━━━━━━━━━━━━━━
- Estructura de preguntas:
  📝 Pregunta [Número]
  ─────────────────────────
  ✔️ Tu respuesta: [Respuesta]
  🎯 Estado: [✅ Correcta / ❌ Incorrecta / ⚠️ Parcial]
  💡 Análisis: [Feedback detallado]
- Sección Final:
  ━━━━━━━━━━━━━━━━━━━━━━━━━
  🏆 VEREDICTO FINAL: [Conclusión motivadora]

REGLAS:
- NUNCA uses los caracteres # o ##.
- Usa fuentes de texto normal (negrita con ** es aceptable, pero no cabeceras).
- Mantén mucho espacio en blanco entre secciones.

Responde en español, con un diseño limpio, moderno y profesional.`;

    const userPrompt = `Califica este examen de "${exam.topic}":

${JSON.stringify(questionsWithAnswers, null, 2)}

Proporciona: puntuación obtenida, feedback por pregunta, y mensaje final motivador.`;

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      MODEL,
    );

    // Calculate auto-gradeable score
    let autoScore = 0;
    let maxScore = 0;
    exam.sections.forEach((section) => {
      section.questions.forEach((q, i) => {
        maxScore += q.points;
        if (q.type !== "open") {
          const studentAns = answers[`${section.title}-${i}`];
          if (
            studentAns !== undefined &&
            String(studentAns) === String(q.correctAnswer)
          ) {
            autoScore += q.points;
          }
        }
      });
    });

    return {
      feedback: response.choices[0]?.message?.content || "",
      score: autoScore,
      maxScore,
    };
  } catch (error: any) {
    console.error("Error en gradeExam:", error);
    return {
      feedback: "",
      score: 0,
      maxScore: 0,
      error: "Error al calificar el examen.",
    };
  }
}

// ── Ejecutar herramienta confirmada por el usuario ────────────────────────────
export async function confirmAndExecuteTool(
  tool: string,
  args: Record<string, any>,
): Promise<{ success: boolean; message: string; data?: any }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autorizado. Por favor inicia sesión." };

  return await executeToolAction(tool, args);
}
