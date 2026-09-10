import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import {
  addMessageReaction,
  exportConversation,
  getChatMessages,
  getRoomMembers,
  muteRoomNotifications,
  pinMessage,
  sendMessage,
  searchUsers,
} from "@/actions/chat";
import { createClient } from "@/utils/supabase/server";

async function assertRoomAccess(roomId: string, userId: string) {
  const supabase = await createClient();
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .select("id, participants")
    .eq("id", roomId)
    .single();
  if (error || !room) throw new Error("Sala no encontrada.");
  const participants = Array.isArray(room.participants)
    ? room.participants
    : typeof room.participants === "string"
      ? JSON.parse(room.participants)
      : [];
  if (!participants.includes(userId)) throw new Error("No perteneces a esta sala.");
  return room;
}

export const pinMessageTool: ToolDefinition = {
  id: "pin_message",
  name: "Fijar mensaje",
  category: "chat",
  description: "Fija o desfija un mensaje importante en un chat grupal.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ message_id: z.string().min(1), is_pinned: z.boolean().default(true) }),
  execute: async (args) => {
    try {
      await pinMessage(args.message_id, args.is_pinned);
      return { success: true, message: args.is_pinned ? "Mensaje fijado." : "Mensaje desfijado." };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo cambiar el estado del mensaje." };
    }
  },
};

export const mentionUserTool: ToolDefinition = {
  id: "mention_user",
  name: "Mencionar usuario",
  category: "chat",
  description: "Menciona a un usuario en un grupo y envía el mensaje.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().min(1),
    user_name: z.string().min(1),
    content: z.string().min(1),
  }),
  execute: async (args) => {
    try {
      const users = await searchUsers(args.user_name);
      if (users.length !== 1) {
        return {
          success: false,
          message: users.length === 0 ? "No encontré a ese usuario." : "Encontré varios usuarios; necesito que indiques uno más específico.",
          data: { suggestions: users },
        };
      }
      await sendMessage(args.room_id, `@${users[0].full_name || args.user_name} ${args.content}`);
      return { success: true, message: `Mensaje enviado mencionando a ${users[0].full_name || args.user_name}.` };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo mencionar al usuario." };
    }
  },
};

export const reactToMessageTool: ToolDefinition = {
  id: "react_to_message",
  name: "Reaccionar al mensaje",
  category: "chat",
  description: "Añade una reacción emoji a un mensaje.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ message_id: z.string().min(1), emoji: z.string().min(1) }),
  execute: async (args) => {
    try {
      await addMessageReaction(args.message_id, args.emoji);
      return { success: true, message: `Reacción ${args.emoji} añadida.` };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo añadir la reacción." };
    }
  },
};

export const searchChatHistoryTool: ToolDefinition = {
  id: "search_chat_history",
  name: "Buscar en historial",
  category: "chat",
  description: "Busca mensajes por texto dentro de una sala a la que perteneces.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ room_id: z.string().min(1), query: z.string().min(1) }),
  execute: async (args, context) => {
    try {
      if (!context.userId) throw new Error("No se pudo identificar al usuario.");
      await assertRoomAccess(args.room_id, context.userId);
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, content, created_at, user_id, profiles:user_id(full_name, username)")
        .eq("room_id", args.room_id)
        .ilike("content", `%${args.query}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return { success: true, message: `Encontré ${data?.length || 0} coincidencias.`, data: data || [] };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo buscar el historial." };
    }
  },
};

export const shareLibraryMaterialTool: ToolDefinition = {
  id: "share_library_material",
  name: "Compartir material de biblioteca",
  category: "chat",
  description: "Comparte en un chat un material aprobado de la biblioteca de Learn Up.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ item_id: z.string().min(1), room_id: z.string().min(1) }),
  execute: async (args, context) => {
    try {
      if (!context.userId) throw new Error("No se pudo identificar al usuario.");
      await assertRoomAccess(args.room_id, context.userId);
      const supabase = await createClient();
      const { data: item, error } = await supabase
        .from("library_items")
        .select("id,title,description,subject,file_url,file_type,is_approved")
        .eq("id", args.item_id)
        .eq("is_approved", true)
        .single();
      if (error || !item) throw new Error("El material no existe o aún no está aprobado.");
      const lines = [
        `📚 ${item.title || "Material"}`,
        item.subject ? `Materia: ${item.subject}` : "",
        item.description || "",
        item.file_url || "",
      ].filter(Boolean);
      await sendMessage(args.room_id, lines.join("\n"));
      return { success: true, message: `Material "${item.title || "Material"}" compartido.`, data: { item } };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo compartir el material." };
    }
  },
};

export const muteChatNotificationsTool: ToolDefinition = {
  id: "mute_chat_notifications",
  name: "Silenciar chat",
  category: "chat",
  description: "Silencia las notificaciones de un chat por horas o indefinidamente.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: true,
  schema: z.object({ room_id: z.string().min(1), duration: z.string().min(1) }),
  execute: async (args) => {
    try {
      const raw = String(args.duration).trim().toLowerCase();
      let hours: number | null;
      if (["off", "desactivar", "0"].includes(raw)) hours = 0;
      else if (["indefinido", "indefinitely", "siempre"].includes(raw)) hours = null;
      else {
        const match = raw.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hora|horas)$/);
        if (!match) throw new Error("Duración inválida. Usa, por ejemplo, 1h, 8h, 24h o indefinido.");
        hours = Number(match[1]);
      }
      if (hours === 0) {
        await muteRoomNotifications(args.room_id, null);
        return { success: true, message: "Notificaciones del chat activadas nuevamente." };
      }
      await muteRoomNotifications(args.room_id, hours);
      return { success: true, message: hours === null ? "Chat silenciado indefinidamente." : `Chat silenciado durante ${hours} horas.` };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo silenciar el chat." };
    }
  },
};

export const checkReadReceiptsTool: ToolDefinition = {
  id: "check_read_receipts",
  name: "Comprobar lecturas",
  category: "chat",
  description: "Comprueba el estado de lectura de un mensaje usando el último punto de lectura registrado por cada miembro de la sala.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ message_id: z.string().min(1) }),
  execute: async (args, context) => {
    try {
      if (!context.userId) throw new Error("No se pudo identificar al usuario.");
      const supabase = await createClient();
      const { data: message, error: messageError } = await supabase
        .from("chat_messages")
        .select("id,room_id,created_at,user_id,content")
        .eq("id", args.message_id)
        .single();
      if (messageError || !message) throw new Error("Mensaje no encontrado.");
      await assertRoomAccess(message.room_id, context.userId);
      const members = await getRoomMembers(message.room_id);
      const seen = members
        .filter((m: any) => m.user_id !== message.user_id && m.muted_until !== undefined)
        .map((m: any) => ({
          user_id: m.user_id,
          name: m.profiles?.full_name || m.profiles?.username || "Usuario",
          last_read_at: m.last_read_at,
          has_reached_message: Boolean(m.last_read_at && new Date(m.last_read_at).getTime() >= new Date(message.created_at).getTime()),
        }));
      return {
        success: true,
        message: "Estado de lectura calculado desde los marcadores de lectura de la sala.",
        data: { message_id: message.id, created_at: message.created_at, members: seen },
      };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo comprobar la lectura." };
    }
  },
};

export const exportChatHistoryTool: ToolDefinition = {
  id: "export_chat_history",
  name: "Exportar historial",
  category: "chat",
  description: "Prepara el historial de una conversación en texto para descargarlo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ room_id: z.string().min(1) }),
  execute: async (args, context) => {
    try {
      if (!context.userId) throw new Error("No se pudo identificar al usuario.");
      await assertRoomAccess(args.room_id, context.userId);
      const text = await exportConversation(args.room_id);
      return { success: true, message: "Historial preparado para exportación.", data: { filename: `learn-up-chat-${args.room_id}.txt`, content: text } };
    } catch (e: any) {
      return { success: false, error: e.message || "No se pudo exportar el historial." };
    }
  },
};

export const triggerJarvisFromChatTool: ToolDefinition = {
  id: "trigger_jarvis",
  name: "Invocar Jarvis",
  category: "chat",
  description: "Solicita a Jarvis que continúe una tarea desde el contexto actual.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ reason: z.string().min(1).optional(), message: z.string().min(1).optional() }).refine((v) => Boolean(v.reason || v.message), { message: "Indica el motivo de la invocación." }),
  execute: async (args) => ({
    success: true,
    message: "Solicitud preparada para invocar a Jarvis.",
    data: { clientAction: "trigger_jarvis", message: args.message || args.reason },
  }),
};

export const chatExtendedSkill: Skill = {
  id: "chat_extended",
  name: "Chat Social y Grupos — funciones avanzadas",
  category: "chat",
  description: "Completa las herramientas sociales de la categoría 2: fijados, menciones, reacciones, búsqueda, compartir biblioteca, silenciar, lecturas, exportación y Jarvis.",
  tools: [
    pinMessageTool,
    mentionUserTool,
    reactToMessageTool,
    searchChatHistoryTool,
    shareLibraryMaterialTool,
    muteChatNotificationsTool,
    checkReadReceiptsTool,
    exportChatHistoryTool,
    triggerJarvisFromChatTool,
  ],
};
