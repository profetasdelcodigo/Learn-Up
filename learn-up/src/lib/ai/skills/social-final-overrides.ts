import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

const updatePasswordTool: ToolDefinition = {
  id: "update_password", category: "social", description: "Cambiar la contraseña real de la cuenta autenticada.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ new_password: z.string().min(8).max(128) }),
  execute: async ({ new_password }) => { const { supabase } = await getUser(); const { error } = await supabase.auth.updateUser({ password: new_password }); if (error) throw error; return { success: true, message: "Contraseña actualizada correctamente." }; },
};

const viewRecentActivityTool: ToolDefinition = {
  id: "view_recent_activity", category: "social", description: "Consultar actividad reciente real del usuario en IA, calendario y chat.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ limit: z.number().int().min(5).max(50).default(20) }),
  execute: async ({ limit }) => {
    const { supabase, user } = await getUser();
    const [sessions, events, messages] = await Promise.all([
      supabase.from("ai_sessions").select("id,title,ai_type,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(limit),
      supabase.from("calendar_events").select("id,title,start_time,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
      supabase.from("chat_messages").select("id,room_id,content,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
    ]);
    return { success: true, message: "Actividad reciente recuperada.", data: { aiSessions: sessions.data || [], calendarEvents: events.data || [], chatMessages: messages.data || [] } };
  },
};

const uploadAlbumImageTool: ToolDefinition = {
  id: "upload_learning_album_image", category: "social", description: "Añadir una imagen real al álbum de aprendizaje usando una URL HTTPS.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ image_url: z.string().url(), caption: z.string().max(500).optional() }),
  execute: async ({ image_url, caption }) => { const { supabase, user } = await getUser(); const { data, error } = await supabase.from("profile_album").insert({ user_id: user.id, image_url, description: caption || null }).select().single(); if (error) throw error; return { success: true, message: "Imagen añadida al álbum de aprendizaje.", data }; },
};

const viewAlbumTool: ToolDefinition = {
  id: "view_learning_album", category: "social", description: "Ver el álbum de aprendizaje real del usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ limit: z.number().int().min(1).max(100).default(30) }),
  execute: async ({ limit }) => { const { supabase, user } = await getUser(); const { data, error } = await supabase.from("profile_album").select("id,image_url,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit); if (error) throw error; return { success: true, message: `Álbum recuperado (${data?.length || 0} imágenes).`, data: { items: data || [] } }; },
};

export function withFinalSocialOverrides(skill: Skill): Skill {
  if (skill.id !== "social") return skill;
  const overrides: Record<string, ToolDefinition> = {};
  const additions = [updatePasswordTool, viewRecentActivityTool, uploadAlbumImageTool, viewAlbumTool];
  const tools = skill.tools.map((tool) => overrides[tool.id] || tool);
  for (const tool of additions) if (!tools.some((candidate) => candidate.id === tool.id)) tools.push(tool);
  return { ...skill, tools };
}
