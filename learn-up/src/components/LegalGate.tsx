"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, ShieldCheck, XCircle, Bot, Send, Loader2 } from "lucide-react";
import { useChat } from "ai/react";

interface LegalGateProps {
  onAccept: () => void;
  onDecline: () => void;
  isDeclining: boolean;
}

export default function LegalGate({ onAccept, onDecline, isDeclining }: LegalGateProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [acceptedA, setAcceptedA] = useState(false);
  const [acceptedB, setAcceptedB] = useState(false);
  
  // Custom chat hook pointing to a specific endpoint (or the global one, we'll use the global chat for simplicity, just asking it legal stuff)
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "1",
        role: "assistant",
        content: "Hola, soy Jarvis. He analizado el contrato que tienes a la izquierda. Si tienes alguna duda sobre la privacidad, tus datos o las reglas, pregúntame antes de firmar."
      }
    ]
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom) setHasScrolled(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 p-4 h-[85vh]">
      
      {/* Left Side: Massive Terms Document */}
      <div className="flex-1 glass-strong border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-4">
          <div className="p-3 bg-brand-gold/10 rounded-xl">
            <ScrollText className="w-8 h-8 text-brand-gold" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white font-display">Términos de Servicio y Privacidad</h2>
            <p className="text-sm text-gray-400 font-body">Debes leer y aceptar estos términos antes de crear tu cuenta.</p>
          </div>
        </div>
        
        <div 
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm text-gray-300 font-body"
          onScroll={handleScroll}
        >
          {/* Simulated 50 page document */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">1. Introducción y Marco Legal</h3>
            <p>
              Bienvenido a Learn Up. Al acceder y registrarte en esta plataforma, aceptas vincularte legalmente por estos Términos de Servicio y Política de Privacidad, los cuales han sido redactados en cumplimiento con la COPPA (Children's Online Privacy Protection Act), el GDPR-K, y las legislaciones de protección de datos de Latinoamérica.
            </p>
            <p>
              Learn Up S.A.C. opera esta plataforma como un proveedor de servicios educativos asistidos por Inteligencia Artificial.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">2. Procesamiento de Datos por Inteligencia Artificial (Jarvis)</h3>
            <p>
              Learn Up orquesta múltiples modelos de lenguaje de terceros (subprocesadores de IA) para operar las funciones de tutoría y consejería ("Jarvis"). Los datos personales que ingresas en el chat se transmiten a dichos proveedores exclusivamente para generar la respuesta.
            </p>
            <p>
              <strong>Zero Data Retention:</strong> Mantenemos contratos estrictos donde ningún proveedor externo puede usar tus conversaciones para entrenar sus propios modelos.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">3. Naturaleza Estocástica y Exención de Responsabilidad Académica</h3>
            <p>
              Jarvis, Profesor IA y Consejero IA son sistemas de inteligencia artificial generativa. Por su naturaleza, pueden generar afirmaciones inexactas, desactualizadas o inventadas (alucinaciones algorítmicas). Learn Up no garantiza la exactitud absoluta y no sustituye la instrucción de un docente certificado.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">4. Propiedad Intelectual, Biblioteca y Safe Harbor DMCA</h3>
            <p>
              Al subir cualquier archivo a tu Biblioteca, declaras que tienes derecho a hacerlo. Learn Up respeta la propiedad intelectual y opera bajo el Safe Harbor de la DMCA (17 U.S.C. § 512). Todo uso de documentos por parte de la IA se enmarca dentro del <em>Fair Use</em> educativo para generar resúmenes, sin redistribuir copias sustanciales de las obras.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">5. Salas de Estudio y Protección de Menores</h3>
            <p>
              Las Salas de Estudio (LiveKit) pueden ser grabadas con fines de moderación. Aplicamos tolerancia cero ante cualquier conducta inapropiada y reportaremos de manera inmediata a las autoridades competentes (NCMEC) cualquier sospecha de vulneración a menores, amparados por la Section 230 de la Communications Decency Act.
            </p>
          </section>
          
          <div className="h-32 flex items-center justify-center border-t border-white/5 mt-8 pt-8">
            <p className="text-gray-500 italic">... [Fin del Documento Legal] ...</p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-6 border-t border-white/10 bg-black/40 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={acceptedA} 
              onChange={(e) => setAcceptedA(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-600 bg-black/50 text-brand-gold focus:ring-brand-gold focus:ring-offset-black"
            />
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              He leído y acepto los <strong>Términos de Servicio</strong> y la <strong>Política de Privacidad</strong>.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={acceptedB} 
              onChange={(e) => setAcceptedB(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-600 bg-black/50 text-brand-gold focus:ring-brand-gold focus:ring-offset-black"
            />
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              Entiendo y acepto cómo <strong>Jarvis procesa mis datos mediante IA</strong> (Zero Data Retention) y asumo que la IA puede cometer errores.
            </span>
          </label>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={onDecline}
              disabled={isDeclining}
              className="flex-1 py-3 px-4 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isDeclining ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
              No acepto
            </button>
            <button 
              onClick={onAccept}
              disabled={!acceptedA || !acceptedB}
              className="flex-1 py-3 px-4 rounded-xl bg-brand-gold text-black font-bold hover:bg-brand-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-glow-gold"
            >
              <ShieldCheck className="w-5 h-5" />
              Aceptar y Continuar
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Jarvis Legal Advisor */}
      <div className="w-full lg:w-96 glass border border-brand-purple/30 rounded-2xl flex flex-col shadow-glow-purple/10">
        <div className="p-4 border-b border-brand-purple/20 bg-brand-purple/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-purple/20 flex items-center justify-center border border-brand-purple/30">
            <Bot className="w-5 h-5 text-brand-purple" />
          </div>
          <div>
            <h3 className="font-bold text-white font-display">Asesor Legal Jarvis</h3>
            <p className="text-xs text-brand-purple-light font-body">Pregúntame sobre el contrato</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                m.role === 'user' 
                  ? 'bg-brand-purple text-white rounded-br-none' 
                  : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 p-3 rounded-2xl rounded-bl-none border border-white/5">
                <Loader2 className="w-4 h-4 animate-spin text-brand-purple" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-brand-purple/20">
          <form onSubmit={handleSubmit} className="relative">
            <input 
              value={input}
              onChange={handleInputChange}
              placeholder="Ej: ¿Qué pasa con mis datos si me voy?"
              className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-brand-purple/50"
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple-light disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
      
    </div>
  );
}
