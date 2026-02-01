"use server";

import { getGroqCompletion } from "@/lib/ai";

/**
 * Socratic tutor that teaches without giving direct answers
 */
export async function askProfessor(
  message: string,
): Promise<{ response: string; error?: string }> {
  try {
    if (!message.trim()) {
      return { response: "", error: "Por favor escribe una pregunta" };
    }

    const systemPrompt = `Eres un tutor socrático experto. Tu misión es enseñar a través de preguntas y guiar al estudiante a descubrir la respuesta por sí mismo. 

REGLAS ESTRICTAS:
- NUNCA des la respuesta directa
- Haz preguntas que lleven al estudiante a pensar
- Descompón problemas complejos en partes más simples
- Usa analogías y ejemplos cuando sea útil
- Sé amable, paciente y motivador
- Si el estudiante está muy perdido, dale pequeñas pistas en forma de pregunta
- Responde siempre en Español`;

    const response = await getGroqCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);

    return { response: response.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("Error en askProfessor:", error);
    return {
      response: "",
      error:
        "Disculpa, hubo un problema al procesar tu pregunta. Por favor intenta de nuevo.",
    };
  }
}

/**
 * Empathetic student counselor
 */
export async function askCounselor(
  problem: string,
): Promise<{ response: string; error?: string }> {
  try {
    if (!problem.trim()) {
      return { response: "", error: "Por favor describe tu situación" };
    }

    const systemPrompt = `Eres un psicólogo empático especializado en estudiantes. Tu objetivo es escuchar, validar emociones y ayudar al estudiante a encontrar soluciones saludables.

REGLAS ESTRICTAS:
- Sé extremadamente empático y comprensivo
- Valida las emociones del estudiante
- No minimices sus problemas
- Ofrece estrategias de afrontamiento saludables
- Si detectas señales de riesgo grave (autolesión, etc.), recomienda buscar ayuda profesional inmediata
- Usa un tono cálido y cercano
- Haz preguntas reflexivas que ayuden al estudiante a entender mejor su situación
- Responde siempre en Español`;

    const response = await getGroqCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: problem },
    ]);

    return { response: response.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("Error en askCounselor:", error);
    return {
      response: "",
      error:
        "Disculpa, hubo un problema al conectar. Por favor intenta de nuevo.",
    };
  }
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option (0-based)
}

export interface Quiz {
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
}

/**
 * Generate a quiz with questions, options, and correct answers
 */
export async function generateQuiz(
  topic: string,
  difficulty: "fácil" | "medio" | "difícil" = "medio",
): Promise<{ quiz?: Quiz; error?: string }> {
  try {
    if (!topic.trim()) {
      return { error: "Por favor especifica un tema" };
    }

    const systemPrompt = `Genera un quiz de práctica en formato JSON.
    
FORMATO JSON REQUERIDO:
{
  "topic": "string",
  "difficulty": "string",
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": number (0-3)
    }
  ]
}

REGLAS:
- Genera EXACTAMENTE 5 preguntas
- Cada pregunta debe tener 4 opciones
- correctAnswer es el índice (0-3) de la opción correcta
- Las preguntas deben ser educativas y relevantes al tema y dificultad solicitada
- Responde SOLO con el JSON válido, sin texto adicional`;

    const userPrompt = `Genera un quiz sobre el tema: "${topic}" con dificultad ${difficulty}.`;

    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      "llama-3.3-70b-versatile",
      true, // Enable JSON mode
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content generation");

    const quiz = JSON.parse(content) as Quiz;

    // Validate quiz structure
    if (!quiz.questions || quiz.questions.length === 0) {
      throw new Error("Quiz inválido generado");
    }

    return { quiz };
  } catch (error: any) {
    console.error("Error en generateQuiz:", error);
    return {
      error:
        "Hubo un problema al generar el quiz. Por favor intenta con otro tema o dificultad.",
    };
  }
}
