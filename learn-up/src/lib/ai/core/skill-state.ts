import { createClient } from "@/utils/supabase/server";

function cleanIds(skillIds: unknown): string[] {
  if (!Array.isArray(skillIds)) return [];
  return [...new Set(skillIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

export async function getPersistedSkillPacks(sessionId?: string | null): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const globalResult = await supabase
    .from("ai_skill_state")
    .select("skill_ids")
    .eq("user_id", user.id)
    .is("session_id", null)
    .maybeSingle();

  const sessionResult = sessionId
    ? await supabase
        .from("ai_skill_state")
        .select("skill_ids")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .maybeSingle()
    : { data: null } as any;

  const merged = [...cleanIds(globalResult.data?.skill_ids), ...cleanIds(sessionResult.data?.skill_ids)];
  return [...new Set(merged)];
}

export async function saveSkillPacks(skillIds: string[], sessionId?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const clean = cleanIds(skillIds);
  const now = new Date().toISOString();

  if (sessionId) {
    const { error } = await supabase.from("ai_skill_state").upsert({
      user_id: user.id,
      session_id: sessionId,
      skill_ids: clean,
      updated_at: now,
    }, { onConflict: "user_id,session_id" });
    if (error) throw error;
    return clean;
  }

  const existing = await supabase
    .from("ai_skill_state")
    .select("id")
    .eq("user_id", user.id)
    .is("session_id", null)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const { error } = await supabase
      .from("ai_skill_state")
      .update({ skill_ids: clean, updated_at: now })
      .eq("id", existing.data.id)
      .eq("user_id", user.id);
    if (error) throw error;
    return clean;
  }

  const { error } = await supabase.from("ai_skill_state").insert({
    user_id: user.id,
    session_id: null,
    skill_ids: clean,
    updated_at: now,
  });
  if (error) throw error;
  return clean;
}
