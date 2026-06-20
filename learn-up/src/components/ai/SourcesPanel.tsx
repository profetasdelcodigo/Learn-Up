"use client";

import { useState, useEffect } from "react";
import { History, PlusCircle, Trash2, Bot, FileText, UploadCloud } from "lucide-react";
import { getAiSessions, deleteAiSession, createAiSession } from "@/actions/ai-history";

interface SourcesPanelProps {
  aiType: string;
  currentSessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
}

export default function SourcesPanel({ aiType, currentSessionId, onSessionChange }: SourcesPanelProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    const data = await getAiSessions(aiType);
    setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, [aiType]);

  const handleNewSession = async () => {
    // If we want to create it immediately:
    const { session, error } = await createAiSession(aiType, "Nueva Sesión");
    if (session) {
      await loadSessions();
      onSessionChange(session.id);
    } else {
      // Falback to just clearing currentSessionId
      onSessionChange(null);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteAiSession(id);
    if (currentSessionId === id) {
      onSessionChange(null);
    }
    loadSessions();
  };

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* Header */}
      <div 
        className="flex items-center gap-2 px-4 pb-3 border-b border-white/10 shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Bot className="w-5 h-5 text-brand-gold" />
        <h2 className="font-bold text-white text-sm">Entorno y Memoria</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-3 gap-6">
        
        {/* Fuentes / Documentos Section */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Fuentes
            </h3>
          </div>
          
          <div className="space-y-2">
            {/* Placeholder for uploaded documents */}
            {currentSessionId ? (
              <div className="border border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand-gold/20 group-hover:text-brand-gold transition-colors">
                  <UploadCloud className="w-4 h-4 text-gray-500 group-hover:text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs text-gray-300 font-medium">Subir Material</p>
                  <p className="text-[10px] text-gray-500">PDF, TXT, Imágenes</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white/5 rounded-xl text-xs text-gray-500 text-center border border-white/5">
                Crea un chat para subir fuentes
              </div>
            )}
          </div>
        </section>

        {/* Historial de Sesiones Section */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Chats Guardados
            </h3>
            <button 
              onClick={handleNewSession}
              className="p-1 rounded-md hover:bg-brand-gold/20 text-brand-gold transition-colors"
              title="Nuevo Chat"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-gray-500 text-xs text-center py-4 animate-pulse">Cargando...</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">No hay sesiones previas</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onSessionChange(s.id)}
                  className={`p-3 rounded-xl cursor-pointer flex justify-between items-center group transition-colors ${
                    currentSessionId === s.id
                      ? "bg-surface-2 border border-brand-gold/30"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className={`text-sm truncate font-medium ${currentSessionId === s.id ? "text-brand-gold" : "text-gray-300 group-hover:text-white"}`}>
                      {s.title || "Sesión sin título"}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/10"
                    title="Eliminar sesión"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
