"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Bell,
  Check,
  X,
  UserPlus,
  Calendar,
  MessageSquare,
  Video,
  Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  // Stable client ref — never recreated
  const supabase = useMemo(() => createClient(), []);

  const loadNotifications = useCallback(async () => {
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
  }, [supabase]);

  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications in real-time
    const channel = supabase
      .channel("notifications_rt")
      .on(
        "postgres_changes",
        {
          event: "*",
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
  }, [supabase, loadNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request":
        return <UserPlus className="w-5 h-5" />;
      case "calendar_event":
        return <Calendar className="w-5 h-5" />;
      case "message":
        return <MessageSquare className="w-5 h-5" />;
      case "call":
        return <Phone className="w-5 h-5" />;
      case "video_call":
        return <Video className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getTitle = (notification: Notification) => {
    const senderName = notification.sender?.full_name || "Alguien";
    switch (notification.type) {
      case "message":
        return `Nuevo mensaje de ${senderName}`;
      case "friend_request":
        return `Solicitud de amistad de ${senderName}`;
      case "call":
        return `Llamada de voz de ${senderName}`;
      case "video_call":
        return `Videollamada de ${senderName}`;
      default:
        return notification.title?.startsWith("Nuevo Mensaje")
          ? `Nuevo mensaje de ${senderName}`
          : notification.title;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 border-b border-brand-gold/20 pb-4">
          <Bell className="w-8 h-8 text-brand-gold" />
          Centro de Notificaciones
        </h1>

        <AnimatePresence>
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No tienes notificaciones</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.2 }}
                  className={`w-full bg-brand-gray border ${
                    notification.is_read
                      ? "border-gray-800"
                      : "border-brand-gold/30"
                  } rounded-2xl p-5 shadow-lg`}
                >
                  {/* Top row: icon + title + timestamp */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`p-3 rounded-full shrink-0 ${
                        notification.is_read
                          ? "bg-gray-800 text-gray-400"
                          : "bg-brand-gold/10 text-brand-gold"
                      }`}
                    >
                      {getIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-base leading-tight">
                          {getTitle(notification)}
                        </h3>
                        <ClientDate
                          dateString={notification.created_at}
                          format="long"
                          className="text-xs text-gray-500 font-medium shrink-0 mt-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Message body */}
                  <p className="text-sm text-gray-300 mb-4 leading-relaxed pl-14">
                    {notification.message}
                  </p>

                  {/* Action buttons — all in one row on the right */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-green-500 font-bold"
                      >
                        <Check className="w-3.5 h-3.5" /> Marcar Leída
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-red-500 font-bold"
                    >
                      <X className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
