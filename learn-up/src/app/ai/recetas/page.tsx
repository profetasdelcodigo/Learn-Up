"use client";

import { Utensils } from "lucide-react";
import AIChatComponent from "@/components/AIChatComponent";
import { generateRecipe } from "@/actions/ai-tutor";

export default function RecipesChatPage() {
  return (
    <AIChatComponent
      title="Chef Nutre"
      subtitle="Recetas saludables con lo que tienes"
      icon={<Utensils className="w-5 h-5 text-brand-gold" />}
      aiType="nutricion"
      onSubmitAction={generateRecipe}
    />
  );
}
