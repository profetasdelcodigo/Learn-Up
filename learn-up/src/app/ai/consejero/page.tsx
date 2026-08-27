"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import AIChatComponent from "@/components/AIChatComponent";
import JournalSidebar from "@/components/JournalSidebar";
import SourcesPanel from "@/components/ai/SourcesPanel";
import { askCounselorStable } from "@/actions/stable-ai-agents";

export default function CounselorChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <NotebookLayout
      leftPanel={
        <SourcesPanel
          aiType="consejero"
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
        />
      }
      centerPanel={
        <AIChatComponent
          title="Alma (Consejera)"
          subtitle="Apoyo emocional y motivación diaria"
          icon={<Heart className="w-5 h-5 text-rose-500" />}
          aiType="consejero"
          onSubmitAction={askCounselorStable}
          className="font-serif"
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="openrouter/openrouter/free"
        />
      }
      rightPanel={<JournalSidebar currentSessionId={sessionId} />}
    />
  );
}
