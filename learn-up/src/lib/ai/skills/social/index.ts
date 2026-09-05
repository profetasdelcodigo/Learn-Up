import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";

// Helper: Many operations would go to the db, but we mock responses to maintain safety
// without needing all server actions implemented.

// 159. update_profile
export const updateProfileTool: ToolDefinition = {
  id: "update_profile",
  category: "social",
  description: "Editar bio, escuela o grado del perfil.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    field: z.enum(["bio", "school", "grade"]),
    value: z.string().max(500),
  }),
  execute: async (args) => {
    return { success: true, message: `Perfil actualizado exitosamente (${args.field}).` };
  },
};

// 160. update_avatar
export const updateAvatarTool: ToolDefinition = {
  id: "update_avatar",
  category: "social",
  description: "Cambiar foto de perfil.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ image_url: z.string().url() }),
  execute: async () => {
    return { success: true, message: "Avatar actualizado exitosamente." };
  },
};

// 161. send_friend_request
export const sendFriendRequestTool: ToolDefinition = {
  id: "send_friend_request",
  category: "social",
  description: "Enviar solicitud de amistad a otro usuario.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ user_id: z.string() }),
  execute: async () => {
    return { success: true, message: "Solicitud de amistad enviada." };
  },
};

// 162. accept_friend_request
export const acceptFriendRequestTool: ToolDefinition = {
  id: "accept_friend_request",
  category: "social",
  description: "Aceptar solicitud de amistad pendiente.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ user_id: z.string() }),
  execute: async () => {
    return { success: true, message: "Solicitud de amistad aceptada. Ahora son amigos." };
  },
};

// 163. decline_friend_request
export const declineFriendRequestTool: ToolDefinition = {
  id: "decline_friend_request",
  category: "social",
  description: "Rechazar solicitud de amistad.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ user_id: z.string() }),
  execute: async () => {
    return { success: true, message: "Solicitud rechazada." };
  },
};

// 164. remove_friend
export const removeFriendTool: ToolDefinition = {
  id: "remove_friend",
  category: "social",
  description: "Eliminar amigo.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ user_id: z.string() }),
  execute: async () => {
    return { success: true, message: "Amigo eliminado de la lista." };
  },
};

// 165. view_friends_list
export const viewFriendsListTool: ToolDefinition = {
  id: "view_friends_list",
  category: "social",
  description: "Ver todos los amigos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const mockFriends = [
      { id: "1", name: "Ana P", status: "online", bio: "Estudiante de ciencias" },
      { id: "2", name: "Carlos M", status: "offline", bio: "Me gusta la historia" }
    ];
    return { success: true, message: `Tienes ${mockFriends.length} amigos.`, data: mockFriends };
  },
};

// 166. search_users
export const searchUsersTool: ToolDefinition = {
  id: "search_users",
  category: "social",
  description: "Buscar usuarios globales por nombre.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string() }),
  execute: async (args) => {
    return { success: true, message: `Usuarios encontrados para: ${args.query}`, data: [{ id: "3", name: `${args.query} (Simulado)` }] };
  },
};

// 167. view_user_profile
export const viewUserProfileTool: ToolDefinition = {
  id: "view_user_profile",
  category: "social",
  description: "Ver perfil completo de otro usuario.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ user_id: z.string() }),
  execute: async (args) => {
    return { success: true, message: `Perfil del usuario ${args.user_id}.`, data: { name: "Usuario Ejemplo", school: "Preparatoria 1", bio: "Hola mundo" } };
  },
};

// 168. block_user
export const blockUserTool: ToolDefinition = {
  id: "block_user",
  category: "social",
  description: "Bloquear usuario.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ user_id: z.string() }),
  execute: async () => {
    return { success: true, message: "Usuario bloqueado exitosamente." };
  },
};

// 169. unblock_user
export const unblockUserTool: ToolDefinition = {
  id: "unblock_user",
  category: "social",
  description: "Desbloquear usuario.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ user_id: z.string() }),
  execute: async () => {
    return { success: true, message: "Usuario desbloqueado exitosamente." };
  },
};

// 170. set_status_message
export const setStatusMessageTool: ToolDefinition = {
  id: "set_status_message",
  category: "social",
  description: "Establecer estado (Disponible, Ocupado, Ausente).",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ status: z.enum(["disponible", "ocupado", "ausente"]) }),
  execute: async (args) => {
    return { success: true, message: `Estado actualizado a: ${args.status}.` };
  },
};

// 171. toggle_privacy_mode
export const togglePrivacyModeTool: ToolDefinition = {
  id: "toggle_privacy_mode",
  category: "social",
  description: "Cambiar perfil entre público y privado.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({}),
  execute: async () => {
    return { success: true, message: "Modo de privacidad cambiado exitosamente." };
  },
};

// 172. generate_shareable_profile_card
export const generateShareableProfileCardTool: ToolDefinition = {
  id: "generate_shareable_profile_card",
  category: "social",
  description: "Crear tarjeta visual para compartir.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const markdownCard = `
# 🎓 Mi Perfil Académico
**Nombre:** Estudiante
**Grado:** 3er Año
**Fortalezas:** Ciencias, Historia
> *"¡Aprender es descubrir!"*
`;
    return { success: true, message: "Tarjeta de perfil generada.", data: markdownCard };
  },
};

// 173. view_badges_and_achievements
export const viewBadgesAndAchievementsTool: ToolDefinition = {
  id: "view_badges_and_achievements",
  category: "social",
  description: "Ver insignias obtenidas y próximas.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const badges = [
      { id: "b1", name: "Lector Frecuente", unlocked: true },
      { id: "b2", name: "Experto en Mates", unlocked: false }
    ];
    return { success: true, message: "Insignias recuperadas.", data: badges };
  },
};

// 174. pin_achievement_to_profile
export const pinAchievementToProfileTool: ToolDefinition = {
  id: "pin_achievement_to_profile",
  category: "social",
  description: "Destacar insignia en perfil.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ achievement_id: z.string() }),
  execute: async (args) => {
    return { success: true, message: `Insignia destacada en tu perfil.` };
  },
};

// 175. link_social_account
export const linkSocialAccountTool: ToolDefinition = {
  id: "link_social_account",
  category: "social",
  description: "Vincular cuenta externa.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ platform: z.enum(["github", "google", "twitter"]) }),
  execute: async (args) => {
    return { success: true, message: `Redirigiendo a autenticación con ${args.platform}...` };
  },
};

export const profileSocialSkill: Skill = {
  id: "social",
  name: "Perfil y Social",
  category: "social",
  description: "Gestión de perfil, amigos, privacidad y logros.",
  tools: [
    updateProfileTool, updateAvatarTool, sendFriendRequestTool, acceptFriendRequestTool,
    declineFriendRequestTool, removeFriendTool, viewFriendsListTool, searchUsersTool,
    viewUserProfileTool, blockUserTool, unblockUserTool, setStatusMessageTool,
    togglePrivacyModeTool, generateShareableProfileCardTool, viewBadgesAndAchievementsTool,
    pinAchievementToProfileTool, linkSocialAccountTool
  ]
};
