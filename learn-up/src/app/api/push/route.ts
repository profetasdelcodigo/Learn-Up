import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import webpush from "@/utils/push";

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
    const { action, subscription, payload, user_id } = body;

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

    // Send Push Notification Action
    if (action === "send" && user_id && payload) {
      const { data: subData } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", user_id)
        .single();

      if (subData && subData.subscription) {
        try {
          await webpush.sendNotification(
            subData.subscription,
            JSON.stringify(payload),
          );
          return NextResponse.json({ success: true });
        } catch (e) {
          console.error("Error sending push notification:", e);
          return NextResponse.json(
            { error: "Push send failed" },
            { status: 500 },
          );
        }
      } else {
        return NextResponse.json(
          { warning: "No subscription found" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Push API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
