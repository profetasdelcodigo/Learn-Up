import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSessionIdFromAccessToken } from "@/lib/session-devices";

type SignOutScope = "local" | "others" | "global";

function normalizeScope(value: unknown): SignOutScope {
  return value === "others" || value === "global" ? value : "local";
}

function clearSupabaseCookies(req: NextRequest, response: NextResponse) {
  const allCookies = req.headers.get("cookie");
  if (!allCookies) return;

  allCookies.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name?.startsWith("sb-")) {
      response.cookies.set(name, "", {
        expires: new Date(0),
        path: "/",
      });
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const scope = normalizeScope(body?.scope);
  const requestedSessionIds = Array.isArray(body?.session_ids)
    ? body.session_ids.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionId = getSessionIdFromAccessToken(session?.access_token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  if (requestedSessionIds.length > 0) {
    const uniqueSessionIds = Array.from(new Set(requestedSessionIds));
    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", user.id)
      .in("session_id", uniqueSessionIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      scope: "selected",
      revoked_session_ids: uniqueSessionIds,
    });

    if (sessionId && uniqueSessionIds.includes(sessionId)) {
      await supabase.auth.signOut({ scope: "local" });
      clearSupabaseCookies(req, response);
    }

    return response;
  }

  const { error } = await supabase.auth.signOut({ scope });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (scope === "local" && sessionId) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now, last_seen_at: now })
      .eq("user_id", user.id)
      .eq("session_id", sessionId);
  } else if (scope === "others" && sessionId) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", user.id)
      .neq("session_id", sessionId);
  } else if (scope === "global") {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", user.id);
  }

  const response = NextResponse.json({ ok: true, scope });
  if (scope === "local" || scope === "global") {
    clearSupabaseCookies(req, response);
  }
  return response;
}
