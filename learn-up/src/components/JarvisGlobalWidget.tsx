"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Sparkles, Loader2, Maximize2, Minimize2 } from "lucide-react";

import { askJarvis } from "@/actions/jarvis";

export default function JarvisGlobalWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{role: "user" | "assistant"; content: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Ocultar Jarvis en páginas donde ya hay un chat dedicado o pantallas de sistema
  const hiddenPaths = ["/chat", "/profesor", "/consejero", "/examenes", "/nutrirecetas", "/login"];
  const isHidden = hiddenPaths.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      if (customEvent.detail?.message) {
        setMessages(prev => [...prev, { role: "assistant", content: customEvent.detail.message }]);
      }
    };
    window.addEventListener("triggerJarvis", handleTrigger);
    return () => window.removeEventListener("triggerJarvis", handleTrigger);
  }, []);

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      setMessages([{ role: "assistant", content: "Hola, soy Jarvis. ¿En qué te puedo ayudar en esta sección?" }]);
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
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${res.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: res.response || "No response." }]);
        // Si hay una acción de redirección, la manejamos aquí.
        if (res.actions && res.actions.length > 0) {
          const action = res.actions[0];
          if (action.tool === "open_url" && action.args.url) {
            window.location.href = action.args.url;
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Lo siento, tuve un problema al procesar tu solicitud." }]);
    } finally {
      setLoading(false);
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
    <div className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end">
      {isOpen && (
        <div 
          className={`mb-4 flex flex-col overflow-hidden rounded-2xl border border-brand-gold/30 bg-black/80 shadow-2xl shadow-brand-gold/10 backdrop-blur-xl transition-all duration-300 ease-in-out ${
            isExpanded ? "h-[80vh] w-[90vw] md:w-[600px]" : "h-[450px] w-[350px] sm:w-[400px]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand-gold/20 bg-gradient-to-r from-brand-gold/10 to-transparent px-4 py-3">
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
              <button onClick={() => setIsExpanded(!isExpanded)} className="hover:text-white transition">
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={toggleWidget} className="hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user" 
                      ? "bg-brand-gold text-black rounded-tr-sm" 
                      : "bg-white/10 text-gray-100 rounded-tl-sm border border-white/5"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                      {msg.content}
                    </div>
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
                placeholder="Pídele algo a Jarvis..."
                className="w-full rounded-full border border-white/10 bg-white/5 pl-4 pr-12 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 focus:bg-white/10 transition-all"
                disabled={loading}
              />
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
        className={`group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-yellow-600 text-black shadow-lg shadow-brand-gold/20 transition-transform hover:scale-110 active:scale-95 ${
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100 delay-200"
        }`}
      >
        <div className="absolute inset-0 rounded-full border border-white/20"></div>
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-gold/30 duration-2000"></div>
        <div className="relative z-10 transition-transform group-hover:rotate-12 text-black">
          <JarvisLogo />
        </div>
      </button>
    </div>
  );
}
