import { createClient } from "@/utils/supabase/server";

export async function getPersistedSkillPacks(sessionId?: string | null): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const query = supabase
    .from("ai_skill_state")
    .select("skill_ids,session_id")
    .eq("user_id", user.id);

  const { data, error } = sessionId
    ? await query.in("session_id", [sessionId, "00000000-0000-0000-0000-000000000000"])
    : await query.is("session_id", null).maybeSingle();

  if (error || !data) return [];
  const rows = Array.isArray(data) ? data : [data];
  const ordered: string[] = [];
  for (const row of rows) {
    const ids = Array.isArray(row.skill_ids) ? row.skill_ids : [];
    for (const id of ids) if (typeof id === "string" && id.trim() && !ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

export async function saveSkillPacks(skillIds: string[], sessionId?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const clean = [...new Set(skillIds.filter((id) => typeof id === "string" && id.trim()))];
  const normalizedSession = sessionId || null;

  const { error } = await supabase
    .from("ai_skill_state")
    .upsert({
      user_id: user.id,
      session_id: normalizedSession,
      skill_ids: clean,
      updated_at: new Date().toISOString(),
    }, { onConflict: normalizedSession ? "user_id,session_id" : "user_id" });

  // Postgres partial unique index does not participate in ON CONFLICT(user_id), so handle global state explicitly.
  if (error && normalizedSession === null) {
    const existing = await supabase.from("ai_skill_state").select("id").eq("user_id", user.id).is("session_id", null).maybeSingle();
    if (existing.data?.id) {
      const update = await supabase.from("ai_skill_state").update({ skill_ids: clean, updated_at: new Date().toISOString() }).eq("id", existing.data.id).eq("user_id", user.id);
      if (update.error) throw update.error;
      return clean;
    }
    throw error;
  }
  if (error) throw error;
  return clean;
}
