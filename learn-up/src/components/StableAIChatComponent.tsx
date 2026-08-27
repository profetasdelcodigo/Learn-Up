"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Check,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { addAiMessage, createAiSession, getAiMessages } from "@/actions/ai-history";
import { approveStableToolAction } from "@/actions/stable-ai-agents";
import { indexAiDocumentFromUrl } from "@/actions/ai-tutor";

interface ToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
  requiresConfirm: boolean;
}

interface ChatMessage {
  id: string;
  clientMessageId?: string;
  role: "user" | "assistant";
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  status?: "sending" | "processing" | "completed" | "failed";
  actions?: ToolAction[];
  actionStates?: Record<string, "pending" | "running" | "success" | "error" | "cancelled">;
}

interface StableAIChatProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  aiType: string;
  onSubmitAction: (
    message: string,
    history?: { role: "user" | "assistant"; content: string | any[] }[],
    mediaUrl?: string,
    mediaType?: string,
    modelId?: string,
    sessionId?: string | null,
  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;
  currentSessionId?: string | null;
  onSessionChange?: (sessionId: string | null) => void;
  defaultModel?: string;
  className?: string;
}

const prettyToolName: Record<string, string> = {
  add_calendar_event: "Crear evento",
  add_habit: "Crear hábito",
  send_message: "Enviar mensaje",
  search_web: "Buscar en internet",
  advanced_web_search: "Investigación avanzada",
  browse_web_page: "Abrir página",
  search_image: "Buscar imagen",
  generate_image: "Generar imagen",
  generate_video: "Generar video",
  search_documents: "Buscar documentos",
  search_knowledge_graph: "Buscar en el Grafo",
  save_learned_concept: "Guardar concepto",
  create_exam: "Crear examen",
};

function toolLabel(tool: string) {
  return prettyToolName[tool] || tool.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function mediaKind(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

export default function StableAIChatComponent({
  title,
  subtitle,
  icon,
  aiType,
  onSubmitAction,
  currentSessionId,
  onSessionChange,
  defaultModel = "openrouter/openrouter/free",
  className = "",
}: StableAIChatProps) {
  const [sessionId, setSessionId] = useState<string | null>(currentSessionId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const endRef = useRef<HTMLDivElement>(null);
  const initialLoaded = useRef<string | null>(null);

  useEffect(() => {
    setSessionId(currentSessionId || null);
  }, [currentSessionId]);

  const loadMessages = useCallback(async (id: string) => {
    const rows = await getAiMessages(id);
    const mapped: ChatMessage[] = rows.map((row: any) => ({
      id: String(row.id),
      clientMessageId: row.client_message_id || undefined,
      role: row.role,
      content: row.content || "",
      media_url: row.media_url || undefined,
      media_type: row.media_type || undefined,
      status: "completed",
      actions: row.tool_calls || undefined,
    }));
    setMessages(mapped);
  }, []);

  useEffect(() => {
    if (!sessionId || initialLoaded.current === sessionId) return;
    initialLoaded.current = sessionId;
    void loadMessages(sessionId);
  }, [sessionId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const history = useMemo(
    () => messages.filter((m) => m.status !== "failed").slice(-10).map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    const created = await createAiSession(aiType, title);
    if (created.error || !created.session) throw new Error(created.error || "No se pudo crear la sesión");
    setSessionId(created.session.id);
    onSessionChange?.(created.session.id);
    initialLoaded.current = created.session.id;
    return created.session.id;
  }, [aiType, onSessionChange, sessionId, title]);

  const uploadFile = useCallback(async (selected: File) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no válida");
    const safeName = selected.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("ai_media").upload(path, selected, {
      contentType: selected.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
    const { data } = supabase.storage.from("ai_media").getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const send = useCallback(async () => {
    if ((!input.trim() && !file) || sending) return;
    setSending(true);
    const clientMessageId = crypto.randomUUID();
    const currentFile = file;
    const text = input.trim();
    setInput("");
    setFile(null);

    try {
      const id = await ensureSession();
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;
      let status: ChatMessage["status"] = "sending";

      if (currentFile) {
        status = "processing";
        mediaUrl = await uploadFile(currentFile);
        mediaType = currentFile.type || mediaKind(currentFile);
      }

      const optimistic: ChatMessage = {
        id: `local-${clientMessageId}`,
        clientMessageId,
        role: "user",
        content: text || `Analiza este archivo: ${currentFile?.name || "archivo adjunto"}`,
        media_url: mediaUrl,
        media_type: mediaType,
        status,
      };
      setMessages((prev) => [...prev, optimistic]);

      const persisted = await addAiMessage(id, "user", optimistic.content, mediaUrl, mediaType, undefined, clientMessageId);
      if (persisted.error) throw new Error(persisted.error);

      if (mediaUrl) {
        void indexAiDocumentFromUrl({
          title: currentFile?.name || "Archivo adjunto",
          url: mediaUrl,
          mimeType: mediaType,
          sessionId: id,
        }).catch((error) => console.warn("[MEDIA] Background indexing failed:", error));
      }

      const effectiveModel = isAutopilot ? `${model}::autopilot` : model;
      const result = await onSubmitAction(text || "Analiza el archivo adjunto.", history, mediaUrl, mediaType, effectiveModel, id);

      if (persisted.message) {
        setMessages((prev) => prev.map((item) => item.id === optimistic.id ? {
          ...item,
          id: String(persisted.message.id),
          status: "completed",
        } : item));
      }

      if (result.actions?.length) {
        const assistantMessage: ChatMessage = {
          id: `actions-${crypto.randomUUID()}`,
          role: "assistant",
          content: result.response || "Necesito tu autorización para continuar:",
          status: "completed",
          actions: result.actions,
          actionStates: Object.fromEntries(result.actions.map((action) => [action.tool, "pending"])),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (result.response) {
          void addAiMessage(id, "assistant", result.response, undefined, undefined, result.actions.map((a) => ({ tool: a.tool, args: a.args }))));
        }
      } else if (result.response || result.error) {
        const responseText = result.response || `No pude completar la solicitud: ${result.error}`;
        const assistantMessage: ChatMessage = {
          id: `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          content: responseText,
          status: result.error ? "failed" : "completed",
        };
        setMessages((prev) => [...prev, assistantMessage]);
        void addAiMessage(id, "assistant", responseText);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      setMessages((prev) => prev.map((item) =>
        item.clientMessageId === clientMessageId
          ? { ...item, status: "failed" }
          : item,
      ));
      setMessages((prev) => [...prev, {
        id: `error-${crypto.randomUUID()}`,
        role: "assistant",
        content: `No pude completar la solicitud. ${message}`,
        status: "failed",
      }]);
    } finally {
      setSending(false);
    }
  }, [ensureSession, file, history, isAutopilot, model, onSubmitAction, sending, input, uploadFile]);

  const approve = useCallback(async (messageId: string, action: ToolAction) => {
    setMessages((prev) => prev.map((message) => message.id === messageId ? {
      ...message,
      actionStates: { ...(message.actionStates || {}), [action.tool]: "running" },
    } : message));
    try {
      const result = await approveStableToolAction(action.tool, action.args);
      const success = Boolean(result?.success);
      setMessages((prev) => prev.map((message) => message.id === messageId ? {
        ...message,
        actionStates: { ...(message.actionStates || {}), [action.tool]: success ? "success" : "error" },
      } : message));
    } catch {
      setMessages((prev) => prev.map((message) => message.id === messageId ? {
        ...message,
        actionStates: { ...(message.actionStates || {}), [action.tool]: "error" },
      } : message));
    }
  }, []);

  const cancel = useCallback((messageId: string, action: ToolAction) => {
    setMessages((prev) => prev.map((message) => message.id === messageId ? {
      ...message,
      actionStates: { ...(message.actionStates || {}), [action.tool]: "cancelled" },
    } : message));
  }, []);

  return (
    <section className={`flex h-full min-h-0 flex-col bg-surface-1 ${className}`}>
      <header className="shrink-0 border-b border-border-subtle px-5 py-4 bg-surface-2/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border-subtle bg-surface-3 p-2">{icon || <Bot className="h-5 w-5" />}</div>
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setIsAutopilot((value) => !value)}
            className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${isAutopilot ? "border-brand-gold/50 bg-brand-gold/10 text-brand-gold" : "border-border-subtle text-gray-300"}`}
            aria-pressed={isAutopilot}
          >
            <Zap className="h-3.5 w-3.5" />
            {isAutopilot ? "Piloto automático" : "Modo manual"}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
          <span>Modelo</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-border-subtle bg-surface-3 px-2 py-1 text-gray-300">
            <option value="openrouter/openrouter/free">OpenRouter Free</option>
            <option value="groq/openai/gpt-oss-20b">Groq GPT OSS 20B</option>
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-md text-center text-gray-400">
              <Bot className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <p className="text-sm">{title} está listo. Puedes escribir, adjuntar archivos o pedir una acción.</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-brand-gold/10 border border-brand-gold/20 text-white" : "bg-surface-2 border border-border-subtle text-gray-100"}`}>
                  <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                  {message.media_url && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border-subtle bg-surface-3">
                      {message.media_type?.startsWith("image/") ? (
                        <img src={message.media_url} alt="Archivo adjunto" className="max-h-80 w-full object-contain" />
                      ) : (
                        <a href={message.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-sm text-brand-gold hover:underline">
                          <FileText className="h-4 w-4" /> Ver archivo adjunto
                        </a>
                      )}
                    </div>
                  )}

                  {message.actions?.map((action) => {
                    const actionState = message.actionStates?.[action.tool] || "pending";
                    return (
                      <div key={`${message.id}-${action.tool}`} className="mt-3 rounded-xl border border-border-subtle bg-surface-3 p-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-brand-gold/10 p-2"><Zap className="h-4 w-4 text-brand-gold" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white">{toolLabel(action.tool)}</div>
                            <div className="mt-1 text-xs text-gray-400">{action.description}</div>
                          </div>
                        </div>
                        {actionState === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => cancel(message.id, action)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border-subtle px-3 py-2 text-xs text-gray-300 hover:bg-white/5"><XCircle className="h-3.5 w-3.5" /> Cancelar</button>
                            <button type="button" onClick={() => approve(message.id, action)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-gold px-3 py-2 text-xs font-medium text-black hover:opacity-90"><Check className="h-3.5 w-3.5" /> Autorizar</button>
                          </div>
                        )}
                        {actionState === "running" && <div className="mt-3 flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Ejecutando…</div>}
                        {actionState === "success" && <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Acción completada</div>}
                        {actionState === "error" && <div className="mt-3 flex items-center gap-2 text-xs text-red-400"><XCircle className="h-3.5 w-3.5" /> No se pudo completar</div>}
                        {actionState === "cancelled" && <div className="mt-3 text-xs text-gray-500">Acción cancelada</div>}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3 text-xs text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> La IA está procesando…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-border-subtle bg-surface-1 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {file && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-gray-300">
              {file.type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              <span className="max-w-56 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Quitar archivo"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border-subtle bg-surface-2 p-2 shadow-sm">
            <input
              type="file"
              id={`stable-ai-file-${aiType}`}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label htmlFor={`stable-ai-file-${aiType}`} className="cursor-pointer rounded-xl p-2 text-gray-400 hover:bg-white/5 hover:text-white"><Paperclip className="h-5 w-5" /></label>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} placeholder="Escribe un mensaje…" className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-gray-500" />
            <button type="button" onClick={() => void send()} disabled={sending || (!input.trim() && !file)} className="rounded-xl bg-brand-gold p-2.5 text-black disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-5 w-5" /></button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-gray-500">
            <span>Los archivos se guardan antes de procesarse.</span>
            <span>Enter para enviar · Shift+Enter para salto</span>
          </div>
        </div>
      </footer>
    </section>
  );
}
