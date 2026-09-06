"use server";

import { createClient } from "@/utils/supabase/server";
import { ALL_PACKS, normalizeSkillPacks } from "./tool-catalog";

function cleanIds(skillIds: unknown): string[] {
  return normalizeSkillPacks(skillIds).filter((id) => ALL_PACKS.includes(id));
}

export async function getPersistedSkillPacks(sessionId?: string | null): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const globalResult = await supabase.from("ai_skill_state").select("skill_ids").eq("user_id", user.id).is("session_id", null).maybeSingle();
  const sessionResult = sessionId
    ? await supabase.from("ai_skill_state").select("skill_ids").eq("user_id", user.id).eq("session_id", sessionId).maybeSingle()
    : { data: null } as any;
  return [...new Set([...cleanIds(globalResult.data?.skill_ids), ...cleanIds(sessionResult.data?.skill_ids)])];
}

export async function saveSkillPacks(skillIds: string[], sessionId?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const clean = cleanIds(skillIds);
  const now = new Date().toISOString();
  if (sessionId) {
    const { error } = await supabase.from("ai_skill_state").upsert({ user_id: user.id, session_id: sessionId, skill_ids: clean, updated_at: now }, { onConflict: "user_id,session_id" });
    if (error) throw error;
    return clean;
  }
  const existing = await supabase.from("ai_skill_state").select("id").eq("user_id", user.id).is("session_id", null).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const { error } = await supabase.from("ai_skill_state").update({ skill_ids: clean, updated_at: now }).eq("id", existing.data.id).eq("user_id", user.id);
    if (error) throw error;
    return clean;
  }
  const { error } = await supabase.from("ai_skill_state").insert({ user_id: user.id, session_id: null, skill_ids: clean, updated_at: now });
  if (error) throw error;
  return clean;
}
