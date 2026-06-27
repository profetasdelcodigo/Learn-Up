"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
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
  ExternalLink,
  Calendar,
  MessageSquare,
  Search,
  UserCog,
  Check,
  XCircle,
  Share2,
  Copy,
  User,
  ToggleLeft,
  ToggleRight,
  BrainCircuit,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ShareButton from "./ShareButton";
import { type SharePayload } from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  getAiSessions,
  getAiMessages,
  createAiSession,
  addAiMessage,
  deleteAiSession,
} from "@/actions/ai-history";
import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";

interface ToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
  requiresConfirm: boolean;
}

function getSafeExternalUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;

  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function downloadTextArtifact(title: string, content: string) {
  const safeTitle = (title || "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "documento";
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function AIMessageContent({ text }: { text: string }) {
  // Manejo de bloques de pensamiento <thinking> ... </thinking>
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/;
  const matchThinking = text.match(thinkingRegex);
  
  let mainText = text;
  let thinkingContent = null;
  
  if (matchThinking) {
    thinkingContent = matchThinking[1].trim();
    mainText = text.replace(thinkingRegex, "").trim();
  }

  const nodes: ReactNode[] = [];
  const tokenRegex =
    /!\[([^\]]*)\]\(([^)]*)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s<]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${match.index}-${tokenRegex.lastIndex}`;

    if (match[2]) {
      const safeUrl = getSafeExternalUrl(match[2]);
      if (safeUrl) {
        nodes.push(
          <img
            key={key}
            src={safeUrl}
            alt={match[1] || "Imagen"}
            className="rounded-xl max-w-full my-2 border border-white/10"
            style={{ maxHeight: 300 }}
          />,
        );
      }
    } else if (match[4]) {
      const safeUrl = getSafeExternalUrl(match[4]);
      nodes.push(
        safeUrl ? (
          <a
            key={key}
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold hover:underline inline-flex items-center gap-1"
          >
            {match[3]} -&gt;
          </a>
        ) : (
          match[3]
        ),
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={key} className="text-white font-semibold">
          {match[5]}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(<em key={key}>{match[6]}</em>);
    } else if (match[7]) {
      const safeUrl = getSafeExternalUrl(match[7]);
      nodes.push(
        safeUrl ? (
          <a
            key={key}
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold hover:underline"
          >
            {match[7]} -&gt;
          </a>
        ) : (
          match[7]
        ),
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < mainText.length) {
    nodes.push(mainText.slice(lastIndex));
  }

  return (
    <>
      {thinkingContent && (
        <details className="mb-4 bg-black/20 border border-white/5 rounded-xl overflow-hidden group/thinking">
          <summary className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer hover:bg-white/5 transition flex items-center gap-2 select-none list-none [&::-webkit-details-marker]:hidden">
            <BrainCircuit className="w-4 h-4 text-brand-gold group-open/thinking:animate-none animate-pulse" />
            <span className="flex-1">Proceso de Pensamiento</span>
            <ChevronLeft className="w-4 h-4 -rotate-90 group-open/thinking:rotate-90 transition-transform" />
          </summary>
          <div className="p-4 border-t border-white/5 text-xs font-mono text-gray-400 whitespace-pre-wrap leading-relaxed">
            {thinkingContent}
          </div>
        </details>
      )}
      {nodes}
    </>
  );
}

// shareAIMessage removed in favor of ShareButton

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  media_url?: string;
  media_type?: string;
  tool_calls?: ToolAction[];
}

interface AIChatProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  aiType: string;
  onSubmitAction: (
    message: string,
    history: { role: "user" | "assistant"; content: string }[],
    mediaUrl?: string,
    mediaType?: string,
  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;
  className?: string;
  containerStyle?: React.CSSProperties;
  onMessagesChange?: (messages: Message[]) => void;
  currentSessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
}

export default function AIChatComponent({
  title,
  subtitle,
  icon,
  aiType,
  onSubmitAction,
  className,
  containerStyle,
  onMessagesChange,
  currentSessionId,
  onSessionChange,
}: AIChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (onMessagesChange) onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pendingActions, setPendingActions] = useState<ToolAction[]>([]);
  const [executingAction, setExecutingAction] = useState(false);
  const [isAutonomous, setIsAutonomous] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Mini-mensajes dinámicos durante la carga (contextuales)
  const [hasFileAttached, setHasFileAttached] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingMessage("");
      return;
    }

    const textMessages = [
      "Pensando...",
      "Preparando respuesta...",
      "Casi listo...",
    ];

    const defaultMessages = [
      "Analizando tu mensaje...",
      "Procesando...",
      "Escribiendo respuesta...",
      "Casi listo...",
    ];

    const fileMessages = [
      "Procesando tu archivo...",
      "Analizando el contenido...",
      "Extrayendo información...",
      "Generando respuesta...",
    ];

    const msgs = hasFileAttached ? fileMessages : defaultMessages;
    let currentIndex = 0;
    setLoadingMessage(msgs[0]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % msgs.length;
      setLoadingMessage(msgs[currentIndex]);
    }, 2000);

    return () => clearInterval(interval);
  }, [loading, hasFileAttached]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSessionMessages = async (sessionId: string) => {
    setMessages([]);
    setLoading(true);
    const msgs = await getAiMessages(sessionId);
    setMessages(msgs);
    setLoading(false);
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

    // Respaldar estados locales por si falla el envío
    const backupInput = input;
    const backupFile = file;

    // Auto-generar mensaje si solo hay archivo sin texto
    let userMessage = input.trim();
    if (!userMessage && file) {
      const mType = getMediaType(file);
      if (mType === "image") userMessage = "Analiza esta imagen.";
      else if (mType === "audio") userMessage = "Transcribe y analiza este audio.";
      else if (mType === "video") userMessage = "Analiza este video.";
      else userMessage = "Analiza este documento.";
    }
    if (!userMessage && !file) return;

    const mediaType = file ? getMediaType(file) : undefined;
    const clientSideUserMsg: Message = {
      role: "user",
      content: userMessage,
      media_url: file ? URL.createObjectURL(file) : undefined,
      media_type: mediaType,
    };

    const handleFailure = (errMessage: string) => {
      setError(errMessage);
      setInput(backupInput);
      setFile(backupFile);
      if (fileInputRef.current) {
        try {
          if (backupFile) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(backupFile);
            fileInputRef.current.files = dataTransfer.files;
          } else {
            fileInputRef.current.value = "";
          }
        } catch (e) {
          fileInputRef.current.value = "";
        }
      }
      setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));
      setLoading(false);
      setUploadingMedia(false);
    };

    setMessages((prev) => [...prev, clientSideUserMsg]);
    setInput("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    setError("");
    setHasFileAttached(!!file);
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
          onSessionChange(session.id);
          newSession = true;
        }
      } catch (err: any) {
        handleFailure("Error al iniciar sesión de IA. Verifica tu conexión.");
        return;
      }
    }

    if (!sessionId) {
      handleFailure("Error al crear sesión.");
      return;
    }

    let mediaUrl: string | undefined;

    if (backupFile) {
      setUploadingMedia(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("No autenticado");

        const safeFileName = backupFile.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(-120);
        const filePath = `${user.id}/${Date.now()}_${safeFileName}`;
        const { error: uploadErr } = await supabase.storage
          .from("ai_media")
          .upload(filePath, backupFile);
        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage
          .from("ai_media")
          .getPublicUrl(filePath);
        mediaUrl = data.publicUrl;

        const indexResult = await indexAiDocumentFromUrl({
          title: backupFile.name,
          url: mediaUrl,
          mimeType: backupFile.type,
          sessionId,
        });
        if (!indexResult.success) {
          console.warn("AI document indexing skipped:", indexResult.error);
        }

        setMessages((prev) => 
          prev.map(m => m === clientSideUserMsg ? { ...m, media_url: mediaUrl } : m)
        );
      } catch (uploadErr: any) {
        handleFailure("Error al subir el archivo adjunto. Intenta de nuevo.");
        return;
      }
      setUploadingMedia(false);
    }

    try {
      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);
    } catch (msgErr: any) {
      handleFailure("Error al guardar tu mensaje en la base de datos.");
      return;
    }

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
        handleFailure(result.error);
      } else if (result.response) {
        await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.response, tool_calls: result.executedActions },
        ]);

        if (result.actions && result.actions.length > 0) {
          if (isAutonomous) {
            // Auto-execute if in Pilot mode
            result.actions.forEach(action => {
               // Fire and forget or handle properly
               setTimeout(() => handleConfirmAction(action), 500);
            });
          } else {
            setPendingActions(result.actions);
          }
        }
      }
    } catch (err) {
      handleFailure("Ocurrió un error inesperado al procesar la IA.");
    } finally {
      setLoading(false);
    }
  };

  // ── Manejar confirmación/rechazo de acciones de IA ────────────────────────
  const handleConfirmAction = async (action: ToolAction) => {
    setExecutingAction(true);
    let actionResult: any = null;
    try {
      if (action.tool === "open_url") {
        const safeUrl = getSafeExternalUrl(action.args.url);
        if (!safeUrl) throw new Error("URL no permitida");
        window.open(safeUrl, "_blank", "noopener,noreferrer");
        const msg = `Abriendo: ${action.args.title || safeUrl}`;
        if (currentSessionId) await addAiMessage(currentSessionId, "assistant", msg, undefined, undefined, [action]);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: msg, tool_calls: [action] },
        ]);
      } else if (action.tool === "trigger_jarvis") {
        window.dispatchEvent(new CustomEvent("triggerJarvis", { 
          detail: { message: `Fui invocado por ${title}. ${action.args.reason || '¿En qué puedo ayudarte?'}` } 
        }));
        const msg = `He llamado a Jarvis para que se encargue de esto.`;
        if (currentSessionId) await addAiMessage(currentSessionId, "assistant", msg, undefined, undefined, [action]);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: msg, tool_calls: [action] },
        ]);
      } else {
        actionResult = await confirmAndExecuteTool(action.tool, action.args);
        
        // Manejar sugerencias si hay múltiples coincidencias
        if (!actionResult.success && actionResult.data?.suggestions) {
            if (currentSessionId) await addAiMessage(currentSessionId, "assistant", actionResult.message);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: actionResult.message },
            ]);
            // Convertimos las sugerencias en botones de acción temporales
            const suggestionActions = actionResult.data.suggestions.map((s: any) => ({
                tool: action.tool,
                args: { ...action.args, recipient_id: s.id, recipient_type: s.type, recipient_name: s.name },
                description: `Enviar a: ${s.name} (${s.type})`,
                requiresConfirm: false
            }));
            setPendingActions(suggestionActions);
        } else {
            if (
              actionResult.success &&
              (action.tool === "generate_document" || action.tool === "create_exam") &&
              typeof actionResult.data?.content === "string"
            ) {
              downloadTextArtifact(
                actionResult.data.title || action.args.title || action.args.topic || "documento",
                actionResult.data.content,
              );
            }
            if (currentSessionId) await addAiMessage(currentSessionId, "assistant", actionResult.message, undefined, undefined, [action]);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: actionResult.message, tool_calls: [action] },
            ]);
        }
      }
    } catch (err) {
      setError("Error al ejecutar la acción.");
    } finally {
      setExecutingAction(false);
      // No limpiamos pendingActions si hay sugerencias, ya que las usamos para renderizar botones
      if (!actionResult?.data?.suggestions) setPendingActions([]);
    }
  };

  const handleRejectAction = async () => {
    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";
    if (currentSessionId) await addAiMessage(currentSessionId, "assistant", msg);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: msg },
    ]);
    setPendingActions([]);
  };

  const handleOptionSelect = async (option: string) => {
    setPendingActions([]);
    if (loading) return;

    const clientSideUserMsg: Message = { role: "user", content: option };
    setMessages((prev) => [...prev, clientSideUserMsg]);
    setLoading(true);

    let sessionId = currentSessionId;
    let newSession = false;

    if (!sessionId) {
      try {
        const { session, error: sErr } = await createAiSession(aiType, option.substring(0, 30) || "Nueva Sesión");
        if (sErr) throw new Error(sErr);
        if (session) {
          sessionId = session.id;
          onSessionChange(session.id);
          newSession = true;
        }
      } catch (err: any) {
        setError("Error al iniciar sesión.");
        setLoading(false);
        return;
      }
    }

    if (!sessionId) {
      setError("No se pudo obtener la sesión.");
      setLoading(false);
      return;
    }

    try {
      await addAiMessage(sessionId, "user", option);
      const historyForGroq = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await onSubmitAction(option, historyForGroq, undefined, undefined);

      if (result.error) {
        setError(result.error);
      } else if (result.response) {
        await addAiMessage(sessionId, "assistant", result.response);
        setMessages((prev) => [...prev, { role: "assistant", content: result.response }]);
        if (result.actions && result.actions.length > 0) {
          setPendingActions(result.actions);
        }
      }
    } catch (err) {
      setError("Error inesperado al procesar la opción.");
    } finally {
      setLoading(false);
    }
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "open_url": return <ExternalLink className="w-4 h-4" />;
      case "add_calendar_event": return <Calendar className="w-4 h-4" />;
      case "send_message": return <MessageSquare className="w-4 h-4" />;
      case "search_library": return <Search className="w-4 h-4" />;
      case "update_profile": return <UserCog className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  // Removed abrupt return to allow AnimatePresence to handle it

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="ai-chat-main"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex flex-col relative z-10 w-full h-full ${className || ''}`}
        style={containerStyle}
      >
        {/* ──────────────────── HEADER ──────────────────── */}
        <div
          className="shrink-0 relative flex items-center justify-between px-4 bg-surface-2/40 backdrop-blur-xl z-30"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
            paddingBottom: "0.75rem",
          }}
        >
            {/* LEFT: Back button */}
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-2 border border-white/6 text-gray-400 hover:text-white hover:border-brand-gold/40 transition-all shrink-0"
              aria-label="Volver"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* CENTER: AI info */}
            <div className="flex flex-col items-center flex-1 px-3 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold shrink-0">
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

            {/* RIGHT: Autonomy Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 border border-white/5 shrink-0">
              <span className="text-[10px] text-gray-400 font-medium hidden md:inline">
                Piloto Automático
              </span>
              <button
                onClick={() => setIsAutonomous(!isAutonomous)}
                className="text-brand-gold transition-transform hover:scale-105"
                title="Permitir que la IA ejecute herramientas sin preguntar"
              >
                {isAutonomous ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {/* ──────────────────── MESSAGES ──────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-surface-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pb-8">
                <div className="w-20 h-20 rounded-3xl bg-surface-2 shadow-2xl border border-white/6 flex items-center justify-center mb-6 text-brand-gold">
                  {icon}
                </div>
                <h2 className="text-xl font-medium text-white mb-2">¿En qué puedo ayudarte?</h2>
                <p className="max-w-sm text-sm">
                  Comienza a chatear. Puedes activar el Piloto Automático para que tome acciones por ti o subir documentos para análisis profundo.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  damping: 22,
                  stiffness: 180,
                  duration: 0.45,
                }}
                className={`flex flex-col w-full max-w-4xl mx-auto group ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                {message.role === "user" ? (
                  /* USER MESSAGE (Clean gray block) */
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-[85%] md:max-w-[70%]">
                    <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-medium">
                      <User className="w-3 h-3" /> Tú
                    </div>
                    {message.media_url && message.media_type === "image" && (
                      <img
                        src={message.media_url}
                        alt="Upload"
                        className="w-full rounded-xl mb-3 border border-white/10"
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
                    <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed text-gray-200">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  /* AI MESSAGE (Notion/Claude style block) */
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-3 text-brand-gold text-xs font-semibold uppercase tracking-wider">
                      <Bot className="w-3 h-3" /> {title}
                    </div>
                    <div className="prose-ai text-gray-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words [&_a]:text-brand-gold [&_a]:hover:underline [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-2 [&_img]:border [&_img]:border-white/10 [&_strong]:text-white [&_strong]:font-semibold">
                      <AIMessageContent text={message.content} />
                    </div>
                    {message.tool_calls && message.tool_calls.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {message.tool_calls.map((tc, idx) => (
                           <div key={idx} className="flex items-center gap-3 p-3 bg-black/20 border border-brand-gold/20 rounded-xl text-xs text-gray-300">
                             <div className="bg-brand-gold/10 p-1.5 rounded-lg border border-brand-gold/20">
                               <BrainCircuit className="w-4 h-4 text-brand-gold" />
                             </div>
                             <div>
                               <div className="font-semibold text-brand-gold uppercase tracking-wider text-[10px] mb-0.5">Herramienta Ejecutada</div>
                               <div className="font-medium">{tc.description || tc.tool}</div>
                             </div>
                           </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ShareButton
                        payload={{
                          title: "Respuesta de IA",
                          text: message.content.slice(0, 300) + (message.content.length > 300 ? "..." : ""),
                          type: "text"
                        }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-2 rounded-2xl p-4 rounded-tl-sm flex items-center gap-3">
                  <div className="flex items-center gap-1 opacity-70">
                    <div className="w-2 h-2 bg-brand-gold rounded-full" style={{ animation: 'typing-dot 1.4s infinite ease-in-out both' }} />
                    <div className="w-2 h-2 bg-brand-gold rounded-full" style={{ animation: 'typing-dot 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-brand-gold rounded-full" style={{ animation: 'typing-dot 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                  </div>
                  <motion.span 
                    key={loadingMessage}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-sm text-gray-400 font-medium ml-1"
                  >
                    {loadingMessage}
                  </motion.span>
                </div>
              </div>
            )}

            {/* ──── Tarjetas de confirmación de acciones y SUGERENCIAS ──── */}
            {(pendingActions.length > 0 || (messages[messages.length - 1]?.role === 'assistant' && (messages[messages.length - 1]?.content.includes('He encontrado varios') || messages[messages.length - 1]?.content.includes('similares')))) && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] md:max-w-[70%] space-y-2">
                  {pendingActions.map((action, i) => {
                    if (action.tool === "ask_multiple_choice") {
                      return (
                        <div key={i} className="bg-surface-2/80 backdrop-blur-md rounded-2xl p-4 md:p-5 rounded-tl-sm shadow-xl border border-white/10 flex flex-col gap-3 min-w-[280px]">
                          <p className="text-sm md:text-base font-semibold text-white leading-tight">{action.args.question || "¿Qué opción eliges?"}</p>
                          <div className="flex flex-col gap-2 mt-2">
                            {action.args.options?.map((opt: string, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => handleOptionSelect(opt)}
                                className="w-full text-left py-2.5 px-4 bg-white/5 hover:bg-brand-gold/10 text-gray-200 hover:text-brand-gold rounded-xl text-sm transition-all border border-white/5 hover:border-brand-gold/30 flex items-center gap-3 group"
                              >
                                <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:bg-brand-gold/20 group-hover:text-brand-gold transition-colors">{idx + 1}</span>
                                {opt}
                              </button>
                            ))}
                            {action.args.allow_skip !== false && (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => handleOptionSelect("Omitir")}
                                  className="flex-1 text-center py-2 text-xs font-medium text-gray-500 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                >
                                  Omitir
                                </button>
                                <button
                                  onClick={() => handleOptionSelect("Otra opción no listada")}
                                  className="flex-1 text-center py-2 text-xs font-medium text-gray-500 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                >
                                  Otro
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                    <div
                      key={i}
                      className="bg-surface-2 rounded-2xl p-4 rounded-tl-sm shadow-lg border border-white/5"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold">
                          {getToolIcon(action.tool)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">¿Realizar esta acción?</p>
                          <p className="text-xs text-gray-400">{action.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmAction(action)}
                          disabled={executingAction}
                          className="flex-1 py-2 px-3 bg-brand-gold text-brand-black rounded-xl font-semibold text-sm hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {executingAction ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Check className="w-4 h-4" /> Aceptar</>
                          )}
                        </button>
                        <button
                          onClick={handleRejectAction}
                          disabled={executingAction}
                          className="flex-1 py-2 px-3 bg-surface-2 text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" /> Cancelar
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </motion.div>
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
            className="shrink-0 bg-brand-black/95 backdrop-blur-xl px-4 pt-3"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            {file && (
              <div className="mb-3 flex items-center gap-2 p-2 bg-surface-2 rounded-xl">
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
                id="ai-chat-file-input"
                name="ai-chat-file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.doc,.docx,.pptx,.xlsx,.txt"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-full bg-surface-2 text-gray-400 hover:text-brand-gold hover:bg-white/5 transition-colors shrink-0 flex items-center justify-center"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                id="ai-chat-message-input"
                name="ai-chat-message"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                disabled={loading || uploadingMedia}
                className="flex-1 min-w-0 px-4 py-3.5 bg-surface-2 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors disabled:opacity-50 text-sm shadow-inner"
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
    </AnimatePresence>
  );
}
