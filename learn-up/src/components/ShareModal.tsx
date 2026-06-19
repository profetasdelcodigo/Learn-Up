"use client";

import { useAtom } from "jotai";
import { shareModalOpenAtom, sharePayloadAtom } from "@/lib/store";
import { useState, useEffect } from "react";
import { X, Send, Copy, Share2, MessageSquare, Bot } from "lucide-react";
import { getUserRooms, sendMessage } from "@/actions/chat";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function ShareModal() {
  const [isOpen, setIsOpen] = useAtom(shareModalOpenAtom);
  const [payload, setPayload] = useAtom(sharePayloadAtom);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen]);

  const loadRooms = async () => {
    setLoadingRooms(true);
    const rooms = await getUserRooms();
    if (rooms) setRooms(rooms);
    setLoadingRooms(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setPayload(null), 300);
  };

  const generateMessageContent = () => {
    if (!payload) return "";
    let content = `¡Mira esto!\n\n**${payload.title}**\n${payload.text}`;
    if (payload.url) {
      // Usar la URL directa, si es Learn Up se renderizará como enlace, si es WhatsApp tomará los metadatos
      content += `\n\n${payload.url}`; 
    }
    return content;
  };

  const shareToRoom = async (roomId: string) => {
    setLoading(true);
    const content = generateMessageContent();
    const res = await sendMessage(roomId, content);
    setLoading(false);
    if (res.success) {
      alert("Enviado con éxito");
      handleClose();
    } else {
      alert("Error al enviar: " + res.error);
    }
  };

  const shareToAI = async (agent: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Inyectar en el chat de IA (esto asume que guardamos el historial local o en BD)
      // Como el chat de IA es local en session storage mayormente, lo más seguro es redirigir a la URL de la IA con query params
      const content = encodeURIComponent(generateMessageContent());
      window.location.href = `/ai/${agent}?share=${content}`;
      handleClose();
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    const content = generateMessageContent();
    await navigator.clipboard.writeText(content);
    alert("¡Copiado al portapapeles!");
  };

  const nativeShare = async () => {
    if (navigator.share && payload) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url || window.location.href,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    }
  };

  if (!isOpen || !payload) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h3 className="text-lg font-medium text-amber-50 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-500" />
              Compartir
            </h3>
            <button onClick={handleClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
            
            {/* Vista Previa */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p className="font-medium text-amber-200">{payload.title}</p>
              <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{payload.text}</p>
            </div>

            {/* Opciones Rápidas Externas */}
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="flex-1 flex flex-col items-center justify-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700"
              >
                <Copy className="w-5 h-5 text-zinc-300" />
                <span className="text-xs text-zinc-300">Copiar Link</span>
              </button>
              
              {typeof navigator !== "undefined" && !!navigator.share && (
                <button
                  onClick={nativeShare}
                  className="flex-1 flex flex-col items-center justify-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700"
                >
                  <Share2 className="w-5 h-5 text-zinc-300" />
                  <span className="text-xs text-zinc-300">Apps Externas</span>
                </button>
              )}
            </div>

            {/* Agentes de IA */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Compartir con Inteligencia Artificial</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => shareToAI("profesor")} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-amber-900/20 hover:bg-amber-900/40 border border-amber-900/50 transition-colors">
                  <Bot className="w-6 h-6 text-amber-500" />
                  <span className="text-[10px] text-amber-200">Tutor</span>
                </button>
                <button onClick={() => shareToAI("consejero")} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-purple-900/20 hover:bg-purple-900/40 border border-purple-900/50 transition-colors">
                  <Bot className="w-6 h-6 text-purple-400" />
                  <span className="text-[10px] text-purple-200">Alma</span>
                </button>
              </div>
            </div>

            {/* Aprendamos Juntos (Chats) */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Tus Chats y Grupos</p>
              
              {loadingRooms ? (
                <div className="flex justify-center p-4">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No tienes chats activos.</p>
              ) : (
                <div className="space-y-2">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => shareToRoom(room.id)}
                      disabled={loading}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden">
                           {room.type === 'group' ? (
                             <MessageSquare className="w-4 h-4 text-zinc-400" />
                           ) : (
                             room.avatar_url ? (
                               <img src={room.avatar_url} alt="" className="w-full h-full object-cover" />
                             ) : (
                               <span className="text-sm font-medium text-zinc-400">{room.name?.charAt(0) || '?'}</span>
                             )
                           )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-zinc-200">{room.name}</p>
                          <p className="text-xs text-zinc-500">{room.type === 'group' ? 'Grupo' : 'Chat Privado'}</p>
                        </div>
                      </div>
                      <Send className="w-4 h-4 text-zinc-600 group-hover:text-amber-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
