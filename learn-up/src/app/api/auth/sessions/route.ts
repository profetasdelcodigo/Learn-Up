import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { trackCurrentSession } from "@/utils/auth-session-tracker";

export async function GET(req: NextRequest) {
  const { user, sessionId, revoked } = await trackCurrentSession(
    req.headers.get("user-agent"),
  );

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (revoked) {
    return NextResponse.json({ error: "Session revoked" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_sessions")
    .select(
      "id, session_id, device_name, browser, os, created_at, last_seen_at, revoked_at",
    )
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load sessions" }, { status: 500 });
  }

  return NextResponse.json({
    current_session_id: sessionId,
    sessions: (data || []).map((row) => ({
      ...row,
      is_current: row.session_id === sessionId,
    })),
  });
}
