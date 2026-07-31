

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronRight, Sparkles, Search, Globe, FileText, Image as ImageIcon, Zap } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isComplete: boolean;
}

/**
 * ThinkingBlock — Accordion de razonamiento estilo Claude/Perplexity.
 * Muestra el proceso de pensamiento de la IA con animación en tiempo real.
 * Se auto-colapsa cuando la IA termina de pensar.
 */
export default function ThinkingBlock({ content, isComplete }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasAutoCollapsed = useRef(false);

  // Auto-colapsar cuando la IA termine de pensar
  useEffect(() => {
    if (isComplete && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
        hasAutoCollapsed.current = true;
      }, 1200); // Delay para que el usuario vea el resultado final
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  // Auto-scroll dentro del bloque mientras se llena
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isExpanded]);

  // Detectar iconos de herramientas mencionadas en el pensamiento
  const getToolIcons = () => {
    const icons: { icon: React.ReactNode; label: string }[] = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes("search_web") || lowerContent.includes("buscar") || lowerContent.includes("búsqueda")) {
      icons.push({ icon: <Globe className="w-3 h-3" />, label: "Web" });
    }
    if (lowerContent.includes("search_documents") || lowerContent.includes("documento") || lowerContent.includes("rag")) {
      icons.push({ icon: <FileText className="w-3 h-3" />, label: "Docs" });
    }
    if (lowerContent.includes("generate_image") || lowerContent.includes("imagen") || lowerContent.includes("unsplash")) {
      icons.push({ icon: <ImageIcon className="w-3 h-3" />, label: "Imagen" });
    }
    if (lowerContent.includes("knowledge") || lowerContent.includes("grafo") || lowerContent.includes("concepto")) {
      icons.push({ icon: <Brain className="w-3 h-3" />, label: "Grafo" });
    }
    if (lowerContent.includes("herramienta") || lowerContent.includes("tool") || lowerContent.includes("ejecut")) {
      icons.push({ icon: <Zap className="w-3 h-3" />, label: "Tools" });
    }
    return icons;
  };

  const toolIcons = getToolIcons();
  const lines = content.split("\n").filter(l => l.trim());
  const lineCount = lines.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-indigo-950/30 to-black/40 backdrop-blur-sm"
    >
      {/* Header - Siempre visible, clickeable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors group"
      >
        {/* Icono de pensamiento animado */}
        <div className="relative flex-shrink-0">
          {!isComplete ? (
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 rounded-full border-2 border-purple-400/60 border-t-purple-400 flex items-center justify-center"
            >
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
            </motion.div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center">
              <Brain className="w-3 h-3 text-purple-400" />
            </div>
          )}
        </div>

        {/* Texto de estado */}
        <div className="flex-1 text-left">
          <span className="text-xs font-medium text-purple-300/90">
            {!isComplete ? (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Razonando...
              </motion.span>
            ) : (
              `Razonamiento completado`
            )}
          </span>
          {isComplete && lineCount > 0 && (
            <span className="text-[10px] text-gray-500 ml-2">
              ({lineCount} pasos)
            </span>
          )}
        </div>

        {/* Tool badges */}
        {toolIcons.length > 0 && (
          <div className="flex items-center gap-1 mr-1">
            {toolIcons.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-0.5 bg-white/5 rounded-full px-1.5 py-0.5 text-[9px] text-gray-400 border border-white/5"
                title={t.label}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
        </motion.div>
      </button>

      {/* Content - Colapsable */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="px-3 pb-3 max-h-48 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent" }}
            >
              <div className="border-t border-purple-500/10 pt-2">
                {lines.map((line, i) => {
                  const trimmed = line.trim();
                  // Detect numbered steps like "1.", "2.", etc.
                  const isStep = /^\d+\./.test(trimmed);
                  // Detect labels like "ANÁLISIS:", "HERRAMIENTAS:", etc.
                  const isLabel = /^[A-ZÁÉÍÓÚÑ\s]+:/.test(trimmed);

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className={`text-[11px] leading-relaxed py-0.5 ${
                        isLabel
                          ? "text-purple-300/80 font-semibold mt-1"
                          : isStep
                          ? "text-gray-400 pl-2 flex items-start gap-1.5"
                          : "text-gray-500 pl-2"
                      }`}
                    >
                      {isStep && (
                        <span className="inline-block w-1 h-1 rounded-full bg-purple-400/60 mt-1.5 flex-shrink-0" />
                      )}
                      <span>{isStep ? trimmed.replace(/^\d+\.\s*/, "") : trimmed}</span>
                    </motion.div>
                  );
                })}
                
                {/* Cursor parpadeante mientras piensa */}
                {!isComplete && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="inline-block w-1.5 h-3 bg-purple-400/60 ml-2 rounded-sm"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
