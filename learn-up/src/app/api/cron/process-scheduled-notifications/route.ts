import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createServerNotifications, sendWebPushToUsers } from "@/utils/server-notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Admin client unavailable" }, { status: 500 });

  const now = new Date().toISOString();
  const { data: due, error } = await admin
    .from("scheduled_notifications")
    .select("id,user_id,title,message,link,send_at,metadata,attempts")
    .is("sent_at", null)
    .lte("send_at", now)
    .order("send_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ success: true, processed: 0 });

  const notifications = due.map((item: any) => ({
    user_id: item.user_id,
    title: item.title,
    message: item.message,
    type: "calendar_reminder",
    link: item.link || "/calendar",
    is_read: false,
    source: "scheduled_reminder",
    priority: "high" as const,
    metadata: item.metadata || {},
  }));

  await createServerNotifications(notifications);

  const byUser = new Map<string, any>();
  for (const item of due) byUser.set(item.user_id, item);
  await sendWebPushToUsers([...byUser.keys()], (userId) => {
    const item = byUser.get(userId)!;
    return { title: item.title, message: item.message, link: item.link || "/calendar" };
  });

  const ids = due.map((item: any) => item.id);
  const { error: updateError } = await admin
    .from("scheduled_notifications")
    .update({ sent_at: new Date().toISOString(), attempts: 1 })
    .in("id", ids);

  if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true, processed: due.length });
}
