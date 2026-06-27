"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, useDragControls } from "framer-motion";
import { Bot, X, Send, Sparkles, Loader2, Maximize2, Minimize2, ExternalLink, CalendarPlus, Search, FileText, Mic, Volume2, VolumeX } from "lucide-react";

import { askJarvis } from "@/actions/jarvis";
import dynamic from "next/dynamic";

const JarvisOrb3D = dynamic(() => import("@/components/3d/JarvisOrb3D"), { 
  ssr: false,
  loading: () => (
    <div className="w-14 h-14 rounded-full bg-brand-gold animate-pulse border border-brand-gold/50 shadow-glow-gold" />
  )
});

interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
  actions?: any[];
}

export default function JarvisGlobalWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const dragControls = useDragControls();
  const pathname = usePathname();

  // Ocultar Jarvis en páginas donde ya hay un chat dedicado o pantallas de sistema
  const hiddenPaths = ["/chat", "/profesor", "/consejero", "/examenes", "/nutrirecetas", "/login"];
  const isHidden = hiddenPaths.some((p) => pathname?.startsWith(p));

  // Inicializar Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined" && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + " " + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakText = useCallback((text: string) => {
    if (typeof window !== "undefined" && 'speechSynthesis' in window) {
      // Detener cualquier audio previo
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      if (customEvent.detail?.message) {
        setMessages(prev => [...prev, { role: "assistant", content: customEvent.detail.message }]);
        if (autoTTS) speakText(customEvent.detail.message);
      }
    };
    window.addEventListener("triggerJarvis", handleTrigger);
    return () => window.removeEventListener("triggerJarvis", handleTrigger);
  }, [autoTTS, speakText]);

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      const initialGreeting = "Hola, soy Jarvis. ¿En qué te puedo ayudar en esta sección?";
      setMessages([{ role: "assistant", content: initialGreeting }]);
      if (autoTTS) speakText(initialGreeting);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const contextPrefix = `[Contexto URL: ${pathname}] `;
      
      const res = await askJarvis(
        contextPrefix + userMessage,
        messages
      );

      if (res.error) {
        const errorMsg = `Error: ${res.error}`;
        setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
        if (autoTTS) speakText("Ocurrió un error al procesar tu solicitud.");
      } else {
        const replyText = res.response || (res.actions?.length ? "Ejecutando acción solicitada." : "No response.");
        setMessages((prev) => [
          ...prev, 
          { 
            role: "assistant", 
            content: replyText,
            actions: res.actions
          }
        ]);
        
        if (autoTTS && replyText) {
          speakText(replyText);
        }

        // Ejecución de cliente para acciones auto-confirmadas o directas
        if (res.actions && res.actions.length > 0) {
          const action = res.actions[0];
          if (action.tool === "open_url" && action.args.url && action.requiresConfirm === false) {
             // Si requiresConfirm fuera falso, se abre de una vez, pero Jarvis las marca con true.
          }
        }
      }
    } catch (error) {
      console.error(error);
      const failMsg = "Lo siento, tuve un problema al procesar tu solicitud.";
      setMessages((prev) => [...prev, { role: "assistant", content: failMsg }]);
      if (autoTTS) speakText(failMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderToolCard = (action: any) => {
    switch (action.tool) {
      case "open_url":
        return (
          <div className="mt-3 p-3 rounded-xl bg-white/5 border border-cyan-500/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-cyan-400">
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Sugerencia de Enlace</span>
            </div>
            <p className="text-sm text-gray-300">{action.args.title || action.args.url}</p>
            <button 
              onClick={() => window.open(action.args.url, "_blank")}
              className="mt-1 w-full py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-semibold hover:bg-cyan-500/30 transition-colors"
            >
              Abrir Enlace
            </button>
          </div>
        );
      case "add_calendar_event":
        return (
          <div className="mt-3 p-3 rounded-xl bg-white/5 border border-emerald-500/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <CalendarPlus className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Confirmar Evento</span>
            </div>
            <p className="text-sm text-white font-medium">{action.args.title}</p>
            <p className="text-xs text-gray-400">{action.args.date} {action.args.start_time} - {action.args.end_time}</p>
            <button className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors">
              Confirmar y Agendar
            </button>
          </div>
        );
      case "search_web":
        return (
          <div className="mt-3 p-3 rounded-xl bg-white/5 border border-blue-500/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-blue-400">
              <Search className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Búsqueda Web Pendiente</span>
            </div>
            <p className="text-sm text-gray-300">¿Deseas que busque "{action.args.query}" en internet?</p>
            <button className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors">
              Proceder con la Búsqueda
            </button>
          </div>
        );
      case "create_exam":
        return (
          <div className="mt-3 p-3 rounded-xl bg-white/5 border border-purple-500/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-purple-400">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Crear Examen</span>
            </div>
            <p className="text-sm text-gray-300">Tema: {action.args.topic}</p>
            <p className="text-xs text-gray-400">Dificultad: {action.args.difficulty} | {action.args.question_count} preguntas</p>
            <button className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors">
              Generar y Practicar
            </button>
          </div>
        );
      default:
        return (
          <div className="mt-3 p-3 rounded-xl bg-white/5 border border-brand-gold/30 flex flex-col gap-2">
            <p className="text-sm text-brand-gold font-medium">{action.description}</p>
            <button className="mt-1 w-full py-2 bg-brand-gold/20 text-brand-gold rounded-lg text-sm font-semibold hover:bg-brand-gold/30 transition-colors">
              Ejecutar Acción
            </button>
          </div>
        );
    }
  };

  if (isHidden) return null;

  // Claude-like Logo but Blue and Gold
  const JarvisLogo = () => (
    <svg viewBox="0 0 100 100" className="h-7 w-7 transition-transform group-hover:scale-110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 C50 30, 70 50, 95 50 C70 50, 50 70, 50 95 C50 70, 30 50, 5 50 C30 50, 50 30, 50 5 Z" fill="url(#goldGradient)"/>
      <path d="M30 30 C30 40, 40 50, 50 50 C40 50, 30 60, 30 70 C30 60, 20 50, 10 50 C20 50, 30 40, 30 30 Z" fill="#1a365d" opacity="0.8"/>
      <defs>
        <linearGradient id="goldGradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d4af37" />
          <stop offset="1" stopColor="#f3e5ab" />
        </linearGradient>
      </defs>
    </svg>
  );

  return (
    <motion.div 
      className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end"
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={{ left: -1200, right: 1200, top: -800, bottom: 800 }}
      whileDrag={{ scale: 1.02 }}
    >
      {isOpen && (
        <div 
          className={`mb-4 flex flex-col overflow-hidden rounded-2xl border border-brand-gold/30 bg-black/80 shadow-2xl shadow-brand-gold/10 backdrop-blur-xl transition-all duration-300 ease-in-out ${
            isExpanded ? "h-[80vh] w-[90vw] md:w-[600px]" : "h-[450px] w-[350px] sm:w-[400px]"
          }`}
        >
          {/* Header */}
          <div
            className="flex cursor-grab items-center justify-between border-b border-brand-gold/20 bg-gradient-to-r from-brand-gold/10 to-transparent px-4 py-3 active:cursor-grabbing"
            onPointerDown={(event) => dragControls.start(event)}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <JarvisLogo />
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-black">
                  <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Jarvis</h3>
                <p className="text-[10px] text-brand-gold/80">Asistente Global</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <button 
                onClick={() => setAutoTTS(!autoTTS)} 
                className={`hover:text-white transition ${autoTTS ? 'text-brand-gold' : ''}`}
                title={autoTTS ? "Silenciar" : "Activar Voz"}
              >
                {autoTTS ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button onClick={() => setIsExpanded(!isExpanded)} className="hover:text-white transition" title="Pantalla Completa">
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={toggleWidget} className="hover:text-white transition" title="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm relative group ${
                    msg.role === "user" 
                      ? "bg-brand-gold text-black rounded-tr-sm" 
                      : "bg-white/10 text-gray-100 rounded-tl-sm border border-white/5"
                  }`}
                >
                  {msg.role === "assistant" && (
                     <button 
                       onClick={() => speakText(msg.content)} 
                       className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-brand-gold"
                       title="Leer en voz alta"
                     >
                       <Volume2 className="h-4 w-4" />
                     </button>
                  )}

                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      {msg.actions && msg.actions.map((action, i) => (
                        <div key={i}>{renderToolCard(action)}</div>
                      ))}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/5 px-4 py-2.5 text-brand-gold">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-3 bg-black/40">
            <form onSubmit={sendMessage} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Escuchando..." : "Pídele algo a Jarvis..."}
                className={`w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-12 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all
                  ${isListening ? 'border-red-500/50 bg-red-500/10' : 'focus:border-brand-gold/50 focus:bg-white/10'}`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={toggleListen}
                className={`absolute left-3 text-gray-400 hover:text-white transition-colors ${isListening ? 'text-red-500 animate-pulse' : ''}`}
                title="Dictar por voz"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Orb Button */}
      <button
        onClick={toggleWidget}
        onPointerDown={(event) => dragControls.start(event)}
        className={`group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-yellow-600 text-black shadow-lg shadow-brand-gold/20 transition-transform hover:scale-110 active:scale-95 ${
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100 delay-200"
        }`}
      >
        <div className="absolute inset-0 rounded-full border border-white/20"></div>
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-gold/30 duration-2000"></div>
        <div className="relative z-10 transition-transform group-hover:rotate-12 text-black w-16 h-16 flex items-center justify-center">
          <JarvisOrb3D />
        </div>
      </button>
    </motion.div>
  );
}
