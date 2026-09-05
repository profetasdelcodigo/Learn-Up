"use server";

import { createClient } from "@/utils/supabase/server";

export async function getAiToolEvents(sessionId: string, limit = 200) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await supabase
    .from("ai_tool_events")
    .select("id,session_id,step,skill_id,tool_name,status,risk,input,output,sources,error,created_at,updated_at")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    console.error("[getAiToolEvents] Error:", error);
    return [];
  }
  return data || [];
}
