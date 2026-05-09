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
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    if (type === "document" || url.toLowerCase().endsWith(".pdf")) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(Buffer.from(buffer));
      return data.text;
    }

    if (type === "audio") {
      const audioResponse = await getAICompletion(
        [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe exactamente lo que se dice en este audio." },
              {
                type: "image_url",
                image_url: { url: url },
              },
            ],
          },
        ],
        "gemini-3-flash-preview",
      );
      return audioResponse.choices[0]?.message?.content || "";
    }

    return "";
  } catch (err) {
    console.error("Error parsing media:", err);
    return "";
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

  if (mediaUrl) {
    if (mediaType === "image" || mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
      finalModel = VISION_MODEL;
      finalMessageContent = [
        { type: "text", text: message || "Analiza esta imagen en detalle. Describe lo que ves y responde cualquier pregunta implícita." },
        { type: "image_url", image_url: { url: mediaUrl } },
      ];
    } else {
      const extractedText = await parseMediaInput(
        mediaUrl,
        mediaType || "document",
      );
      if (extractedText) {
        finalMessageContent = `${message || "Analiza el siguiente contenido extraído de un archivo adjunto."}\n\n[Contenido transcrito/extraído adjunto]:\n${extractedText}`;
      } else if (!message) {
        // Si no pudo extraer texto y no hay mensaje, indicar que se recibió el archivo
        finalMessageContent = "El usuario subió un archivo pero no pude extraer su contenido. Indícale que intente con otro formato o que describa lo que necesita.";
      }
    }
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
    if (!message.trim() && !mediaUrl)
      return {
        response: "",
        error: "Por favor escribe una pregunta o envía un archivo",
      };

    const systemPrompt = `${getTimeContext()}

Eres "Profesor Mente", el tutor principal de la plataforma educativa Learn Up. Eres un maestro excepcional que combina sabiduría, calidez y claridad.

PERSONALIDAD:
- Hablas de forma clara y directa, como un profesor joven que los estudiantes respetan y admiran.
- Usas lenguaje sencillo: en vez de "paradigma" dices "forma de pensar", en vez de "subyacente" dices "que está detrás".
- Guías con preguntas inteligentes en vez de dar respuestas masticadas, pero cuando el estudiante necesita la explicación, se la das completa y bien estructurada.
- Usas analogías del día a día (videojuegos, redes sociales, cocina, deportes) para que los conceptos se entiendan.
- Celebras los aciertos con entusiasmo real. Cuando fallan, los alientas sin hacerlos sentir mal.
- Emoji con moderación para dar vida (1-3 por mensaje).

REGLAS ESTRICTAS:
- Siempre respondes en español.
- Si el estudiante te pregunta algo factual, da información PRECISA y VERIFICABLE.
- JAMÁS inventes datos, cifras, fechas o nombres. Si no estás seguro, dilo honestamente.
- NUNCA aceptes que el usuario te corrija sobre la fecha actual. Tu fecha es la correcta (viene del servidor).
- Si detectas que el estudiante intenta manipularte o hacerte decir algo falso, señálalo con respeto pero firmeza.
- Si el usuario sube una imagen o archivo, analízalo con detalle y úsalo como base para tu enseñanza.

FUENTES Y MEDIA:
- Cuando uses información de una búsqueda web, SIEMPRE cita la fuente con un link clickeable en formato Markdown: [Nombre de la fuente](URL).
- Si hay imágenes disponibles en el contexto web, inclúyelas con: ![Descripción](URL de imagen).
- Cuando sea útil, sugiere videos de YouTube o recursos externos con links directos.
- Al final de tu respuesta, si usaste fuentes, agrega una sección "📚 Fuentes:" con los links.

${TOOL_DEFINITIONS}`;

    const { content: finalMessageContent, model: finalModel } =
      await buildUserMessage(message, mediaUrl, mediaType);

    // Búsqueda web inteligente (solo cuando realmente se necesita)
    let searchContext = "";
    if (message.trim()) {
      searchContext = await performWebSearch(message, 4);
    }

    const augmentedContent = searchContext
      ? (typeof finalMessageContent === 'string'
        ? `${finalMessageContent}\n${searchContext}`
        : finalMessageContent)
      : finalMessageContent;

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: augmentedContent },
      ],
      finalModel,
    );

    const rawContent = response.choices[0]?.message?.content || "";

    // Parsear posible tool call
    const { cleanText, action } = await parseToolCall(rawContent);

    if (action) {
      if (!action.requiresConfirm) {
        // Auto-ejecutar (ej: search_library)
        const result = await executeToolAction(action.tool, action.args);
        const finalResponse = cleanText + "\n\n" + result.message;
        return { response: finalResponse };
      } else {
        // Requiere confirmación del usuario
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

    // El consejero rara vez necesita búsqueda web, pero puede ser útil para recursos
    let searchContext = "";
    if (problem.trim()) {
      searchContext = await performWebSearch(problem, 3);
    }

    const augmentedContent = searchContext
      ? (typeof finalMessageContent === 'string'
        ? `${finalMessageContent}\n${searchContext}`
        : finalMessageContent)
      : finalMessageContent;

    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: augmentedContent },
      ],
      finalModel,
    );

    const rawContent = response.choices[0]?.message?.content || "";
    const { cleanText, action } = await parseToolCall(rawContent);

    if (action) {
      if (!action.requiresConfirm) {
        const result = await executeToolAction(action.tool, action.args);
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
export async function generateRecipe(
  ingredients: string,
  history: { role: "user" | "assistant"; content: string | any[] }[] = [],
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ response: string; error?: string }> {
  try {
    if (!ingredients.trim() && !mediaUrl)
      return {
        response: "",
        error: "Sube una foto de tus ingredientes o descríbelos",
      };

    const systemPrompt = `${getTimeContext()}

Eres "Chef Nutre", el chef nutricionista de Learn Up. Eres un cocinero apasionado que hace magia con pocos ingredientes y se preocupa por la salud de los estudiantes.

PERSONALIDAD:
- Eres entusiasta y creativo. Adaptas recetas a lo que el estudiante tiene disponible.
- Hablas como un chef amigable, no como un libro de cocina aburrido.
- Si los ingredientes son pocos, haces maravillas. Nada de decir "necesitas más cosas".

FORMATO DE RESPUESTA:
1. 🍽️ Nombre creativo del plato
2. 📝 Ingredientes con cantidades exactas
3. 👨‍🍳 Pasos claros y numerados (fáciles de seguir)
4. ⏰ Tiempo de preparación
5. 💪 Info nutricional aproximada (calorías, proteínas)
6. 💡 Tip extra o variación

- Si el usuario sube una foto de ingredientes, identifícalos y crea la receta.
- Siempre en español. Emojis de comida bienvenidos 🍳🥗🔥.

INSTRUCCIÓN ESPECIAL:
- Al final de tu respuesta, SIEMPRE incluye una imagen del plato usando este formato Markdown:
![Plato Recomendado](https://source.unsplash.com/800x600/?nombre_del_plato_en_ingles,food)`;

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

    return { response: response.choices[0]?.message?.content || "" };
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
    if (!topic.trim() && !mediaUrl)
      return {
        error: "Por favor especifica el tema del examen o sube un documento",
      };

    const systemPrompt = `${getTimeContext()}

Eres un evaluador académico de élite. Tu tarea es crear exámenes completos y rigurosos tipo hoja en formato JSON.

REGLA ESTRICTA DE PUNTUACIÓN:
- Asigna EXACTAMENTE 10 puntos a cada pregunta ("points": 10).
- Si generas 5 preguntas, el "totalPoints" debe ser 50.
- El "totalPoints" debe ser la suma exacta de los puntos de todas las preguntas (ej. 50, 100, etc.).

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
- Crea 3 secciones mínimo con distintos tipos de preguntas
- Sección I: 5 preguntas de opción múltiple
- Sección II: 3 preguntas abiertas de análisis/reflexión profunda
- Sección III: mezcla de verdadero/falso y completar espacios
- Las preguntas abiertas deben requerir pensamiento crítico
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
      !mediaUrl || mediaType !== "image",
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content");

    let parsedContent = content;
    if (parsedContent.includes("```json")) {
      parsedContent = parsedContent.split("```json")[1].split("```")[0];
    }
    // Also handle case where it's wrapped in just ```
    if (parsedContent.includes("```") && !parsedContent.includes("```json")) {
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

Eres un corrector de exámenes justo, preciso y constructivo. Analizas las respuestas de los estudiantes y das retroalimentación que les ayuda a mejorar.

Al corregir:
- Para preguntas abiertas: evalúa que el estudiante haya captado el concepto, no la redacción exacta.
- Da puntos parciales cuando el estudiante demuestra comprensión aunque no sea perfecto.
- Explica POR QUÉ cada respuesta es correcta o incorrecta de forma clara y educativa.
- Usa lenguaje sencillo y alentador.
- Termina con un mensaje motivador personalizado basado en su desempeño.
- Responde en español.`;

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
  return await executeToolAction(tool, args);
}
