import { createAdminClient } from "@/utils/supabase/admin";
import webpush from "@/utils/push";

type NotificationInsert = {
  user_id: string;
  sender_id?: string | null;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  is_read?: boolean;
  created_at?: string;
};

export async function createServerNotification(
  notification: NotificationInsert,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      "Skipping server notification: SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    return;
  }

  const { error } = await admin.from("notifications").insert(notification);
  if (error) {
    console.error("Server notification insert failed:", error);
  }
}

export async function sendWebPushToUser(
  userId: string,
  payload: { title: string; message: string; link?: string },
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("Skipping web push: SUPABASE_SERVICE_ROLE_KEY is missing.");
    return;
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Push subscription lookup failed:", error);
    return;
  }

  if (!data?.subscription) return;

  try {
    await webpush.sendNotification(
      data.subscription,
      JSON.stringify(payload),
    );
  } catch (pushErr) {
    console.error("Push delivery failed for user", userId, pushErr);
  }
}
