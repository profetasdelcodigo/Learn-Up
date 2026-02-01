"use server";

import { getGroqCompletion } from "@/lib/ai";

export interface Recipe {
  title: string;
  ingredients: string[];
  steps: string[];
  description?: string;
  imageQuery?: string; // For Unsplash search
}

/**
 * Generate a recipe based on meal type
 */
export async function generateRecipe(
  mealType: string,
): Promise<{ recipe?: Recipe; error?: string }> {
  try {
    if (!mealType.trim()) {
      return { error: "Por favor especifica un tipo de comida" };
    }

    const systemPrompt = `Genera una receta de cocina en formato JSON.

FORMATO JSON REQUERIDO:
{
  "title": "Nombre de la receta",
  "description": "Breve descripción atractiva",
  "ingredients": ["Ingrediente 1", "Ingrediente 2"],
  "steps": ["Paso 1", "Paso 2"],
  "imageQuery": "Término de búsqueda simple en inglés para encontrar una foto (ej: 'chicken salad')"
}

REGLAS:
- Receta saludable y práctica
- Cantidades específicas en ingredientes
- Pasos claros
- Culturalmente apropiada
- imageQuery debe ser en inglés para mejor resultados en Unsplash
- Responde SOLO con el JSON válido`;

    const userPrompt = `Genera una receta deliciosa y saludable para: "${mealType}".`;

    const response = await getGroqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      "llama-3.3-70b-versatile",
      true, // Enable JSON mode
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content generated");

    const recipe = JSON.parse(content) as Recipe;

    // Validate recipe structure
    if (!recipe.title || !recipe.ingredients || !recipe.steps) {
      throw new Error("Receta inválida generada");
    }

    return { recipe };
  } catch (error: any) {
    console.error("Error en generateRecipe:", error);
    return {
      error:
        "Hubo un problema al generar la receta. Por favor intenta de nuevo.",
    };
  }
}
