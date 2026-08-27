import { NextRequest, NextResponse } from "next/server";
import { trackCurrentSession } from "@/utils/auth-session-tracker";

export async function POST(req: NextRequest) {
  const { user, sessionId, revoked } = await trackCurrentSession(
    req.headers.get("user-agent"),
  );

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (revoked) {
    return NextResponse.json({ error: "Session revoked" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, session_id: sessionId });
}
