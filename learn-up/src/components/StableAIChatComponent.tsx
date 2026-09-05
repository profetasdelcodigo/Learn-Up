"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, FileText, Loader2, Paperclip, Send, X, Check, XCircle, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { addAiMessage, createAiSession, getAiMessages } from "@/actions/ai-history";
import { approveStableToolAction } from "@/actions/stable-ai-agents";
import { indexAiDocumentFromUrl } from "@/actions/ai-tutor";
import { getPersistedSkillPacks } from "@/lib/ai/core/skill-state";

interface ToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
  requiresConfirm: boolean;
  workflowId?: string;
}

interface ChatMessage {
  id: string;
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

const toolNames: Record<string, string> = {
  add_calendar_event: "Crear evento",
  add_habit: "Crear hábito",
  send_message: "Enviar mensaje",
  search_web: "Buscar en internet",
  advanced_web_search: "Investigación avanzada",
  browse_web_page: "Abrir página",
  search_documents: "Buscar documentos",
  search_image: "Buscar imagen",
  generate_image: "Generar imagen",
  generate_video: "Generar video",
  create_exam: "Crear examen",
  save_learned_concept: "Guardar concepto",
};

function toolLabel(tool: string) {
  return toolNames[tool] || tool.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function cleanDisplayedText(text: string) {
  return String(text || "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function_call>[\s\S]*?<\/function_call>/gi, "")
    .replace(/```(?:markdown|md)?\s*([\s\S]*?)```/gi, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
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
  const [autopilot, setAutopilot] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const loadedSession = useRef<string | null>(null);

  useEffect(() => setSessionId(currentSessionId || null), [currentSessionId]);

  useEffect(() => {
    let cancelled = false;
    void getPersistedSkillPacks(sessionId).then((skills) => {
      if (!cancelled) setActiveSkills(skills);
    }).catch(() => {
      if (!cancelled) setActiveSkills([]);
    });
    return () => { cancelled = true; };
  }, [sessionId]);

  const loadMessages = useCallback(async (id: string) => {
    const rows = await getAiMessages(id);
    setMessages(rows.map((row: any) => ({
      id: String(row.id),
      role: row.role,
      content: row.content || "",
      media_url: row.media_url || null,
      media_type: row.media_type || null,
      status: "completed",
      actions: Array.isArray(row.tool_calls) ? row.tool_calls : undefined,
    })));
  }, []);

  useEffect(() => {
    if (!sessionId || loadedSession.current === sessionId) return;
    loadedSession.current = sessionId;
    void loadMessages(sessionId);
  }, [sessionId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const history = useMemo(
    () => messages.filter((m) => m.status !== "failed").slice(-10).map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    const result = await createAiSession(aiType, title);
    if (result.error || !result.session) throw new Error(result.error || "No se pudo crear la sesión");
    setSessionId(result.session.id);
    loadedSession.current = result.session.id;
    onSessionChange?.(result.session.id);
    return result.session.id;
  }, [aiType, onSessionChange, sessionId, title]);

  const uploadFile = useCallback(async (selected: File) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no válida");
    const safe = selected.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("ai_media").upload(path, selected, {
      contentType: selected.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
    return supabase.storage.from("ai_media").getPublicUrl(path).data.publicUrl;
  }, []);

  const appendAssistantResult = useCallback(async (id: string, result: { response?: string; error?: string; actions?: ToolAction[] }) => {
    if (result.actions?.length) {
      const actionMessage: ChatMessage = {
        id: `actions-${crypto.randomUUID()}`,
        role: "assistant",
        content: cleanDisplayedText(result.response || "Necesito tu autorización para continuar:") || "Necesito tu autorización para continuar:",
        status: "completed",
        actions: result.actions,
        actionStates: Object.fromEntries(result.actions.map((action) => [action.tool, "pending"])),
      };
      setMessages((prev) => [...prev, actionMessage]);
      await addAiMessage(id, "assistant", actionMessage.content, undefined, undefined, result.actions.map((action) => ({ tool: action.tool, args: action.args, workflowId: action.workflowId })));
      return;
    }
    if (result.response || result.error) {
      const responseText = cleanDisplayedText(result.response || `No pude completar la solicitud: ${result.error}`);
      setMessages((prev) => [...prev, {
        id: `assistant-${crypto.randomUUID()}`,
        role: "assistant",
        content: responseText,
        status: result.error ? "failed" : "completed",
      }]);
      await addAiMessage(id, "assistant", responseText);
    }
  }, []);

  const send = useCallback(async () => {
    if ((!input.trim() && !file) || sending) return;
    setSending(true);
    const selectedFile = file;
    const text = input.trim();
    setInput("");
    setFile(null);

    try {
      const id = await ensureSession();
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;
      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile);
        mediaType = selectedFile.type || mediaKind(selectedFile);
      }

      const userMessage: ChatMessage = {
        id: `local-${crypto.randomUUID()}`,
        role: "user",
        content: text || `Analiza este archivo: ${selectedFile?.name || "archivo adjunto"}`,
        media_url: mediaUrl,
        media_type: mediaType,
        status: selectedFile ? "processing" : "sending",
      };
      setMessages((prev) => [...prev, userMessage]);

      const persisted = await addAiMessage(id, "user", userMessage.content, mediaUrl, mediaType);
      if (persisted.error) throw new Error(persisted.error);
      if (mediaUrl) {
        void indexAiDocumentFromUrl({
          title: selectedFile?.name || "Archivo adjunto",
          url: mediaUrl,
          mimeType: mediaType,
          sessionId: id,
        }).catch((error) => console.warn("[MEDIA] Indexación en segundo plano falló:", error));
      }

      const effectiveModel = autopilot ? `${model}::autopilot` : model;
      const skillPrefix = activeSkills.length > 0 ? `[Skills Activas: ${activeSkills.join(",")}]\n\n` : "";
      const result = await onSubmitAction(skillPrefix + (text || "Analiza el archivo adjunto."), history, mediaUrl, mediaType, effectiveModel, id);

      setMessages((prev) => prev.map((item) => item.id === userMessage.id ? { ...item, status: "completed" } : item));
      await appendAssistantResult(id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      setMessages((prev) => [...prev, {
        id: `error-${crypto.randomUUID()}`,
        role: "assistant",
        content: `No pude completar la solicitud. ${message}`,
        status: "failed",
      }]);
    } finally {
      setSending(false);
    }
  }, [activeSkills, appendAssistantResult, autopilot, ensureSession, file, history, input, model, onSubmitAction, sending, uploadFile]);

  const approve = useCallback(async (messageId: string, action: ToolAction) => {
    setMessages((prev) => prev.map((message) => message.id === messageId ? {
      ...message,
      actionStates: { ...(message.actionStates || {}), [action.tool]: "running" },
    } : message));
    try {
      const result = await approveStableToolAction(action.tool, action.args);
      const state = result?.error ? "error" : "success";
      setMessages((prev) => prev.map((message) => message.id === messageId ? {
        ...message,
        actionStates: { ...(message.actionStates || {}), [action.tool]: state },
      } : message));
      if (result?.response || result?.actions?.length || result?.error) {
        const id = await ensureSession();
        await appendAssistantResult(id, result);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No se pudo ejecutar la acción";
      setMessages((prev) => [...prev, { id: `error-${crypto.randomUUID()}`, role: "assistant", content: detail, status: "failed" }]);
    }
  }, [appendAssistantResult, ensureSession]);

  const cancel = useCallback((messageId: string, tool: string) => {
    setMessages((prev) => prev.map((message) => message.id === messageId ? {
      ...message,
      actionStates: { ...(message.actionStates || {}), [tool]: "cancelled" },
    } : message));
  }, []);

  return (
    <section className={`flex h-full min-h-0 flex-col bg-surface-1 ${className}`}>
      <header className="shrink-0 border-b border-border-subtle bg-surface-2/80 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border-subtle bg-surface-3 p-2">{icon || <Bot className="h-5 w-5" />}</div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="truncate text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={() => setAutopilot((value) => !value)} aria-pressed={autopilot} className={`ml-auto rounded-full border px-3 py-1.5 text-xs ${autopilot ? "border-brand-gold/50 bg-brand-gold/10 text-brand-gold" : "border-border-subtle text-gray-300"}`}>
            <Zap className="mr-1 inline h-3.5 w-3.5" />{autopilot ? "Piloto automático" : "Modo manual"}
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
          {messages.length === 0 && <div className="mx-auto mt-16 max-w-md text-center text-gray-400"><Bot className="mx-auto mb-3 h-10 w-10 opacity-60" /><p className="text-sm">{title} está listo. Puedes escribir, adjuntar archivos o pedir una acción.</p></div>}
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl border px-4 py-3 ${message.role === "user" ? "border-brand-gold/20 bg-brand-gold/10 text-white" : "border-border-subtle bg-surface-2 text-gray-100"}`}>
                  <div className="whitespace-pre-wrap text-sm leading-6">{cleanDisplayedText(message.content)}</div>
                  {message.media_url && <div className="mt-3 rounded-xl border border-border-subtle bg-surface-3 p-2"><a href={message.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-brand-gold hover:underline"><FileText className="h-4 w-4" />Ver archivo adjunto</a></div>}
                  {message.actions?.map((action) => {
                    const state = message.actionStates?.[action.tool] || "pending";
                    return <div key={`${message.id}-${action.tool}`} className="mt-3 rounded-xl border border-border-subtle bg-surface-3 p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-white">{toolLabel(action.tool)}</div><div className="text-xs text-gray-400">{action.description || "Acción solicitada por la IA"}</div></div><span className="text-xs text-gray-400">{state === "running" ? "Ejecutando..." : state === "success" ? "Completado" : state === "error" ? "Error" : state === "cancelled" ? "Cancelado" : "Pendiente"}</span></div>{state === "pending" && <div className="mt-3 flex gap-2"><button type="button" onClick={() => approve(message.id, action)} className="rounded-lg bg-brand-gold px-3 py-2 text-xs font-medium text-black"><Check className="mr-1 inline h-3.5 w-3.5" />Autorizar</button><button type="button" onClick={() => cancel(message.id, action.tool)} className="rounded-lg border border-border-subtle px-3 py-2 text-xs text-gray-300"><XCircle className="mr-1 inline h-3.5 w-3.5" />Cancelar</button></div>}</div>;
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {sending && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</div>}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="shrink-0 border-t border-border-subtle bg-surface-2 p-3">
        {file && <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-3 px-3 py-2 text-xs text-gray-300"><Paperclip className="h-4 w-4" />{file.name}<button type="button" className="ml-auto" onClick={() => setFile(null)}><X className="h-4 w-4" /></button></div>}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.doc,.docx,.pptx,.xlsx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-border-subtle p-3 text-gray-300 hover:bg-white/5" aria-label="Adjuntar archivo"><Paperclip className="h-5 w-5" /></button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} placeholder={`Escribe a ${title}...`} className="max-h-32 min-h-[46px] flex-1 resize-none rounded-xl border border-border-subtle bg-surface-3 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500" />
          <button type="submit" disabled={sending || (!input.trim() && !file)} className="rounded-xl bg-brand-gold p-3 text-black disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar"><Send className="h-5 w-5" /></button>
        </div>
      </form>
    </section>
  );
}
