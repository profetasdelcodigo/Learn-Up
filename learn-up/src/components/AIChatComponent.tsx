"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Loading from "@/app/loading";
import {
  Send,
  Loader2,
  Paperclip,
  X,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Bot,
  PlusCircle,
  Trash2,
  History,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  getAiSessions,
  getAiMessages,
  createAiSession,
  addAiMessage,
  deleteAiSession,
} from "@/actions/ai-history";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  media_url?: string;
  media_type?: string;
}

interface AIChatProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  aiType: string;
  onSubmitAction: (
    message: string,
    history: { role: "user" | "assistant"; content: string }[],
    mediaUrl?: string,
    mediaType?: string,
  ) => Promise<{ response: string; error?: string }>;
}

export default function AIChatComponent({
  title,
  subtitle,
  icon,
  aiType,
  onSubmitAction,
}: AIChatProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadSessions(false); // Do not load last session messages automatically
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSessions = async (shouldLoadMessages: boolean = true) => {
    const data = await getAiSessions(aiType);
    setSessions(data);
    if (shouldLoadMessages && data.length > 0 && !currentSessionId) {
      loadSessionMessages(data[0].id);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]);
    setLoading(true);
    const msgs = await getAiMessages(sessionId);
    setMessages(msgs);
    setShowHistory(false);
    setLoading(false);
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteAiSession(id);
    if (currentSessionId === id) handleNewSession();
    loadSessions();
  };

  const getMediaType = (file: File) => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !file) || loading) return;

    const userMessage = input.trim();
    if (!userMessage && !file) return;

    const mediaType = file ? getMediaType(file) : undefined;
    const clientSideUserMsg: Message = {
      role: "user",
      content: userMessage,
      media_url: file ? URL.createObjectURL(file) : undefined,
      media_type: mediaType,
    };
    setMessages((prev) => [...prev, clientSideUserMsg]);
    setInput("");
    setError("");
    setLoading(true);

    let sessionId = currentSessionId;
    let newSession = false;

    if (!sessionId) {
      try {
        const { session, error: sErr } = await createAiSession(
          aiType,
          userMessage.substring(0, 30) || "Nueva Sesión",
        );
        if (sErr) throw new Error(sErr);
        if (session) {
          sessionId = session.id;
          setCurrentSessionId(session.id);
          newSession = true;
        }
      } catch (err: any) {
        setError("Error al iniciar sesión de IA. Verifica tu conexión.");
        setLoading(false);
        return;
      }
    }

    if (!sessionId) {
      setError("Error al crear sesión.");
      setLoading(false);
      return;
    }

    let mediaUrl: string | undefined;

    if (file) {
      setUploadingMedia(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("ai_media")
          .upload(filePath, file);
        if (!uploadErr) {
          const { data } = supabase.storage
            .from("ai_media")
            .getPublicUrl(filePath);
          mediaUrl = data.publicUrl;
        }
      }

      setUploadingMedia(false);
      setFile(null);
    }

    await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);

    try {
      const historyForGroq = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await onSubmitAction(
        userMessage,
        historyForGroq,
        mediaUrl,
        mediaType,
      );

      if (result.error) {
        setError(result.error);
      } else if (result.response) {
        await addAiMessage(sessionId, "assistant", result.response);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.response },
        ]);
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.");
    } finally {
      if (newSession) {
        loadSessions(false);
      }
      setLoading(false);
    }
  };

  // Removed abrupt return to allow AnimatePresence to handle it

  return (
    <AnimatePresence mode="wait">
      {initialLoading ? (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100"
        >
          <Loading />
        </motion.div>
      ) : (
        <motion.div
          key="ai-chat-main"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-brand-black flex flex-col w-full"
          style={{ height: "100dvh", overflow: "hidden" }}
        >
          {/* ──────────────────── HEADER ──────────────────── */}
          <div
            className="shrink-0 relative flex items-center justify-between px-4 border-b border-gray-800/80 bg-brand-black/95 backdrop-blur-xl z-30"
            style={{
              paddingTop: "0.75rem",
              paddingBottom: "0.75rem",
            }}
          >
            {/* LEFT: Back button */}
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-brand-gold/40 transition-all shrink-0"
              aria-label="Volver"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* CENTER: AI info */}
            <div className="flex flex-col items-center flex-1 px-3 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <h1 className="font-bold text-white text-sm leading-tight truncate">
                  {title}
                </h1>
              </div>
              <p className="text-[11px] text-brand-gold/80 mt-0.5">
                {subtitle}
              </p>
            </div>

            {/* RIGHT: History */}
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all shrink-0 ${
                showHistory
                  ? "bg-brand-gold text-brand-black border-brand-gold"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:border-brand-gold/40 hover:text-white"
              }`}
              aria-label="Historial"
            >
              <History className="w-5 h-5" />
            </button>
          </div>

          {/* ──────────────────── HISTORY DRAWER ──────────────────── */}
          <AnimatePresence>
            {showHistory && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 z-20"
                  onClick={() => setShowHistory(false)}
                />
                {/* Drawer from right */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 300 }}
                  className="fixed top-0 right-0 h-full w-72 bg-gray-950 border-l border-gray-800 z-30 flex flex-col"
                  style={{
                    paddingTop: "calc(env(safe-area-inset-top) + 0rem)",
                  }}
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                      <Bot className="w-4 h-4 text-brand-gold" /> Historial
                    </h3>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-3">
                    <button
                      onClick={handleNewSession}
                      className="w-full py-2.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-xl hover:bg-brand-gold hover:text-black transition-all flex items-center justify-center gap-2 mb-3 font-semibold text-sm"
                    >
                      <PlusCircle className="w-4 h-4" /> Nueva Sesión
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
                    {sessions.length === 0 ? (
                      <p className="text-gray-500 text-xs text-center py-4">
                        No hay sesiones previas
                      </p>
                    ) : (
                      sessions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => loadSessionMessages(s.id)}
                          className={`p-3 rounded-xl cursor-pointer flex justify-between items-center group transition-colors ${
                            currentSessionId === s.id
                              ? "bg-gray-800 border border-gray-700"
                              : "hover:bg-gray-800/50"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="text-sm text-white truncate font-medium">
                              {s.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(s.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ──────────────────── MESSAGES ──────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pb-8">
                <div className="w-20 h-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                  {icon}
                </div>
                <p className="max-w-xs text-sm">
                  Comienza a chatear. También puedes subir imágenes, audios o
                  documentos PDF.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 18, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  damping: 22,
                  stiffness: 180,
                  duration: 0.45,
                }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl ${
                    message.role === "user"
                      ? "bg-brand-gold text-brand-black rounded-tr-sm"
                      : "bg-gray-900 border border-gray-800 text-white rounded-tl-sm"
                  }`}
                >
                  {message.media_url && message.media_type === "image" && (
                    <img
                      src={message.media_url}
                      alt="Upload"
                      className="w-full max-w-sm rounded-xl mb-3 border border-brand-gold/20"
                    />
                  )}
                  {message.media_url && message.media_type !== "image" && (
                    <div className="flex items-center gap-2 p-3 bg-black/20 rounded-xl mb-3 border border-black/10">
                      {message.media_type === "audio" ? (
                        <Music className="w-5 h-5" />
                      ) : message.media_type === "video" ? (
                        <Video className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                      <span className="text-sm font-semibold truncate">
                        Archivo Adjunto
                      </span>
                    </div>
                  )}
                  {message.content && (
                    <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                      {message.role === "assistant"
                        ? message.content.replace(/\*\*/g, "").replace(/\*/g, "")
                        : message.content}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 rounded-tl-sm">
                  <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ──────────────────── ERROR ──────────────────── */}
          {error && (
            <div className="shrink-0 px-4">
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm mb-2">
                {error}
              </div>
            </div>
          )}

          {/* ──────────────────── INPUT AREA ──────────────────── */}
          <div
            className="shrink-0 bg-brand-black/95 backdrop-blur-xl border-t border-gray-800/80 px-4 pt-3"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            {file && (
              <div className="mb-3 flex items-center gap-2 p-2 bg-gray-900 rounded-xl border border-brand-gold/30">
                {getMediaType(file) === "image" ? (
                  <ImageIcon className="w-4 h-4 text-brand-gold" />
                ) : (
                  <FileText className="w-4 h-4 text-brand-gold" />
                )}
                <span className="text-sm text-white truncate max-w-[200px]">
                  {file.name}
                </span>
                <button
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-red-400 ml-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.mp4"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-full bg-gray-900 text-gray-400 hover:text-brand-gold hover:bg-gray-800 transition-colors shrink-0 border border-gray-800 flex items-center justify-center"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                disabled={loading || uploadingMedia}
                className="flex-1 min-w-0 px-4 py-3.5 bg-gray-900 border border-gray-800 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors disabled:opacity-50 text-sm"
              />
              <button
                type="submit"
                disabled={loading || uploadingMedia || (!input.trim() && !file)}
                className="px-4 py-3 bg-brand-gold text-brand-black rounded-full hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 font-bold"
              >
                {loading || uploadingMedia ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
