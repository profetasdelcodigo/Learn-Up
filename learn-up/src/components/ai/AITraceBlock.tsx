"use client";

import { useMemo, useState } from "react";
import { Brain, ChevronDown, ExternalLink, Globe2, Sparkles, Wrench } from "lucide-react";

interface TraceAction {
  tool: string;
  description?: string;
  args?: Record<string, unknown>;
}

interface AITraceBlockProps {
  content: string;
  actions?: TraceAction[];
  roleLabel?: string;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function toolLabel(tool: string) {
  return tool
    .replace(/^__trace$/, "trazabilidad")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectSources(content: string, actions: TraceAction[]) {
  const urls = new Set<string>();
  const urlRegex = /https?:\/\/[^\s)<>\]"']+/gi;

  for (const match of content.matchAll(urlRegex)) urls.add(match[0].replace(/[.,;]+$/, ""));

  const visit = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  actions.forEach((action) => visit(action.args));

  return [...urls].slice(0, 8);
}

function buildSummary(actions: TraceAction[], sourceCount: number) {
  if (!actions.length) {
    return sourceCount > 0
      ? ["Analicé la solicitud y consulté las fuentes visibles asociadas a la respuesta."]
      : ["Analicé la solicitud y generé la respuesta usando el contexto disponible, sin ejecutar herramientas externas."];
  }

  const readable = unique(actions.map((action) => toolLabel(action.tool))).slice(0, 6);
  const steps = [
    `Identifiqué ${actions.length} acción${actions.length === 1 ? "" : "es"} necesaria${actions.length === 1 ? "" : "s"} para resolver la solicitud.`,
    `Skills utilizadas: ${readable.join(", ")}.`,
  ];
  if (sourceCount > 0) steps.push(`Contrasté ${sourceCount} fuente${sourceCount === 1 ? "" : "s"} visible${sourceCount === 1 ? "" : "s"} asociada${sourceCount === 1 ? "" : "s"} a la respuesta.`);
  steps.push("La respuesta final se construyó a partir de los resultados disponibles y sin exponer el razonamiento interno privado del modelo.");
  return steps;
}

export default function AITraceBlock({ content, actions = [], roleLabel = "IA" }: AITraceBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const sources = useMemo(() => collectSources(content, actions), [content, actions]);
  const skills = useMemo(() => unique(actions.map((action) => toolLabel(action.tool))), [actions]);
  const summary = useMemo(() => buildSummary(actions, sources.length), [actions, sources.length]);

  return (
    <div
      data-ai-trace="true"
      className="mb-3 rounded-xl overflow-hidden border border-purple-500/25 bg-gradient-to-br from-purple-950/45 via-indigo-950/30 to-black/45 backdrop-blur-sm shadow-lg shadow-purple-950/10"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
        aria-expanded={expanded}
      >
        <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
          <Brain className="w-3 h-3 text-purple-300" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-xs font-semibold text-purple-200">Trazabilidad de {roleLabel}</div>
          <div className="text-[10px] text-gray-500">Fuentes, resumen de razonamiento y Skills utilizadas</div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
          <span className="rounded-full bg-purple-400/10 px-1.5 py-0.5">{skills.length} Skills</span>
          <span className="rounded-full bg-purple-400/10 px-1.5 py-0.5">{sources.length} fuentes</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-purple-500/10">
          <div className="pt-2 space-y-3">
            <section>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/80 mb-1.5">
                <Sparkles className="w-3 h-3" /> Resumen de razonamiento
              </div>
              <div className="space-y-1">
                {summary.map((step) => (
                  <div key={step} className="text-[11px] leading-relaxed text-gray-400 pl-2">
                    <span className="text-purple-400 mr-1">•</span>{step}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/80 mb-1.5">
                <Wrench className="w-3 h-3" /> Skills utilizadas
              </div>
              {skills.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-gray-300">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-gray-500">Respuesta directa; no se ejecutaron Skills.</span>
              )}
            </section>

            <section>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/80 mb-1.5">
                <Globe2 className="w-3 h-3" /> Fuentes consultadas
              </div>
              {sources.length ? (
                <div className="space-y-1.5">
                  {sources.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-[11px] text-purple-300 hover:text-purple-200 hover:underline break-all"
                    >
                      <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                      {url}
                    </a>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-gray-500">No se consultaron fuentes externas detectables.</span>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
