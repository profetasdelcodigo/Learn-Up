import { createClient } from "@/utils/supabase/server";
import { getSessionIdFromAccessToken } from "@/lib/session-devices";
import { NextRequest, NextResponse } from "next/server";

type SignOutScope = "local" | "others" | "global";

function normalizeScope(value: unknown): SignOutScope {
  return value === "others" || value === "global" ? value : "local";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const scope = normalizeScope(body?.scope);
  const requestedSessionIds = Array.isArray(body?.session_ids)
    ? body.session_ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionId = getSessionIdFromAccessToken(session?.access_token);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  }

  const now = new Date().toISOString();
  if (requestedSessionIds.length > 0) {
    const uniqueSessionIds = Array.from(new Set(requestedSessionIds));
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", user.id)
      .in("session_id", uniqueSessionIds);

    if (sessionId && uniqueSessionIds.includes(sessionId)) {
      await supabase.auth.signOut({ scope: "local" });
    }
  } else {
    await supabase.auth.signOut({ scope });
  }

  if (requestedSessionIds.length === 0 && scope === "local" && sessionId) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now, last_seen_at: now })
      .eq("user_id", user.id)
      .eq("session_id", sessionId);
  } else if (requestedSessionIds.length === 0 && scope === "others" && sessionId) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", user.id)
      .neq("session_id", sessionId);
  } else if (requestedSessionIds.length === 0 && scope === "global") {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", user.id);
  }

  // Use the request's origin for the redirect (works in local and production)
  const requestUrl = new URL(request.url);
  const redirectUrl = `${requestUrl.origin}/login`;

  const response = NextResponse.redirect(redirectUrl, { status: 302 });

  if (
    scope === "local" ||
    scope === "global" ||
    (sessionId && requestedSessionIds.includes(sessionId))
  ) {
    const allCookies = request.headers.get("cookie");
    if (allCookies) {
      allCookies.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        if (name.startsWith("sb-")) {
          response.cookies.set(name, "", {
            expires: new Date(0),
            path: "/",
          });
        }
      });
    }
  }

  return response;
}
