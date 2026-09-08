"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import AIChatComponent from "@/components/AIChatComponent";
import NotebookWhiteboard from "@/components/NotebookWhiteboard";
import { askProfessorStable } from "@/actions/stable-ai-agents";
import SourcesPanel from "@/components/ai/SourcesPanel";

export default function ProfessorChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatInstanceKey, setChatInstanceKey] = useState(0);

  const handleSidebarSessionChange = (nextSessionId: string | null) => {
    setSessionId(nextSessionId);
    setChatInstanceKey((key) => key + 1);
  };

  return (
    <NotebookLayout
      leftPanel={
        <SourcesPanel
          aiType="profesor"
          currentSessionId={sessionId}
          onSessionChange={handleSidebarSessionChange}
        />
      }
      centerPanel={
        <AIChatComponent
          key={chatInstanceKey}
          title="Profesor Mente"
          subtitle="Tu tutor socrático personal"
          icon={<BookOpen className="w-5 h-5 text-brand-gold" />}
          aiType="profesor"
          onSubmitAction={askProfessorStable}
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="groq/openai/gpt-oss-20b"
        />
      }
      rightPanel={<NotebookWhiteboard currentSessionId={sessionId} />}
    />
  );
}
