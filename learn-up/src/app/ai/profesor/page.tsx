"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import SourcesPanel from "@/components/ai/SourcesPanel";
import AIChatComponent from "@/components/AIChatComponent";
import NotebookStudio from "@/components/ai/NotebookStudio";
import { askProfessor } from "@/actions/ai-tutor";

export default function ProfessorChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <NotebookLayout
      leftPanel={
        <SourcesPanel
          aiType="profesor"
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
        />
      }
      centerPanel={
        <AIChatComponent
          title="Profesor Mente"
          subtitle="Tu tutor socrático personal"
          icon={<BookOpen className="w-5 h-5 text-brand-gold" />}
          aiType="profesor"
          onSubmitAction={askProfessor}
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="nvidia/deepseek-ai/deepseek-v4"
        />
      }
      rightPanel={<NotebookStudio currentSessionId={sessionId} />}
    />
  );
}
