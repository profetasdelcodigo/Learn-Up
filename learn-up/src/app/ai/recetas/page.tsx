"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import AIChatComponent from "@/components/AIChatComponent";
import RecipeSidebar from "@/components/RecipeSidebar";
import { generateRecipe } from "@/actions/ai-tutor";

export default function RecipesChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  return (
    <NotebookLayout
      centerPanel={
        <AIChatComponent
          title="Chef Nutre"
          subtitle="Recetas saludables con lo que tienes"
          icon={<Utensils className="w-5 h-5 text-orange-400" />}
          aiType="nutricion"
          onSubmitAction={generateRecipe}
          onMessagesChange={setMessages}
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="openrouter/deepseek/deepseek-coder"
        />
      }
      rightPanel={<RecipeSidebar messages={messages} />}
    />
  );
}
