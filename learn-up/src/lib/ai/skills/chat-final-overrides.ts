import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { getUserRooms, getUnreadMessagesCount, sendMessage, ensurePrivateRoom } from "@/actions/chat";
import { searchUsers } from "@/actions/friendship";

const readUnreadMessages: ToolDefinition = {
  id: "read_unread_messages",
  category: "chat",
  description: "Consulta el número real de mensajes no leídos por conversación.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ room_id: z.string().optional() }),
  execute: async ({ room_id }) => {
    const rooms = await getUserRooms();
    const selected = room_id ? rooms.filter((room: any) => room.id === room_id) : rooms;
    const unread = await Promise.all(selected.map(async (room: any) => ({
      room_id: room.id,
      name: room.name || (room.type === "private" ? "Chat privado" : "Grupo"),
      unread_count: await getUnreadMessagesCount(room.id),
      last_message: room.last_message || null,
      updated_at: room.updated_at || null,
    })));
    const withUnread = unread.filter((item) => item.unread_count > 0);
    return {
      success: true,
      message: withUnread.length ? `Tienes mensajes no leídos en ${withUnread.length} conversación(es).` : "No tienes mensajes no leídos.",
      data: { conversations: withUnread, totalUnread: withUnread.reduce((sum, item) => sum + item.unread_count, 0) },
    };
  },
};

const sendMessageFinal: ToolDefinition = {
  id: "send_message",
  category: "chat",
  description: "Envía un mensaje real a una persona por ID o nombre, o a una sala existente por room_id.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    recipient_id: z.string().optional(),
    recipient_name: z.string().min(1).optional(),
    room_id: z.string().optional(),
    content: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  }).refine((value) => Boolean(value.room_id || value.recipient_id || value.recipient_name), {
    message: "Debes indicar room_id, recipient_id o recipient_name.",
  }).refine((value) => Boolean(value.content || value.message), {
    message: "Debes indicar el contenido del mensaje.",
  }),
  execute: async (args) => {
    let targetRoomId = args.room_id;
    const content = args.content || args.message || "";

    if (!targetRoomId && args.recipient_id) {
      targetRoomId = await ensurePrivateRoom(args.recipient_id);
    }

    if (!targetRoomId && args.recipient_name) {
      const query = args.recipient_name.trim();
      const users = await searchUsers(query);
      const normalized = query.toLocaleLowerCase();
      const exact = users.find((user: any) => String(user?.full_name || user?.name || "").trim().toLocaleLowerCase() === normalized)
        || users.find((user: any) => String(user?.full_name || user?.name || "").toLocaleLowerCase().includes(normalized));
      if (!exact?.id) {
        if (!users.length) return { success: false, error: `No encontré un usuario llamado "${query}".` };
        return { success: false, error: `Encontré varios resultados para "${query}". Necesito que indiques el nombre exacto o el ID.`, data: { suggestions: users.slice(0, 5).map((user: any) => ({ id: user.id, name: user.full_name || user.name, type: "user" })) } };
      }
      targetRoomId = await ensurePrivateRoom(String(exact.id));
    }

    if (!targetRoomId) return { success: false, error: "No pude resolver la conversación de destino." };
    await sendMessage(targetRoomId, content);
    return { success: true, message: "Mensaje enviado exitosamente.", data: { room_id: targetRoomId } };
  },
};

const startVideoCall: ToolDefinition = {
  id: "start_video_call",
  category: "chat",
  description: "Crea una invitación real a una sala LiveKit existente y la publica en el chat.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ room_id: z.string().uuid() }),
  execute: async ({ room_id }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autorizado.");
    const { data: room, error } = await supabase.from("chat_rooms").select("id,participants").eq("id", room_id).single();
    if (error || !room) throw new Error("Sala de chat no encontrada.");
    const participants = Array.isArray(room.participants) ? room.participants : [];
    if (!participants.includes(user.id)) throw new Error("No perteneces a esta sala.");
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    const callUrl = `${base}/chat?livekitRoom=learn-up-${encodeURIComponent(room_id)}`;
    await sendMessage(room_id, `🎥 Videollamada de Learn Up\n${callUrl}`.trim());
    return { success: true, message: "Invitación de videollamada enviada al chat.", data: { roomId: room_id, callUrl, transport: "LiveKit" } };
  },
};

export function withFinalChatOverrides(skill: Skill): Skill {
  if (skill.id !== "chat") return skill;
  const additions = [sendMessageFinal, readUnreadMessages, startVideoCall];
  const tools = skill.tools.map((tool) =>
    tool.id === sendMessageFinal.id ? sendMessageFinal
      : tool.id === readUnreadMessages.id ? readUnreadMessages
      : tool.id === startVideoCall.id ? startVideoCall
      : tool,
  );
  for (const tool of additions) if (!tools.some((candidate) => candidate.id === tool.id)) tools.push(tool);
  return { ...skill, tools };
}
