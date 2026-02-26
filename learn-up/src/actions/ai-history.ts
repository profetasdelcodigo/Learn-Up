"use server";

import { createClient } from "@/utils/supabase/server";

export async function getAiSessions(aiType: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("ai_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("ai_type", aiType)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(`[getAiSessions] Error fetching ${aiType} sessions:`, error);
    return [];
  }
  return data || [];
}

export async function getAiMessages(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getAiMessages] Error fetching messages:", error);
    return [];
  }
  return data || [];
}

export async function createAiSession(aiType: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase
    .from("ai_sessions")
    .insert({ user_id: user.id, ai_type: aiType, title })
    .select()
    .single();

  if (error) return { error: error.message };
  return { session: data };
}

export async function addAiMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  mediaUrl?: string,
  mediaType?: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Update session updated_at
  await supabase
    .from("ai_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return { message: data };
}

export async function deleteAiSession(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return { error: error.message };
  return { success: true };
}
