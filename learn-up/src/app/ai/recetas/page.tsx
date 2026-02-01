"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChefHat, Loader2, Utensils } from "lucide-react";
import { generateRecipe, Recipe } from "@/actions/ai-recipes";

export default function RecipesPage() {
  const [mealType, setMealType] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealType.trim() || loading) return;

    setLoading(true);
    setError("");
    setRecipe(null);

    try {
      const result = await generateRecipe(mealType.trim());

      if (result.error) {
        setError(result.error);
      } else if (result.recipe) {
        setRecipe(result.recipe);
      }
    } catch (err) {
      setError("Ocurrió un error inesperado. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewRecipe = () => {
    setRecipe(null);
    setMealType("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-orange-500/10 border border-orange-500">
            <ChefHat className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Nutrirecetas</h1>
          <p className="text-gray-400">
            Genera recetas saludables y deliciosas al instante
          </p>
        </div>

        {/* Recipe Generator Form */}
        {!recipe && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-black/80 backdrop-blur-xl border border-orange-500 rounded-3xl p-8"
          >
            <form onSubmit={handleGenerateRecipe} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ¿Qué tipo de comida quieres preparar?
                </label>
                <input
                  type="text"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  placeholder="Ej: Desayuno saludable, Almuerzo vegetariano, Cena ligera..."
                  disabled={loading}
                  className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
                  required
                />
              </div>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2">
                {[
                  "Desayuno energético",
                  "Almuerzo saludable",
                  "Cena ligera",
                  "Snack nutritivo",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setMealType(suggestion)}
                    className="px-4 py-2 text-sm bg-brand-black border border-gray-700 text-gray-400 rounded-full hover:border-orange-500 hover:text-orange-500 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !mealType.trim()}
                className="w-full py-4 bg-orange-500 text-white font-bold rounded-full hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando Receta...
                  </>
                ) : (
                  <>
                    <ChefHat className="w-5 h-5" />
                    Generar Receta
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Recipe Display */}
        {recipe && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-black/80 backdrop-blur-xl border border-orange-500 rounded-3xl p-8"
          >
            {/* Recipe Header */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-orange-500/10 border border-orange-500">
                <Utensils className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {recipe.title}
              </h2>
              {recipe.description && (
                <p className="text-gray-400">{recipe.description}</p>
              )}
            </div>

            {/* Ingredients */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-orange-500 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-500 text-sm">
                  1
                </span>
                Ingredientes
              </h3>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-gray-300"
                  >
                    <span className="text-orange-500 mt-1">•</span>
                    <span>{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-orange-500 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-500 text-sm">
                  2
                </span>
                Preparación
              </h3>
              <ol className="space-y-4">
                {recipe.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-orange-500 text-white font-bold text-sm">
                      {index + 1}
                    </span>
                    <span className="text-gray-300 pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleNewRecipe}
                className="flex-1 py-3 bg-orange-500 text-white font-semibold rounded-full hover:bg-orange-600 transition-all"
              >
                Nueva Receta
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-brand-black border border-orange-500 text-orange-500 font-semibold rounded-full hover:bg-orange-500/10 transition-all"
              >
                Imprimir
              </button>
            </div>
          </motion.div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            ← Volver al Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
