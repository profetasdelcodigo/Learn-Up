"use client";

import { useState } from "react";
import { Heart, HeartPulse } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import AIChatComponent from "@/components/AIChatComponent";
import JournalSidebar from "@/components/JournalSidebar";
import SourcesPanel from "@/components/ai/SourcesPanel";
import { askCounselor } from "@/actions/ai-tutor";

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
          onSubmitAction={askCounselor}
          className="font-serif"
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
          defaultModel="groq/llama-3.1-8b-instant"
        />
      }
      rightPanel={<JournalSidebar currentSessionId={sessionId} />}
    />
  );
}
