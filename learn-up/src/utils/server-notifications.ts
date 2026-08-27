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
  room_id?: string | null;
  event_type?: string | null;
  source?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, any>;
};

type PushPayload = { title: string; message: string; link?: string };

function toLegacyNotification(notification: NotificationInsert) {
  const {
    room_id: _roomId,
    event_type: _eventType,
    source: _source,
    priority: _priority,
    metadata: _metadata,
    ...legacy
  } = notification;
  return legacy;
}

function isSchemaCacheError(error: any) {
  return (
    error?.code === "PGRST204" ||
    /schema cache|column|room_id|event_type|priority|metadata/i.test(
      error?.message || "",
    )
  );
}

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
    if (isSchemaCacheError(error)) {
      const { error: legacyError } = await admin
        .from("notifications")
        .insert(toLegacyNotification(notification));
      if (legacyError) {
        console.error("Server notification legacy insert failed:", legacyError);
      }
      return;
    }
    console.error("Server notification insert failed:", error);
  }
}

export async function createServerNotifications(
  notifications: NotificationInsert[],
): Promise<void> {
  if (notifications.length === 0) return;
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      "Skipping server notifications: SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    return;
  }

  const { error } = await admin.from("notifications").insert(notifications);
  if (!error) return;

  if (isSchemaCacheError(error)) {
    const { error: legacyError } = await admin
      .from("notifications")
      .insert(notifications.map(toLegacyNotification));
    if (legacyError) {
      console.error("Server notifications legacy insert failed:", legacyError);
    }
    return;
  }

  console.error("Server notifications insert failed:", error);
}

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
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

export async function sendWebPushToUsers(
  userIds: string[],
  payloadForUser: (userId: string) => PushPayload,
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueUserIds.length === 0) return;

  const admin = createAdminClient();
  if (!admin) {
    console.warn("Skipping web push batch: SUPABASE_SERVICE_ROLE_KEY is missing.");
    return;
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("user_id, subscription")
    .in("user_id", uniqueUserIds);

  if (error) {
    console.error("Push subscriptions batch lookup failed:", error);
    return;
  }

  await Promise.all(
    (data || []).map(async (row: any) => {
      if (!row.subscription) return;
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify(payloadForUser(row.user_id)),
        );
      } catch (pushErr) {
        console.error("Push delivery failed for user", row.user_id, pushErr);
      }
    }),
  );
}
