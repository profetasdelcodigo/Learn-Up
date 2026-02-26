"use client";

import { BookOpen } from "lucide-react";
import AIChatComponent from "@/components/AIChatComponent";
import { askProfessor } from "@/actions/ai-tutor";

export default function ProfessorChatPage() {
  return (
    <AIChatComponent
      title="Profesor Mente"
      subtitle="Tu tutor socrático personal"
      icon={<BookOpen className="w-5 h-5 text-brand-gold" />}
      aiType="profesor"
      onSubmitAction={askProfessor}
    />
  );
}
