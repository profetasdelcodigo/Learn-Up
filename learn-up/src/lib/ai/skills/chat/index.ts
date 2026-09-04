import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import {
  getUserRooms,
  getChatMessages,
  ensurePrivateRoom,
  createGroup,
  updateGroup,
  sendMessage,
  markMessagesAsRead,
  updateMessage,
  deleteMessage,
  leaveGroup,
  addGroupMember,
} from "@/actions/chat";
import { searchUsers } from "@/actions/friendship";

// ═══════════════════════════════════════════════════════════════════════════
// 28. ENVIAR MENSAJE
// ═══════════════════════════════════════════════════════════════════════════
export const sendMessageTool: ToolDefinition = {
  id: "send_message",
  category: "chat",
  description: "Envía un mensaje directo a un amigo (por ID de amigo o nombre exacto) o a un grupo (por room_id).",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    recipient_id: z.string().optional().describe("User ID del destinatario (para MD)"),
    room_id: z.string().optional().describe("ID del grupo o sala existente"),
    content: z.string().min(1).describe("Contenido del mensaje"),
  }),
  execute: async (args) => {
    try {
      let targetRoomId = args.room_id;
      if (!targetRoomId && args.recipient_id) {
        // Asegurar que existe una sala privada con el amigo
        targetRoomId = await ensurePrivateRoom(args.recipient_id);
      }
      if (!targetRoomId) {
        return { success: false, error: "Debes proporcionar recipient_id o room_id" };
      }
      
      const result = await sendMessage(targetRoomId, args.content);
      return { success: true, message: "Mensaje enviado exitosamente." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al enviar mensaje" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 29. LEER CONVERSACIONES (UNREAD)
// ═══════════════════════════════════════════════════════════════════════════
export const readUnreadMessagesTool: ToolDefinition = {
  id: "read_unread_messages",
  category: "chat",
  description: "Devuelve un resumen de las conversaciones activas recientes.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    try {
      const rooms = await getUserRooms();
      return {
        success: true,
        message: `Tienes ${rooms.length} conversaciones activas.`,
        data: rooms.map(r => ({
          id: r.id,
          name: r.name || (r.type === 'private' ? 'Chat Privado' : 'Grupo'),
          type: r.type,
          last_message: r.last_message,
          updated_at: r.updated_at
        })).slice(0, 5) // Devolver las 5 más recientes
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al obtener conversaciones" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 30. LEER CONVERSACIÓN COMPLETA
// ═══════════════════════════════════════════════════════════════════════════
export const readFullConversationTool: ToolDefinition = {
  id: "read_full_conversation",
  category: "chat",
  description: "Carga los últimos mensajes de una conversación específica.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    room_id: z.string().describe("ID de la sala de chat"),
    limit: z.number().optional().describe("Número de mensajes a leer (default 50)"),
  }),
  execute: async (args) => {
    try {
      const msgs = await getChatMessages(args.room_id, args.limit || 50);
      await markMessagesAsRead(args.room_id);
      return {
        success: true,
        message: `Se recuperaron ${msgs.length} mensajes.`,
        data: msgs.map((m: any) => ({
          id: m.id,
          author: m.profiles?.full_name || "Desconocido",
          content: m.content,
          created_at: m.created_at
        }))
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al leer mensajes" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 31. CREAR GRUPO
// ═══════════════════════════════════════════════════════════════════════════
export const createGroupTool: ToolDefinition = {
  id: "create_group",
  category: "chat",
  description: "Crea un grupo de estudio o chat con nombre y miembros.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    name: z.string().min(1).describe("Nombre del grupo"),
    members: z.array(z.string()).describe("Lista de IDs de usuarios (amigos) a agregar"),
    description: z.string().optional().describe("Descripción del grupo"),
  }),
  execute: async (args) => {
    try {
      const roomId = await createGroup(args.name, args.members, null, args.description);
      return { success: true, message: `Grupo "${args.name}" creado con éxito.`, data: { room_id: roomId } };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al crear grupo" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 32. AGREGAR MIEMBRO A GRUPO
// ═══════════════════════════════════════════════════════════════════════════
export const addGroupMemberTool: ToolDefinition = {
  id: "add_group_member",
  category: "chat",
  description: "Agrega un amigo a un grupo existente.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
    user_id: z.string().describe("ID del usuario a agregar"),
  }),
  execute: async (args) => {
    try {
      await addGroupMember(args.room_id, args.user_id);
      return { success: true, message: "Miembro agregado al grupo." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al agregar miembro" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 33. VER MIEMBROS DE GRUPO
// ═══════════════════════════════════════════════════════════════════════════
export const viewGroupMembersTool: ToolDefinition = {
  id: "view_group_members",
  category: "chat",
  description: "Lista los participantes de un grupo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
  }),
  execute: async (args) => {
    try {
      const rooms = await getUserRooms();
      const room = rooms.find(r => r.id === args.room_id);
      if (!room) return { success: false, error: "Grupo no encontrado o no eres miembro." };
      
      return { 
        success: true, 
        message: `El grupo tiene ${room.participants_profiles?.length || 0} miembros.`,
        data: room.participants_profiles?.map(p => ({ id: p.id, name: p.full_name, role: p.role })) || []
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al ver miembros" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 34. EDITAR GRUPO
// ═══════════════════════════════════════════════════════════════════════════
export const editGroupTool: ToolDefinition = {
  id: "edit_group",
  category: "chat",
  description: "Cambia el nombre o descripción de un grupo (requiere ser admin).",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
    name: z.string().optional().describe("Nuevo nombre"),
    description: z.string().optional().describe("Nueva descripción"),
  }),
  execute: async (args) => {
    try {
      await updateGroup(args.room_id, args.name, undefined, args.description);
      return { success: true, message: "Información del grupo actualizada." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al editar grupo" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 35. ABANDONAR GRUPO
// ═══════════════════════════════════════════════════════════════════════════
export const leaveGroupTool: ToolDefinition = {
  id: "leave_group",
  category: "chat",
  description: "Abandona un chat grupal.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
  }),
  execute: async (args) => {
    try {
      await leaveGroup(args.room_id);
      return { success: true, message: "Has abandonado el grupo." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al abandonar grupo" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 36. BUSCAR USUARIO POR NOMBRE
// ═══════════════════════════════════════════════════════════════════════════
export const searchUserByNameTool: ToolDefinition = {
  id: "search_user_by_name",
  category: "chat",
  description: "Busca perfiles de usuarios por nombre para chatear o agregar a grupos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(3).describe("Nombre a buscar"),
  }),
  execute: async (args) => {
    try {
      const users = await searchUsers(args.query);
      return { success: true, message: `Se encontraron ${users.length} usuarios.`, data: users };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al buscar usuarios" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 37. ENVIAR ARCHIVO EN CHAT
// ═══════════════════════════════════════════════════════════════════════════
export const sendFileInChatTool: ToolDefinition = {
  id: "send_file_in_chat",
  category: "chat",
  description: "Envía un enlace o archivo en una conversación.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
    file_url: z.string().url().describe("URL del archivo o enlace a compartir"),
    message: z.string().optional().describe("Mensaje opcional acompañando el archivo"),
  }),
  execute: async (args) => {
    try {
      const content = args.message ? `${args.message}\n\n${args.file_url}` : args.file_url;
      await sendMessage(args.room_id, content);
      return { success: true, message: "Archivo compartido en el chat." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al enviar archivo" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 38. EDITAR MENSAJE
// ═══════════════════════════════════════════════════════════════════════════
export const editMessageTool: ToolDefinition = {
  id: "edit_message",
  category: "chat",
  description: "Edita un mensaje propio enviado recientemente.",
  risk: "write",
  requiresConfirmation: false, // Menor riesgo
  supportsAutopilot: true,
  schema: z.object({
    message_id: z.string().describe("ID del mensaje a editar"),
    new_content: z.string().min(1).describe("Nuevo contenido del mensaje"),
  }),
  execute: async (args) => {
    try {
      await updateMessage(args.message_id, args.new_content);
      return { success: true, message: "Mensaje editado con éxito." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al editar mensaje" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 39. ELIMINAR MENSAJE
// ═══════════════════════════════════════════════════════════════════════════
export const deleteMessageTool: ToolDefinition = {
  id: "delete_message",
  category: "chat",
  description: "Borra un mensaje propio. Puede ser solo para mí o para todos.",
  risk: "write", // Not full destructive as it's just a message
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    message_id: z.string().describe("ID del mensaje a eliminar"),
    delete_for_all: z.boolean().default(false).describe("Si es true, se elimina para todos"),
  }),
  execute: async (args) => {
    try {
      await deleteMessage(args.message_id, args.delete_for_all);
      return { success: true, message: "Mensaje eliminado." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al eliminar mensaje" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 40. BROADCAST MENSAJE
// ═══════════════════════════════════════════════════════════════════════════
export const broadcastMessageTool: ToolDefinition = {
  id: "broadcast_message",
  category: "chat",
  description: "Envía el mismo mensaje directo a varios amigos.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    content: z.string().min(1).describe("Contenido del mensaje"),
    recipient_ids: z.array(z.string()).describe("Lista de IDs de amigos"),
  }),
  execute: async (args) => {
    try {
      let sent = 0;
      for (const friendId of args.recipient_ids) {
        try {
          const roomId = await ensurePrivateRoom(friendId);
          await sendMessage(roomId, args.content);
          sent++;
        } catch (err) {
          console.error(`Error sending broadcast to ${friendId}:`, err);
        }
      }
      return { success: true, message: `Mensaje enviado a ${sent} amigos.` };
    } catch (e: any) {
      return { success: false, error: e.message || "Error en broadcast" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 41. CREAR ENCUESTA (Simulada mediante mensaje formateado)
// ═══════════════════════════════════════════════════════════════════════════
export const createPollTool: ToolDefinition = {
  id: "create_poll",
  category: "chat",
  description: "Crea una encuesta simple en el chat.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
    question: z.string().min(1).describe("Pregunta"),
    options: z.array(z.string()).describe("Opciones"),
  }),
  execute: async (args) => {
    try {
      const pollContent = `📊 **ENCUESTA:** ${args.question}\n\n` + 
        args.options.map((opt: string, i: number) => `${i + 1}️⃣ ${opt}`).join('\n') + 
        `\n\n*(Responde con el número de tu opción)*`;
      await sendMessage(args.room_id, pollContent);
      return { success: true, message: "Encuesta enviada al chat." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al crear encuesta" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 46. INICIAR VIDEOLLAMADA
// ═══════════════════════════════════════════════════════════════════════════
export const startVideoCallTool: ToolDefinition = {
  id: "start_video_call",
  category: "chat",
  description: "Inicia una videollamada en la sala, enviando la invitación.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
  }),
  execute: async (args) => {
    try {
      await sendMessage(args.room_id, "[CALL_OFFER_VIDEO]");
      return { success: true, message: "Invitación a videollamada enviada." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al iniciar videollamada" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 51. RESUMIR CONVERSACIÓN (LLM Directive)
// ═══════════════════════════════════════════════════════════════════════════
export const summarizeConversationTool: ToolDefinition = {
  id: "summarize_conversation",
  category: "chat",
  description: "Obtiene los mensajes de una sala y le pide al IA que genere un resumen de temas y acuerdos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    room_id: z.string().describe("ID de la sala"),
  }),
  execute: async (args) => {
    try {
      const msgs = await getChatMessages(args.room_id, 100);
      if (msgs.length === 0) return { success: true, message: "No hay mensajes para resumir." };
      
      const chatLog = msgs.map((m: any) => `${m.profiles?.full_name || 'Alguien'}: ${m.content}`).join("\n");
      
      return {
        success: true,
        message: "Historial obtenido.",
        data: {
          instruction: "Por favor lee el siguiente historial de chat y genera un resumen con viñetas de los temas principales, acuerdos y tareas pendientes (si las hay).",
          chatLog
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al leer conversación" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SKILL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export const chatSkill: Skill = {
  id: "chat",
  name: "Chat Social y Grupos",
  category: "chat",
  description:
    "Gestión de mensajería directa, grupos de estudio, encuestas, videollamadas y resumen de conversaciones.",
  tools: [
    sendMessageTool,
    readUnreadMessagesTool,
    readFullConversationTool,
    createGroupTool,
    addGroupMemberTool,
    viewGroupMembersTool,
    editGroupTool,
    leaveGroupTool,
    searchUserByNameTool,
    sendFileInChatTool,
    editMessageTool,
    deleteMessageTool,
    broadcastMessageTool,
    createPollTool,
    startVideoCallTool,
    summarizeConversationTool,
  ],
};
