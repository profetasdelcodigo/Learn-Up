"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Menu,
  PlusCircle,
  Trash2,
} from "lucide-react";
import BackButton from "@/components/BackButton";
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
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSessions = async () => {
    const data = await getAiSessions(aiType);
    setSessions(data);
    if (data.length > 0 && !currentSessionId) {
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

    let sessionId = currentSessionId;
    let newSession = false;

    if (!sessionId) {
      const { session } = await createAiSession(
        aiType,
        input.trim().substring(0, 30) || "Sesión con Archivo",
      );
      if (session) {
        sessionId = session.id;
        setCurrentSessionId(session.id);
        newSession = true;
      }
    }

    if (!sessionId) {
      setError("Error al crear sesión.");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setError("");
    setLoading(true);

    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    // Upload file if exists
    if (file) {
      setUploadingMedia(true);
      mediaType = getMediaType(file);
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

    // Update UI instantly
    const newUserMsg: Message = {
      role: "user",
      content: userMessage,
      media_url: mediaUrl,
      media_type: mediaType,
    };
    setMessages((prev) => [...prev, newUserMsg]);

    // Save user message to DB
    await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);

    try {
      // Exclude media info from history sent to Groq
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
        // Save assistant message to DB
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
        loadSessions();
        router.refresh(); // Refresh Next.js server components if needed
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col md:flex-row">
      {/* Sidebar History (Desktop) */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 transform ${showHistory ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-brand-gold" /> Historial
          </h3>
          <button
            className="md:hidden text-gray-400"
            onClick={() => setShowHistory(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <button
            onClick={handleNewSession}
            className="w-full py-2.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-xl hover:bg-brand-gold hover:text-black transition-all flex items-center justify-center gap-2 mb-4 font-semibold text-sm"
          >
            <PlusCircle className="w-4 h-4" /> Nueva Sesión
          </button>
          <div className="space-y-2 max-h-[calc(100vh-140px)] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">
                No hay sesiones previas
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSessionMessages(s.id)}
                  className={`p-3 rounded-xl cursor-pointer flex justify-between items-center group transition-colors ${currentSessionId === s.id ? "bg-gray-800 border border-gray-700" : "hover:bg-gray-800/50"}`}
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
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-brand-black/90 backdrop-blur-md z-30">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden text-gray-400 hover:text-white"
              onClick={() => setShowHistory(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <BackButton />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center">
                {icon}
              </div>
              <div>
                <h1 className="font-bold text-white leading-tight">{title}</h1>
                <p className="text-xs text-brand-gold">{subtitle}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <div className="w-20 h-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                {icon}
              </div>
              <p className="max-w-md">
                Comienza a chatear. También puedes subir imágenes, audios o
                documentos PDF.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id || index}
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
                    {message.content}
                  </p>
                )}
              </div>
            </div>
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

        {/* Error */}
        {error && (
          <div className="px-4">
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm mb-2">
              {error}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-800 bg-brand-black">
          {file && (
            <div className="mb-3 flex items-center gap-2 p-2 bg-gray-900 rounded-xl border border-brand-gold/30 inline-flex">
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
                className="text-gray-400 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 relative">
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
              className="p-3 rounded-full bg-gray-900 text-gray-400 hover:text-brand-gold hover:bg-gray-800 transition-colors flex-shrink-0 border border-gray-800 items-center justify-center flex"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={loading || uploadingMedia}
              className="flex-1 px-5 py-3.5 bg-gray-900 border border-gray-800 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || uploadingMedia || (!input.trim() && !file)}
              className="px-5 py-3 bg-brand-gold text-brand-black rounded-full hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 font-bold"
            >
              {loading || uploadingMedia ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
