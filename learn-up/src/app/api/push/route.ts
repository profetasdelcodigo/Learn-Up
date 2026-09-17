import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendWebPushToUser } from "@/utils/server-notifications";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ enabled: false }, { status: 401 });
    const { count, error } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ enabled: (count ?? 0) > 0 });
  } catch (error) {
    console.error("Push status API Error:", error);
    return NextResponse.json({ error: "Push status failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { action, subscription, endpoint } = body;

    if (action === "subscribe") {
      if (!subscription?.endpoint) {
        return NextResponse.json({ error: "Missing subscription endpoint" }, { status: 400 });
      }

      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("subscription->>endpoint", subscription.endpoint);
      if (deleteError) throw deleteError;

      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        subscription,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      // Send a one-time system notification immediately after activation.
      // This confirms the complete path: subscription -> server -> VAPID -> browser OS.
      await sendWebPushToUser(user.id, {
        title: "Learn Up",
        message: "Las notificaciones del sistema están activadas correctamente.",
        link: "/notifications",
      });

      return NextResponse.json({ success: true });
    }

    if (action === "unsubscribe") {
      const query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
      const { error } = endpoint
        ? await query.eq("subscription->>endpoint", endpoint)
        : await query;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Push API Error:", error);
    return NextResponse.json({ error: "Push API failed" }, { status: 500 });
  }
}
