import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { createClient } from "@/utils/supabase/server";

const sendMessageTool: ToolDefinition = {
  id: "send_message",
  category: "chat",
  description: "Envía un mensaje directo a un amigo o grupo de estudio.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    recipient_name: z.string().describe("Nombre del destinatario"),
    content: z.string().min(1).describe("Contenido del mensaje"),
    recipient_id: z.string().optional().describe("ID del destinatario si se conoce"),
    recipient_type: z.string().optional().describe("Tipo: friend o group"),
  }),
  execute: async (args, context) => {
    try {
      const { sendChatMessage, findRecipient } = await import("@/actions/chat");
      let recipientId = args.recipient_id;
      if (!recipientId) {
        const result = await findRecipient(args.recipient_name);
        if (!result.success) return result;
        recipientId = result.data.id;
      }
      await sendChatMessage(recipientId!, args.content);
      return { success: true, message: `Mensaje enviado a ${args.recipient_name}.` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const readUnreadMessagesTool: ToolDefinition = {
  id: "read_unread_messages",
  category: "chat",
  description: "Lee los mensajes no leídos del usuario.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async (_args, context) => {
    try {
      const { getUnreadMessages } = await import("@/actions/chat");
      const data = await getUnreadMessages();
      return { success: true, message: `Tienes ${data.length} conversaciones con mensajes sin leer.`, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const readFullConversationTool: ToolDefinition = {
  id: "read_full_conversation",
  category: "chat",
  description: "Carga los últimos N mensajes de una conversación.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    room_id: z.string().describe("ID de la sala de chat"),
    limit: z.number().optional().default(50).describe("Número de mensajes a cargar"),
  }),
  execute: async (args, context) => {
    try {
      const { getChatMessages } = await import("@/actions/chat");
      const data = await getChatMessages(args.room_id);
      return { success: true, message: `Historial cargado: ${data.length} mensajes.`, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const createStudyGroupTool: ToolDefinition = {
  id: "create_study_group",
  category: "chat",
  description: "Crea un grupo de estudio con nombre y miembros.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    name: z.string().min(1).describe("Nombre del grupo"),
    members: z.array(z.string()).optional().describe("Nombres de miembros a agregar"),
  }),
  execute: async (args, context) => {
    try {
      const { createGroup } = await import("@/actions/chat");
      const group = await createGroup(args.name);
      return { success: true, message: `Grupo "${args.name}" creado exitosamente.`, data: group };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const searchUserTool: ToolDefinition = {
  id: "search_user_by_name",
  category: "chat",
  description: "Busca perfiles de usuario por nombre.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("Nombre o parte del nombre a buscar"),
  }),
  execute: async (args, context) => {
    try {
      const { searchUsers } = await import("@/actions/chat");
      const users = await searchUsers(args.query);
      return { success: true, message: `Búsqueda completada.`, data: users };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const summarizeConversationTool: ToolDefinition = {
  id: "summarize_conversation",
  category: "chat",
  description: "Carga el historial de una conversación para que el LLM lo resuma.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    room_id: z.string().describe("ID de la sala de chat"),
  }),
  execute: async (args, context) => {
    try {
      const { getChatMessages } = await import("@/actions/chat");
      const messages = await getChatMessages(args.room_id);
      return { success: true, message: "Historial cargado. Por favor, genera un resumen.", data: messages };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

export const chatSkill: Skill = {
  id: "chat",
  name: "Chat Social",
  category: "social",
  description: "Mensajería, grupos de estudio y comunicación social.",
  tools: [
    sendMessageTool,
    readUnreadMessagesTool,
    readFullConversationTool,
    createStudyGroupTool,
    searchUserTool,
    summarizeConversationTool,
  ],
};
