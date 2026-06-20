"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Paperclip,
  ChevronLeft,
  Bot,
  BrainCircuit,
  ExternalLink,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface AIChatAgenticProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  aiType: string;
  className?: string;
}

export default function AIChatAgentic({
  title,
  subtitle,
  icon,
  aiType,
  className,
}: AIChatAgenticProps) {
  const router = useRouter();
  const [isAutonomous, setIsAutonomous] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    addToolResult,
  } = useChat({
    api: "/api/chat",
    body: {
      aiType,
      isAutonomous,
    },
    // Customize error handling or onFinish here if needed
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className={`flex flex-col w-full h-full bg-surface-1 text-gray-200 ${className || ""}`}>
      {/* ──────────────────── HEADER ──────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-2/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
              {icon || <Bot className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="font-semibold text-white text-base leading-tight">
                {title}
              </h1>
              <p className="text-xs text-brand-gold/80 mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Autonomy Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 border border-white/5">
          <span className="text-xs text-gray-400 font-medium hidden md:inline">
            Piloto Automático
          </span>
          <button
            onClick={() => setIsAutonomous(!isAutonomous)}
            className="text-brand-gold transition-transform hover:scale-105"
            title="Permitir que la IA ejecute herramientas sin preguntar"
          >
            {isAutonomous ? (
              <ToggleRight className="w-6 h-6" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* ──────────────────── MESSAGES ──────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8" style={{ scrollbarWidth: "none" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pb-12">
            <div className="w-24 h-24 rounded-3xl bg-surface-2 border border-white/5 flex items-center justify-center mb-6 shadow-2xl">
              {icon || <Bot className="w-10 h-10" />}
            </div>
            <h2 className="text-xl font-medium text-white mb-2">¿En qué puedo ayudarte?</h2>
            <p className="max-w-sm text-sm">
              Escribe tu consulta abajo. Puedes activar el Piloto Automático para que tome acciones por ti.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} max-w-4xl mx-auto`}
          >
            {m.role === "user" ? (
              // User Message (Clean gray block)
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-[80%]">
                <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-medium">
                  <User className="w-3 h-3" /> Tú
                </div>
                <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </p>
              </div>
            ) : (
              // AI Message (Notion style document block)
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3 text-brand-gold text-xs font-semibold uppercase tracking-wider">
                  <Bot className="w-3 h-3" /> {title}
                </div>

                {/* Content */}
                {m.content && (
                  <div className="prose-ai text-gray-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap [&_strong]:text-white">
                    {m.content}
                  </div>
                )}

                {/* Legal Disclaimer & Feedback */}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500 font-medium">
                  <span className="italic">*Generado por IA — puede contener errores*</span>
                  <span>·</span>
                  <div className="flex items-center gap-2">
                    <span>¿Te sirvió esta respuesta?</span>
                    <button className="hover:text-brand-gold transition-colors">👍</button>
                    <button className="hover:text-red-400 transition-colors">👎</button>
                  </div>
                </div>

                {/* Tool Invocations (Visible Reasoning) */}
                {m.toolInvocations?.map((toolInvocation) => {
                  const toolCallId = toolInvocation.toolCallId;
                  
                  return (
                    <div key={toolCallId} className="mt-4 w-full md:w-3/4">
                      <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
                        {/* Tool Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02]">
                          <div className="flex items-center gap-2">
                            {toolInvocation.state === "result" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : (
                              <BrainCircuit className="w-4 h-4 text-brand-gold animate-pulse" />
                            )}
                            <span className="text-xs font-medium text-gray-300 font-mono">
                              {toolInvocation.toolName === "search_web" && "Buscando en la web"}
                              {toolInvocation.toolName === "generate_image" && "Generando imagen"}
                              {toolInvocation.toolName === "navigate_to" && "Navegando"}
                              {toolInvocation.toolName}
                            </span>
                          </div>
                        </div>

                        {/* Tool Content (Arguments & Results) */}
                        <div className="px-4 py-3 border-t border-white/5 bg-black/40 text-xs font-mono text-gray-400">
                          <p>
                            Argumentos:{" "}
                            <span className="text-white/70">
                              {JSON.stringify(toolInvocation.args)}
                            </span>
                          </p>
                          
                          {/* If the tool requires client confirmation (state = call) */}
                          {toolInvocation.state === "call" && !isAutonomous && (
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => addToolResult({ toolCallId, result: "Usuario aprobó la acción." })}
                                className="px-4 py-2 bg-brand-gold text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
                              >
                                Aprobar Acción
                              </button>
                              <button
                                onClick={() => addToolResult({ toolCallId, result: "Usuario RECHAZÓ la acción." })}
                                className="px-4 py-2 bg-red-500/20 text-red-400 font-medium rounded-lg border border-red-500/30 hover:bg-red-500/30 transition"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}

                          {/* If tool finished */}
                          {toolInvocation.state === "result" && (
                            <div className="mt-2 text-green-400/80">
                              Resultado: {JSON.stringify(toolInvocation.result).slice(0, 100)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-brand-gold/70 text-sm font-medium animate-pulse ml-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Pensando...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ──────────────────── INPUT ──────────────────── */}
      <div className="p-4 md:p-6 bg-surface-1 border-t border-white/5">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto relative flex items-center"
        >
          <button
            type="button"
            className="absolute left-4 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe un mensaje o invoca una herramienta..."
            disabled={isLoading}
            className="w-full bg-surface-2 border border-white/10 rounded-full py-4 pl-14 pr-16 text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 focus:ring-1 focus:ring-brand-gold/50 transition-all shadow-xl"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-3 p-2.5 bg-brand-gold hover:bg-yellow-400 text-black rounded-full disabled:opacity-50 disabled:hover:bg-brand-gold transition-colors shadow-lg"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-500 mt-3 font-medium tracking-wide">
          Jarvis puede cometer errores. Verifica los datos importantes antes de usarlos en una evaluación.
        </p>
      </div>
    </div>
  );
}
