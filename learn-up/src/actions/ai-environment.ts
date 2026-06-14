"use server";

import { createClient } from "@/utils/supabase/server";

export async function getAiEnvironment(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("ai_sessions")
    .select("environment_state")
    .eq("id", sessionId)
    .single();

  if (error || !data) return null;
  return data.environment_state;
}

export async function updateAiEnvironment(sessionId: string, state: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("ai_sessions")
    .update({ environment_state: state })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
