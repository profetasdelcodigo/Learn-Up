"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Bell, Check, X, UserPlus, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  sender_id: string | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select(
        `
        *,
        sender:sender_id (full_name, avatar_url)
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotifications(data as any);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request":
        return <UserPlus className="w-5 h-5" />;
      case "calendar_event":
        return <Calendar className="w-5 h-5" />;
      case "message":
        return <Bell className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-white">
      {/* Centered container for desktop */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <Bell className="w-8 h-8 text-brand-gold" />
          Notificaciones
        </h1>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-brand-gray border ${notification.is_read ? "border-gray-800" : "border-brand-gold/30"} rounded-2xl p-4 flex items-start gap-4`}
              >
                <div
                  className={`p-3 rounded-full ${notification.is_read ? "bg-gray-800" : "bg-brand-gold/10"}`}
                >
                  {getIcon(notification.type)}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">
                    {notification.title}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">
                    {notification.message}
                  </p>
                  {notification.sender && (
                    <p className="text-xs text-gray-500">
                      De: {notification.sender.full_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(notification.created_at).toLocaleString("es-ES")}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="p-2 hover:bg-green-500/10 rounded-full transition-colors"
                      title="Marcar como leída"
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="p-2 hover:bg-red-500/10 rounded-full transition-colors"
                    title="Eliminar"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
