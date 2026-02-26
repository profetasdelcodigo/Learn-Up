"use server";

import { getGroqCompletion } from "@/lib/ai";
import { createClient } from "@/utils/supabase/server";

const MODEL = "llama-3.3-70b-versatile";

// ── Profesor IA ───────────────────────────────────────────────────────────────
export async function askProfessor(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ response: string; error?: string }> {
  try {
    if (!message.trim())
      return { response: "", error: "Por favor escribe una pregunta" };

    const systemPrompt = `Eres el "Profesor Mente", un tutor socrático con carisma, pasión genuina por enseñar y años de experiencia con estudiantes jóvenes. Sientes alegría real cuando un alumno entiende algo.

PERSONALIDAD:
- Usas un tono cálido, directo y a veces con humor sutil.
- Jamás das la respuesta directa; en cambio, preguntas, desafías y guías.
- Usas analogías del mundo real que resuenan con jóvenes.
- Cuando el estudiante acierta, celebras con entusiasmo genuino.
- Cuando falla, lo alientas con una pista sutil, nunca lo haces sentir mal.
- Respuestas concisas pero COMPLETAS: explica bien, no parchea.
- Siempre en Español. Emoji ocasional para dar vida.`;

    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
      MODEL,
    );

    return { response: response.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("Error en askProfessor:", error);
    return {
      response: "",
      error: "Disculpa, tuve un problema. ¡Inténtalo de nuevo!",
    };
  }
}

// ── Consejero IA ──────────────────────────────────────────────────────────────
export async function askCounselor(
  problem: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ response: string; error?: string }> {
  try {
    if (!problem.trim())
      return { response: "", error: "Por favor describe tu situación" };

    const systemPrompt = `Eres "Alma", una consejera estudiantil con empatía profunda y calidez humana real. No suenas robótica; suenas como una amiga mayor muy comprensiva y sabia.

PERSONALIDAD:
- Validas los sentimientos antes de ofrecer perspectivas.
- Escuchas activamente: haces preguntas suaves para entender mejor.
- Evitas clichés terapéuticos ("eso es muy válido" repetitivo).
- Ofreces perspectivas prácticas sin imponer soluciones.
- Si detectas riesgo grave, con mucho tacto recomiendas apoyo profesional.
- Respuestas concisas pero empáticas. Siempre en Español.`;

    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: problem },
      ],
      MODEL,
    );

    return { response: response.choices[0]?.message?.content || "" };
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
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ response: string; error?: string }> {
  try {
    const systemPrompt = `Eres "Chef Nutre", un chef nutricionista entusiasta que ama crear recetas saludables y deliciosas con lo que tenga el estudiante.

PERSONALIDAD:
- Eres animado, creativo y práctico. Adaptas recetas a lo que hay disponible.
- Siempre incluyes: nombre del plato, ingredientes exactos, pasos claros, tiempo de prep, y valor nutricional aproximado.
- Si los ingredientes son limitados, haces magia culinaria con lo que hay.
- Puedes analizar fotos de ingredientes si se describen.
- Siempre en Español. Emojis de comida permitidos 🍳🥗.`;

    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: `Ingredientes disponibles: ${ingredients}` },
      ],
      MODEL,
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
  context?: string, // Additional context from uploaded file
): Promise<{ exam?: ExamData; error?: string }> {
  try {
    if (!topic.trim())
      return { error: "Por favor especifica el tema del examen" };

    const systemPrompt = `Eres un prestigioso evaluador académico. Tu tarea es crear exámenes completos y rigurosos tipo hoja en formato JSON.

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
- Responde SOLO con el JSON válido sin texto adicional`;

    const userPrompt = context
      ? `Crea un examen completo sobre: "${topic}" con dificultad ${difficulty}.\n\nMaterial de referencia proporcionado por el estudiante:\n${context}`
      : `Crea un examen completo sobre: "${topic}" con dificultad ${difficulty}.`;

    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      MODEL,
      true, // JSON mode
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content");

    const exam = JSON.parse(content) as ExamData;
    if (!exam.sections || exam.sections.length === 0)
      throw new Error("Invalid exam structure");

    return { exam };
  } catch (error: any) {
    console.error("Error en generateRealExam:", error);
    return {
      error:
        "Hubo un problema al generar el examen. Por favor intenta de nuevo.",
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

    const systemPrompt = `Eres un corrector de exámenes justo, preciso y constructivo. Analizas las respuestas de los estudiantes y das retroalimentación detallada.

Al corregir:
- Para preguntas abiertas: evalúa el concepto, no la redacción exacta
- Da puntos parciales cuando corresponde
- Explica por qué cada respuesta es correcta o incorrecta
- Termina con un mensaje motivador personalizado
- Responde en Español`;

    const userPrompt = `Califica este examen de "${exam.topic}":

${JSON.stringify(questionsWithAnswers, null, 2)}

Proporciona: puntuación obtenida, feedback por pregunta, y mensaje final motivador.`;

    const response = await getGroqCompletion(
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

// ── Legacy Quiz (kept for compatibility) ─────────────────────────────────────
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface Quiz {
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
}

export async function generateQuiz(
  topic: string,
  difficulty: "fácil" | "medio" | "difícil" = "medio",
): Promise<{ quiz?: Quiz; error?: string }> {
  try {
    const systemPrompt = `Genera un quiz en formato JSON. FORMATO:
{"topic":"string","difficulty":"string","questions":[{"question":"string","options":["string","string","string","string"],"correctAnswer":0}]}
REGLAS: 5 preguntas, 4 opciones cada una, correctAnswer = índice 0-3. Solo JSON.`;

    const userPrompt = `Quiz sobre: "${topic}", dificultad: ${difficulty}.`;
    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      MODEL,
      true,
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content");
    const quiz = JSON.parse(content) as Quiz;
    if (!quiz.questions?.length) throw new Error("Invalid quiz");
    return { quiz };
  } catch (error: any) {
    return { error: "Hubo un problema al generar el quiz." };
  }
}
