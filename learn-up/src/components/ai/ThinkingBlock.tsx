"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, Globe, FileText, Image as ImageIcon, Zap, CheckCircle2, ListChecks, CalendarDays, Users, BarChart3, GraduationCap } from "lucide-react";

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

function inferExecutedSkills(content: string): Array<{ label: string; icon: React.ReactNode }> {
  const lower = content.toLowerCase();
  const skills: Array<{ label: string; icon: React.ReactNode }> = [];
  const add = (label: string, icon: React.ReactNode) => { if (!skills.some((skill) => skill.label === label)) skills.push({ label, icon }); };

  if (/skills ejecutadas?\s*:\s*([^\n]+)/i.test(content)) {
    const match = content.match(/skills ejecutadas?\s*:\s*([^\n]+)/i);
    for (const raw of String(match?.[1] || "").split(/[,|•]/g).map((value) => value.trim()).filter(Boolean)) add(raw, <Zap className="w-3 h-3" />);
    if (skills.length) return skills;
  }

  if (/read_calendar|calendar|add_calendar_event|update_calendar_event|delete_calendar_event|evento|calendario/i.test(lower)) add("Calendario", <CalendarDays className="w-3 h-3" />);
  if (/search_web|advanced_web_search|deep_research|search_news|search_academic|research|búsqueda web|fuentes consultadas/i.test(lower)) add("Investigación", <Globe className="w-3 h-3" />);
  if (/generate_image|search_image|generate_video|analyze_image|text_to_speech|transcribe_audio|multimedia|unsplash|cloudflare vision/i.test(lower)) add("Multimedia", <ImageIcon className="w-3 h-3" />);
  if (/library|document|archivo|pdf|biblioteca/i.test(lower)) add("Biblioteca", <FileText className="w-3 h-3" />);
  if (/send_message|group|friend|social|chat/i.test(lower)) add("Social", <Users className="w-3 h-3" />);
  if (/analytics|progress|metric|rendimiento|estadística/i.test(lower)) add("Analítica", <BarChart3 className="w-3 h-3" />);
  if (/exam|education|practice|profesor|ejercicio/i.test(lower)) add("Educación", <GraduationCap className="w-3 h-3" />);
  return skills;
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
  const executedSkills = useMemo(() => inferExecutedSkills(clean), [clean]);

  const displayLines = lines.length
    ? lines
    : ["Se generó una respuesta usando el contexto disponible y las capacidades registradas."];

  const sourceStart = displayLines.findIndex((line) => /^Fuentes consultadas:/i.test(line));
  const sources = sourceStart >= 0 ? displayLines.slice(sourceStart + 1).filter(Boolean) : [];
  const traceLines = sourceStart >= 0 ? displayLines.slice(0, sourceStart) : displayLines;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="mb-3 rounded-xl overflow-hidden border border-purple-500/25 bg-gradient-to-br from-purple-950/50 via-indigo-950/35 to-black/45 backdrop-blur-sm shadow-[0_8px_30px_rgba(89,65,255,0.12)]"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        <motion.div
          animate={!isComplete ? { rotate: [0, 12, -12, 0] } : { rotate: 0 }}
          transition={!isComplete ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
          className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0"
        >
          <Brain className="w-3 h-3 text-purple-300" />
        </motion.div>
        <div className="flex-1 text-left">
          <span className="text-xs font-semibold text-purple-200/95">
            {isComplete ? "Evidencia de ejecución" : "Preparando respuesta…"}
          </span>
          <span className="text-[10px] text-gray-500 ml-2">
            {traceLines.length} paso{traceLines.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1 mr-1 flex-wrap justify-end">
          {badges.map((badge, index) => (
            <motion.span
              key={badge.label}
              initial={{ opacity: 0, y: -4, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.04, duration: 0.18 }}
              className="hidden sm:inline-flex items-center gap-1 bg-white/5 rounded-full px-1.5 py-0.5 text-[9px] text-gray-400 border border-white/5"
            >
              {badge.icon}
              {badge.label}
            </motion.span>
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
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 max-h-72 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <div className="border-t border-purple-500/10 pt-2 space-y-1.5">
                {executedSkills.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300 mb-1.5">
                      <Zap className="w-3 h-3" /> Skills ejecutadas
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {executedSkills.map((skill, index) => (
                        <motion.span
                          key={skill.label}
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05, duration: 0.18 }}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-2 py-1 text-[10px] text-brand-gold"
                        >
                          {skill.icon}
                          {skill.label}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {traceLines.map((line, index) => (
                  <motion.div
                    key={`${index}-${line}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.2), duration: 0.18 }}
                    className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-400"
                  >
                    <span className="mt-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500/10 text-[9px] text-purple-300">
                      {index + 1}
                    </span>
                    <span>{line}</span>
                  </motion.div>
                ))}

                {sources.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-2 mt-2 border-t border-white/5"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300 mb-1.5">
                      <ListChecks className="w-3 h-3" /> Fuentes consultadas
                    </div>
                    {sources.map((source, index) => (
                      <div key={`${index}-${source}`} className="text-[10px] text-gray-500 leading-relaxed break-words">
                        {source}
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
