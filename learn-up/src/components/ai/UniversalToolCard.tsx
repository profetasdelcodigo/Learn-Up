"use client";

import type { ReactNode } from "react";
import {
  Bell,
  Bot,
  Brain,
  CalendarPlus,
  Check,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Video,
  XCircle,
} from "lucide-react";

export interface UniversalToolAction {
  tool: string;
  args?: Record<string, unknown>;
  description?: string;
  requiresConfirm?: boolean;
  workflowId?: string;
}

export type UniversalToolStatus = "pending" | "running" | "completed" | "error";

interface UniversalToolCardProps {
  action: UniversalToolAction;
  status?: UniversalToolStatus;
  onConfirm?: (action: UniversalToolAction) => void;
  onCancel?: (action: UniversalToolAction) => void;
  busy?: boolean;
  className?: string;
}

function iconForTool(tool: string): ReactNode {
  if (tool.includes("calendar") || tool.includes("event") || tool.includes("habit")) return <CalendarPlus className="w-4 h-4" />;
  if (tool.includes("message") || tool.includes("chat") || tool.includes("group")) return <MessageSquare className="w-4 h-4" />;
  if (tool.includes("image") || tool.includes("video") || tool.includes("audio") || tool.includes("media")) return tool.includes("video") ? <Video className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />;
  if (tool.includes("document") || tool.includes("library") || tool.includes("file")) return <FileText className="w-4 h-4" />;
  if (tool.includes("search") || tool.includes("web") || tool.includes("research")) return <Search className="w-4 h-4" />;
  if (tool.includes("notify")) return <Bell className="w-4 h-4" />;
  if (tool.includes("concept") || tool.includes("learn") || tool.includes("exam")) return <Brain className="w-4 h-4" />;
  if (tool.includes("open_url") || tool.includes("navigate")) return <Globe className="w-4 h-4" />;
  return <Bot className="w-4 h-4" />;
}

function colorsForTool(tool: string) {
  if (tool.includes("calendar") || tool.includes("event") || tool.includes("habit")) return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  if (tool.includes("message") || tool.includes("chat") || tool.includes("group")) return "text-purple-400 bg-purple-400/10 border-purple-400/20";
  if (tool.includes("image") || tool.includes("video") || tool.includes("audio") || tool.includes("media")) return "text-pink-400 bg-pink-400/10 border-pink-400/20";
  if (tool.includes("search") || tool.includes("web") || tool.includes("research")) return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
  return "text-brand-gold bg-brand-gold/10 border-brand-gold/20";
}

function labelForTool(tool: string) {
  const labels: Record<string, string> = {
    add_calendar_event: "Agregar evento",
    update_calendar_event: "Editar evento",
    delete_calendar_event: "Eliminar evento",
    send_message: "Enviar mensaje",
    search_web: "Búsqueda web",
    advanced_web_search: "Búsqueda avanzada",
    search_documents: "Buscar documentos",
    query_repositories: "Consultar conocimiento",
    generate_image: "Generar imagen",
    search_image: "Buscar imagen",
    generate_video: "Generar video",
    generate_document: "Generar documento",
    create_exam: "Crear examen",
    open_url: "Abrir enlace",
    navigate_app: "Navegar en Learn Up",
    save_learned_concept: "Guardar concepto",
    notify_user: "Enviar notificación",
  };
  return labels[tool] || tool.replaceAll("_", " ");
}

const statusLabel: Record<UniversalToolStatus, string> = {
  pending: "Requiere confirmación",
  running: "En proceso",
  completed: "Completado",
  error: "No completado",
};

export function universalToolActionKey(action: UniversalToolAction) {
  return `${action.workflowId || "local"}:${action.tool}:${JSON.stringify(action.args || {})}`;
}

export default function UniversalToolCard({
  action,
  status = "pending",
  onConfirm,
  onCancel,
  busy = false,
  className = "",
}: UniversalToolCardProps) {
  const isPending = status === "pending";
  const hasActions = isPending && (onConfirm || onCancel);

  return (
    <div className={`bg-surface-2 rounded-2xl p-4 border border-white/5 shadow-lg ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border ${colorsForTool(action.tool)}`}>
          {status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : status === "completed" ? <Check className="w-4 h-4" /> : status === "error" ? <XCircle className="w-4 h-4" /> : iconForTool(action.tool)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-white capitalize">{labelForTool(action.tool)}</p>
            <span className="text-[10px] bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              {statusLabel[status]}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed break-words">
            {action.description || "La IA preparó esta acción con los datos disponibles."}
          </p>
        </div>
      </div>

      {hasActions && (
        <div className="flex gap-2 mt-3">
          {onConfirm && (
            <button
              type="button"
              onClick={() => onConfirm(action)}
              disabled={busy}
              className="flex-1 py-2 px-3 bg-brand-gold text-brand-black rounded-xl font-semibold text-sm hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Aceptar</>}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={() => onCancel(action)}
              disabled={busy}
              className="flex-1 py-2 px-3 bg-surface-3 text-gray-300 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-4 h-4" /> Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
