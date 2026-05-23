import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, subscription } = body;

    // Subscribe Action (Save push subscription to DB)
    if (action === "subscribe") {
      if (!subscription)
        return NextResponse.json(
          { error: "Missing subscription" },
          { status: 400 },
        );

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          subscription: subscription,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Push API Error:", error);
    return NextResponse.json({ error: "Push API failed" }, { status: 500 });
  }
}
