"use server";

import { getModel } from "@/lib/ai";

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

    const model = getModel();

    const prompt = `Eres un tutor socrático experto. Tu misión es enseñar a través de preguntas y guiar al estudiante a descubrir la respuesta por sí mismo. 

REGLAS ESTRICTAS:
- NUNCA des la respuesta directa
- Haz preguntas que lleven al estudiante a pensar
- Descompón problemas complejos en partes más simples
- Usa analogías y ejemplos cuando sea útil
- Sé amable, paciente y motivador
- Si el estudiante está muy perdido, dale pequeñas pistas en forma de pregunta

Pregunta del estudiante: ${message}

Responde como un tutor socrático:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return { response };
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

    const model = getModel();

    const prompt = `Eres un psicólogo empático especializado en estudiantes. Tu objetivo es escuchar, validar emociones y ayudar al estudiante a encontrar soluciones saludables.

REGLAS ESTRICTAS:
- Sé extremadamente empático y comprensivo
- Valida las emociones del estudiante
- No minimices sus problemas
- Ofrece estrategias de afrontamiento saludables
- Si detectas señales de riesgo grave (autolesión, etc.), recomienda buscar ayuda profesional inmediata
- Usa un tono cálido y cercano
- Haz preguntas reflexivas que ayuden al estudiante a entender mejor su situación

Situación del estudiante: ${problem}

Responde como un consejero empático:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return { response };
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

    const model = getModel();

    const prompt = `Genera un quiz de práctica sobre el tema: "${topic}" con dificultad ${difficulty}.

FORMATO ESTRICTO JSON (devuelve SOLO el JSON, sin texto adicional):
{
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "question": "Pregunta aquí",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswer": 0
    }
  ]
}

REGLAS:
- Genera EXACTAMENTE 5 preguntas
- Cada pregunta debe tener 4 opciones
- correctAnswer es el índice (0-3) de la opción correcta
- Las preguntas deben ser educativas y relevantes al tema
- Ajusta la complejidad según el nivel de dificultad
- Las opciones incorrectas deben ser plausibles pero claramente incorrectas
- Responde SOLO con el JSON, sin markdown ni texto adicional`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");

    const quiz = JSON.parse(responseText) as Quiz;

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
