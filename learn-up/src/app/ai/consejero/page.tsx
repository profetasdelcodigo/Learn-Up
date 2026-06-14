"use client";

import { useState } from "react";
import { HeartPulse } from "lucide-react";
import NotebookLayout from "@/components/ai/NotebookLayout";
import SourcesPanel from "@/components/ai/SourcesPanel";
import AIChatComponent from "@/components/AIChatComponent";
import JournalSidebar from "@/components/JournalSidebar";
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
          title="Alma"
          subtitle="Tu consejera de confianza"
          icon={<HeartPulse className="w-5 h-5 text-brand-gold" />}
          aiType="consejero"
          onSubmitAction={askCounselor}
          className="font-serif"
          currentSessionId={sessionId}
          onSessionChange={setSessionId}
        />
      }
      rightPanel={<JournalSidebar />}
    />
  );
}
