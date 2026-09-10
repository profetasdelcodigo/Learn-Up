import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { getUserRooms, getUnreadMessagesCount, sendMessage } from "@/actions/chat";

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
  const additions = [readUnreadMessages, startVideoCall];
  const tools = skill.tools.map((tool) => tool.id === readUnreadMessages.id ? readUnreadMessages : tool.id === startVideoCall.id ? startVideoCall : tool);
  for (const tool of additions) if (!tools.some((candidate) => candidate.id === tool.id)) tools.push(tool);
  return { ...skill, tools };
}
