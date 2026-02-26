"use client";

import { HeartPulse } from "lucide-react";
import AIChatComponent from "@/components/AIChatComponent";
import { askCounselor } from "@/actions/ai-tutor";

export default function CounselorChatPage() {
  return (
    <AIChatComponent
      title="Alma"
      subtitle="Tu consejera de confianza"
      icon={<HeartPulse className="w-5 h-5 text-brand-gold" />}
      aiType="consejero"
      onSubmitAction={askCounselor}
    />
  );
}
