"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Bell, Check, X, UserPlus, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import ClientDate from "@/components/ClientDate";

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
    // Delete notification instantly to auto-remove from section
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
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
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-8 flex items-center justify-center gap-3 w-full border-b border-brand-gold/20 pb-4">
          <Bell className="w-8 h-8 text-brand-gold" />
          Centro de Notificaciones
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
                className={`w-full bg-brand-gray border ${notification.is_read ? "border-gray-800" : "border-brand-gold/30"} rounded-2xl p-5 flex items-start gap-4 shadow-lg`}
              >
                <div
                  className={`p-3 rounded-full mt-1 ${notification.is_read ? "bg-gray-800 text-gray-400" : "bg-brand-gold/10 text-brand-gold"}`}
                >
                  {getIcon(notification.type)}
                </div>

                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-white mb-1 text-lg">
                    {notification.type === "message" ||
                    notification.title === "Nuevo Mensaje"
                      ? `Nuevo mensaje de: ${notification.sender?.full_name || "Usuario Desconocido"}`
                      : notification.title}
                  </h3>
                  <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                    {notification.message}
                  </p>
                  <ClientDate
                    dateString={notification.created_at}
                    format="long"
                    className="text-xs text-gray-500 block font-medium"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 self-center ml-auto">
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
