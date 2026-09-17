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
    return NextResponse.json({ enabled: (count ?? 0) > 0, subscriptions: count ?? 0 });
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

      const delivery = await sendWebPushToUser(user.id, {
        title: "Learn Up",
        message: "Las notificaciones del sistema están activadas correctamente.",
        link: "/notifications",
      });

      if (delivery.delivered < 1) {
        // Do not leave a false-positive active subscription after a failed
        // delivery test. The user must be able to try again after the server
        // configuration or browser state is corrected.
        const { error: cleanupError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("subscription->>endpoint", subscription.endpoint);
        if (cleanupError) console.error("Push failed-delivery cleanup failed:", cleanupError);

        return NextResponse.json(
          {
            success: false,
            error:
              "La suscripción se guardó, pero el servidor no pudo entregar la notificación de prueba. Revisa la configuración VAPID del servidor.",
            delivery,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({ success: true, delivery });
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push API failed" }, { status: 500 });
  }
}
