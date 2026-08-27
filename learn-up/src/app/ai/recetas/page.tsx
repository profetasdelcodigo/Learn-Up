"use client";

import { useState } from "react";
import { ChefHat } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import AIChatComponent from "@/components/AIChatComponent";
import RecipeSidebar from "@/components/RecipeSidebar";
import SourcesPanel from "@/components/ai/SourcesPanel";
import { generateRecipe } from "@/actions/ai-tutor";

export default function RecipesChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <NotebookLayout
      leftPanel={
        <SourcesPanel 
          aiType="recetas" 
          currentSessionId={sessionId} 
          onSessionChange={setSessionId} 
        />
      }
      centerPanel={
        <AIChatComponent
          title="Chef IA"
          subtitle="Tus Nutrirecetas saludables"
          icon={<ChefHat className="w-5 h-5 text-orange-400" />}
          aiType="recetas"
          onSubmitAction={generateRecipe}
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="groq/openai/gpt-oss-20b"
        />
      }
      rightPanel={<RecipeSidebar currentSessionId={sessionId} />}
    />
  );
}
