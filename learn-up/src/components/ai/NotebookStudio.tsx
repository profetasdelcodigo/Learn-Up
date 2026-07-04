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
    <div className="flex flex-col w-full h-full bg-[#18181A] border-l border-white/10 text-white font-sans">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-gray-200">Studio</h2>
        {/* Placeholder para un posible botón de expandir */}
        <div className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center cursor-pointer">
          <Layers className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "none" }}>
        <div className="grid grid-cols-2 gap-3">
          {tools.map((tool) => (
            <motion.button
              key={tool.id}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("triggerJarvis", {
                    detail: {
                      message: `Generar ${tool.label.toLowerCase()} a partir del contexto actual de nuestra conversación.`
                    }
                  })
                );
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-start justify-between p-4 h-24 rounded-2xl bg-[#27272A] border border-white/5 hover:border-white/15 hover:bg-[#2A2A2D] transition-colors relative group text-left"
            >
              {tool.beta && (
                <span className="absolute top-3 right-3 text-[9px] font-bold tracking-wider text-gray-400 bg-black/40 px-1.5 py-0.5 rounded-sm">
                  BETA
                </span>
              )}
              <tool.icon className="w-5 h-5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
              <span className="text-xs font-medium text-gray-300 group-hover:text-white mt-auto">
                {tool.label}
              </span>
            </motion.button>
          ))}
        </div>

        <div className="mt-8 text-center px-4">
          <p className="text-xs text-gray-500 mb-2">
            Los datos de salida de Studio se guardarán aquí.
          </p>
          <p className="text-[10px] text-gray-600">
            Haz clic en algún formato de estudio para generar un mapa mental y más.
          </p>
        </div>
      </div>
    </div>
  );
}
