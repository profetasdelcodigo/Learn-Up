"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, Globe, FileText, Image as ImageIcon, Zap, CheckCircle2, ListChecks } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isComplete: boolean;
}

function stripInternalMarkers(value: string) {
  return String(value || "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<thinking>/gi, "")
    .replace(/<\/thinking>/gi, "")
    .trim();
}

function inferBadges(content: string) {
  const lower = content.toLowerCase();
  const badges: Array<{ label: string; icon: React.ReactNode }> = [];
  if (/https?:\/\//i.test(content) || lower.includes("fuentes consultadas") || lower.includes("búsqueda web") || lower.includes("web")) badges.push({ label: "Fuentes", icon: <Globe className="w-3 h-3" /> });
  if (lower.includes("documento") || lower.includes("rag") || lower.includes("biblioteca")) badges.push({ label: "Docs", icon: <FileText className="w-3 h-3" /> });
  if (lower.includes("imagen") || lower.includes("video") || lower.includes("audio")) badges.push({ label: "Multimedia", icon: <ImageIcon className="w-3 h-3" /> });
  if (lower.includes("skill") || lower.includes("herramienta") || lower.includes("tools") || lower.includes("acción") || lower.includes("acciones")) badges.push({ label: "Skills", icon: <Zap className="w-3 h-3" /> });
  if (!badges.length) badges.push({ label: "Respuesta", icon: <CheckCircle2 className="w-3 h-3" /> });
  return badges;
}

function normalizeLine(line: string) {
  return stripInternalMarkers(line)
    .replace(/^\s*[-*]\s*/, "")
    .trim();
}

export default function ThinkingBlock({ content, isComplete }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const clean = useMemo(() => stripInternalMarkers(content), [content]);
  const lines = useMemo(() => clean.split("\n").map(normalizeLine).filter(Boolean), [clean]);
  const badges = useMemo(() => inferBadges(clean), [clean]);

  const displayLines = lines.length
    ? lines
    : ["Se generó una respuesta usando el contexto disponible y las capacidades registradas."];

  const sourceStart = displayLines.findIndex((line) => /^Fuentes consultadas:/i.test(line));
  const sources = sourceStart >= 0 ? displayLines.slice(sourceStart + 1).filter(Boolean) : [];
  const traceLines = sourceStart >= 0 ? displayLines.slice(0, sourceStart) : displayLines;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl overflow-hidden border border-purple-500/25 bg-gradient-to-br from-purple-950/50 via-indigo-950/35 to-black/45 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
          <Brain className="w-3 h-3 text-purple-300" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-xs font-semibold text-purple-200/95">
            {isComplete ? "Evidencia de ejecución" : "Preparando respuesta…"}
          </span>
          <span className="text-[10px] text-gray-500 ml-2">
            {traceLines.length} paso{traceLines.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1 mr-1">
          {badges.map((badge) => (
            <span key={badge.label} className="hidden sm:inline-flex items-center gap-1 bg-white/5 rounded-full px-1.5 py-0.5 text-[9px] text-gray-400 border border-white/5">
              {badge.icon}
              {badge.label}
            </span>
          ))}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 max-h-56 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <div className="border-t border-purple-500/10 pt-2 space-y-1.5">
                {traceLines.map((line, index) => (
                  <div key={`${index}-${line}`} className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-400">
                    <span className="mt-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500/10 text-[9px] text-purple-300">
                      {index + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))}

                {sources.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300 mb-1.5">
                      <ListChecks className="w-3 h-3" /> Fuentes consultadas
                    </div>
                    {sources.map((source, index) => (
                      <div key={`${index}-${source}`} className="text-[10px] text-gray-500 leading-relaxed break-words">
                        {source}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
