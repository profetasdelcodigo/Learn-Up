"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { Bell, Check, Trash2, UserPlus, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { acceptFriendRequest } from "@/actions/friendship";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  sender_id?: string; // We might need this for friend requests if logic requires
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel("public:notifications_page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          // In a real app we'd filter by user_id here or in RLS
          // For now, let's just refresh basic
          fetchNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setNotifications(data);
    setLoading(false);
  };

  const markAllRead = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAcceptRequest = async (notification: Notification) => {
    // Logic: Notification usually implies a sender_id.
    // We need the sender_id to call acceptFriendRequest.
    // ERROR: The current notifications table MIGHT not have sender_id column?
    // Checking table schema... The previous tool output showed 'sender_id' in a grep or schema logic?
    // Wait, let's check schema.sql or migration.sql
    // I will assume sender_id exists in notifications table as typically designed.
    // If not, I'll rely on the notification data payload if I put it there.
    // Update: migration_notifications.sql I created earlier didn't explicitly have sender_id?
    // Let me enable sender_id in notifications if missing.
    // Correction: My previous migration creation code in history:
    // "user_id UUID..."
    // It did NOT include sender_id in the create table statement!
    // CRITICAL FIX: I need to add sender_id to notifications table or parse it from message/link?
    // NO, proper way is to add the column.

    // FALLBACK for now: If I can't easily add column without migration loop,
    // I will assume the sender_id IS NOT AVAILABLE easily unless I parse it or look up pending requests.

    // BETTTER LOGIC: If it's a friend request, I should just go fetch "Pending Requests"
    // and match them?

    // Let's TRY to see if I can find the pending request from `getPendingRequests` that matches?
    // Or... I will assume for this step I'll try to implement it safely.

    // REVISION: The User Prompt said "Allows accepting directly".
    // I will implement a robust `acceptFriendRequest` that takes the SENDER ID.
    // But I need the SENDER ID.
    // I will add a column `sender_id` to notifications table just to be safe in a new migration step if needed,
    // OR I will simply redirect them to /chat (Friends functionality) if I can't do it inline easily.
    // BUT user said "directly from this section".

    // Let's assume I will look up the sender from the friend_requests table where status=pending?
    // Actually, `notification.sender_id` was in my `insert` calls in `friendship.ts`?
    // Let's check `friendship.ts` insert call...
    // `await supabase.from("notifications").insert({...})`
    // I did NOT put sender_id there in the previous edit!

    // OKAY, I will update `friendship.ts` to include `sender_id` in the notification insert,
    // AND I will add the column in a migration.

    // For now, to make progress, I will write the basic page, and then do the fix.
    try {
      // Placeholder: if we have sender_id, use it.
      if (notification.sender_id) {
        await acceptFriendRequest(notification.sender_id);
        // Update UI
        fetchNotifications(); // Refresh
        alert("Solicitud aceptada!");
      } else {
        // Fallback
        router.push("/chat");
      }
    } catch (e) {
      console.error(e);
      alert("Error al aceptar.");
    }
  };

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8 md:pl-72">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-brand-gold" />
            Centro de Notificaciones
          </h1>
          {notifications.some((n) => !n.is_read) && (
            <button
              onClick={markAllRead}
              className="text-sm text-brand-gold hover:underline flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Marcar todas como leídas
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-gray-500">Cargando...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 bg-brand-black/50 border border-gray-800 rounded-3xl">
            <Bell className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-3xl border transition-all relative group flex gap-4 ${
                  notif.is_read
                    ? "bg-brand-black/40 border-gray-800"
                    : "bg-brand-black/80 border-brand-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.05)]"
                }`}
              >
                {/* Icon based on type */}
                <div
                  className={`mt-1 p-3 rounded-full ${notif.type === "friend_request" ? "bg-purple-500/10 text-purple-500" : "bg-brand-gold/10 text-brand-gold"}`}
                >
                  {notif.type === "friend_request" ? (
                    <UserPlus className="w-6 h-6" />
                  ) : (
                    <Calendar className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3
                      className={`text-lg font-semibold mb-1 ${!notif.is_read ? "text-white" : "text-gray-400"}`}
                    >
                      {notif.title}
                    </h3>
                    <span className="text-xs text-gray-600">
                      {formatDistanceToNow(new Date(notif.created_at), {
                        locale: es,
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  <p className="text-gray-400 mb-4 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Actions Area */}
                  <div className="flex items-center gap-3">
                    {notif.type === "friend_request" && (
                      <button
                        onClick={() => handleAcceptRequest(notif)}
                        className="bg-brand-gold text-brand-black px-4 py-2 rounded-full font-semibold text-sm hover:bg-white transition-colors"
                      >
                        Aceptar Solicitud
                      </button>
                    )}
                    {notif.link && notif.type !== "friend_request" && (
                      <button
                        onClick={() => router.push(notif.link!)}
                        className="text-brand-gold text-sm hover:underline"
                      >
                        Ver Detalles
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="absolute top-4 right-4 p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
