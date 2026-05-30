import { createClient } from "@/utils/supabase/server";
import {
  getSessionIdFromAccessToken,
  parseUserAgent,
} from "@/lib/session-devices";

export async function trackCurrentSession(userAgent?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, sessionId: null };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionId = getSessionIdFromAccessToken(session?.access_token);

  if (!sessionId) {
    return { user, sessionId: null };
  }

  const device = parseUserAgent(userAgent);
  const now = new Date().toISOString();

  await supabase.from("user_sessions").upsert(
    {
      user_id: user.id,
      session_id: sessionId,
      device_name: device.deviceName,
      browser: device.browser,
      os: device.os,
      user_agent: userAgent || "",
      last_seen_at: now,
    },
    { onConflict: "user_id,session_id" },
  );

  return { user, sessionId };
}
