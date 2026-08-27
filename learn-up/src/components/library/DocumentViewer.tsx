"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, FileText, ChevronRight, MessageSquare, Trash2 } from "lucide-react";

interface AiDocument {
  id: string;
  title: string;
  source_url: string;
  mime_type?: string;
  created_at: string;
  status: string;
}

interface DocumentViewerProps {
  document: AiDocument;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onAskAi: (documentId: string, initialPrompt?: string) => void;
}

export default function DocumentViewer({
  document,
  onClose,
  onDelete,
  onAskAi,
}: DocumentViewerProps) {
  const isPdf = document.mime_type === "application/pdf" || document.source_url.endsWith(".pdf");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-black border border-brand-blue-glow rounded-3xl p-6 max-w-4xl w-full h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-blue-glow/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-blue-glow" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white line-clamp-1">
                  {document.title}
                </h2>
                <p className="text-xs text-gray-400">
                  Indexado el {new Date(document.created_at).toLocaleDateString("es-ES")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {onDelete && (
                <button
                  onClick={() => onDelete(document.id)}
                  className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:border-red-500 hover:text-red-500 transition-all"
                  title="Eliminar documento"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:border-brand-blue-glow hover:text-brand-blue-glow transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Actions Row */}
          <div className="flex gap-3 mb-4 overflow-x-auto pb-2 shrink-0 hide-scrollbar">
            <button
              onClick={() => onAskAi(document.id)}
              className="px-4 py-2 bg-brand-blue-glow/10 border border-brand-blue-glow/30 rounded-full text-brand-blue-glow hover:bg-brand-blue-glow hover:text-black transition-all flex items-center gap-2 whitespace-nowrap text-sm font-semibold"
            >
              <MessageSquare className="w-4 h-4" /> Preguntar a la IA
            </button>
            <button
              onClick={() => onAskAi(document.id, "Genera un resumen detallado de este documento.")}
              className="px-4 py-2 bg-surface-2 border border-white/10 rounded-full text-white hover:border-white/30 transition-all flex items-center gap-2 whitespace-nowrap text-sm font-semibold"
            >
              <Brain className="w-4 h-4 text-brand-purple" /> Resumir
            </button>
            <button
              onClick={() => onAskAi(document.id, "Extrae 5 preguntas clave de opción múltiple de este documento para evaluar mi conocimiento.")}
              className="px-4 py-2 bg-surface-2 border border-white/10 rounded-full text-white hover:border-white/30 transition-all flex items-center gap-2 whitespace-nowrap text-sm font-semibold"
            >
              <FileText className="w-4 h-4 text-brand-gold" /> Generar Quiz
            </button>
          </div>

          {/* Content Viewer */}
          <div className="flex-1 bg-surface-2 rounded-2xl border border-white/10 overflow-hidden relative">
            {isPdf ? (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(document.source_url)}&embedded=true`}
                className="w-full h-full"
                title={document.title}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                <FileText className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Visualizador no disponible</h3>
                <p className="text-gray-400 max-w-md mb-6">
                  Este formato de archivo no puede visualizarse directamente aquí. Puedes descargarlo o usar las acciones de IA arriba para analizar su contenido.
                </p>
                <a
                  href={document.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-brand-blue-glow text-black font-bold rounded-xl hover:bg-white transition-all flex items-center gap-2"
                >
                  Abrir Archivo Original <ChevronRight className="w-5 h-5" />
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
