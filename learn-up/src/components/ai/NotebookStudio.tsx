"use client";

import { motion } from "framer-motion";
import { 
  AudioLines, 
  Presentation, 
  Network, 
  Layers, 
  LineChart, 
  ClipboardList, 
  TableProperties 
} from "lucide-react";

interface NotebookStudioProps {
  currentSessionId?: string | null;
}

export default function NotebookStudio({ currentSessionId }: NotebookStudioProps) {
  const tools = [
    { id: "audio", label: "Resumen en audio", icon: AudioLines, beta: false },
    { id: "presentation", label: "Presentación", icon: Presentation, beta: true },
    { id: "mindmap", label: "Mapa mental", icon: Network, beta: false },
    { id: "flashcards", label: "Tarjetas", icon: Layers, beta: false },
    { id: "infographic", label: "Infografía", icon: LineChart, beta: true },
    { id: "quiz", label: "Cuestionario", icon: ClipboardList, beta: false },
    { id: "table", label: "Tabla de datos", icon: TableProperties, beta: false },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-[#18181A] border-l border-white/10 text-white font-sans relative">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold tracking-wide text-gray-200">Archivos</h2>
        <div className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center cursor-pointer">
          <Layers className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center" style={{ scrollbarWidth: "none" }}>
        
        <div 
          className="w-full max-w-sm aspect-square max-h-64 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-6 gap-4 hover:border-brand-gold/50 hover:bg-white/5 transition-all cursor-pointer group"
          onClick={() => {
            const fileInput = document.getElementById("ai-chat-file-input") as HTMLInputElement;
            if (fileInput) fileInput.click();
          }}
        >
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <ClipboardList className="w-8 h-8 text-gray-400 group-hover:text-brand-gold transition-colors" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Subir Archivos al Chat</h3>
            <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
              Haz clic aquí para adjuntar documentos (PDF, Word) o imágenes para que la IA los analice.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
