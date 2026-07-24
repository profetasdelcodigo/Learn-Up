"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import AIChatComponent from "@/components/AIChatComponent";
import NotebookWhiteboard from "@/components/NotebookWhiteboard";
import { askProfessor } from "@/actions/ai-tutor";

export default function ProfessorChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <NotebookLayout
      centerPanel={
        <AIChatComponent
          title="Profesor Mente"
          subtitle="Tu tutor socrático personal"
          icon={<BookOpen className="w-5 h-5 text-brand-gold" />}
          aiType="profesor"
          onSubmitAction={askProfessor}
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="groq/llama-3.3-70b-versatile"
        />
      }
      rightPanel={<NotebookWhiteboard currentSessionId={sessionId} />}
    />
  );
}
