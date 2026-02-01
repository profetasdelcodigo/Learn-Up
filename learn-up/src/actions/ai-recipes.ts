"use server";

import { getModel } from "@/lib/ai";

export interface Recipe {
  title: string;
  ingredients: string[];
  steps: string[];
  description?: string;
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

    const model = getModel();

    const prompt = `Genera una receta deliciosa y saludable para: "${mealType}".

FORMATO ESTRICTO JSON (devuelve SOLO el JSON, sin texto adicional):
{
  "title": "Nombre de la receta",
  "description": "Breve descripción atractiva",
  "ingredients": [
    "Ingrediente 1 con cantidad",
    "Ingrediente 2 con cantidad"
  ],
  "steps": [
    "Paso 1 detallado",
    "Paso 2 detallado"
  ]
}

REGLAS:
- La receta debe ser práctica y achievable
- Incluye cantidades específicas en los ingredientes
- Los pasos deben ser claros y fáciles de seguir
- La receta debe ser saludable y balanceada
- Considera opciones culturalmente apropiadas para Latinoamérica
- Responde SOLO con el JSON, sin markdown ni texto adicional`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");

    const recipe = JSON.parse(responseText) as Recipe;

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
