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
      <div className="px-5 py-4 border-b border-white/5 flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-gray-200">Estudio</h2>
          <div className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center cursor-pointer">
            <Layers className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <p className="text-xs text-gray-400">Herramientas generativas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6" style={{ scrollbarWidth: "none" }}>
        
        {/* Generative Tools Grid */}
        <div className="grid grid-cols-2 gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-gold/40 transition-all text-gray-300 hover:text-brand-gold relative group"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-wide text-center leading-tight">
                  {tool.label}
                </span>
                {tool.beta && (
                  <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1 rounded-sm bg-brand-gold/20 text-brand-gold">
                    BETA
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Upload Box */}
        <div 
          className="w-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 gap-3 hover:border-brand-gold/50 hover:bg-white/5 transition-all cursor-pointer group mt-auto"
          onClick={() => {
            const fileInput = document.getElementById("ai-chat-file-input") as HTMLInputElement;
            if (fileInput) fileInput.click();
          }}
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <ClipboardList className="w-6 h-6 text-gray-400 group-hover:text-brand-gold transition-colors" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Adjuntar</h3>
            <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
              Sube PDF, Word o imágenes al contexto
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
