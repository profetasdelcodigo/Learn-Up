import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";

const cancelSentFriendRequest: ToolDefinition = {
  id: "cancel_sent_friend_request", category: "social", description: "Cancela una solicitud de amistad enviada que siga pendiente.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ user_id: z.string().uuid() }),
  execute: async ({ user_id }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autorizado");
    const { data, error } = await supabase.from("friendships").delete().eq("requester_id", user.id).eq("addressee_id", user_id).eq("status", "pending").select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { success: false, error: "No existe una solicitud enviada pendiente a ese usuario." };
    return { success: true, message: "Solicitud de amistad cancelada.", data: { user_id } };
  },
};

export function withFriendRequestOverrides(skill: Skill): Skill {
  if (skill.id !== "social") return skill;
  return { ...skill, tools: [...skill.tools.filter((tool) => tool.id !== cancelSentFriendRequest.id), cancelSentFriendRequest] };
}
