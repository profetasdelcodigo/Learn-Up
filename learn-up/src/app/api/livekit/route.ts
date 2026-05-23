import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ROOM_NAME_REGEX = /^[a-zA-Z0-9_-]{1,120}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room")?.trim();

  if (!room || !ROOM_NAME_REGEX.test(room)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (UUID_REGEX.test(room)) {
    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("id", room)
      .maybeSingle();

    if (error || !chatRoom) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.full_name || profile?.username || user.email || "Usuario";

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: displayName,
    metadata: JSON.stringify({ name: displayName }),
    ttl: 7200,
  });

  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await token.toJwt() });
}
