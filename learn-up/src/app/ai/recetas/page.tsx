"use client";

import { Utensils } from "lucide-react";
import AIChatComponent from "@/components/AIChatComponent";
import { generateRecipe } from "@/actions/ai-tutor";
import RecipeSidebar from "@/components/RecipeSidebar";
import { useState } from "react";

export default function RecipesChatPage() {
  const [messages, setMessages] = useState<any[]>([]);

  return (
    <AIChatComponent
      title="Chef Nutre"
      subtitle="Recetas saludables con lo que tienes"
      icon={<Utensils className="w-5 h-5 text-orange-400" />}
      aiType="nutricion"
      onSubmitAction={generateRecipe}
      onMessagesChange={setMessages}
      rightPanel={<RecipeSidebar messages={messages} />}
    />
  );
}
