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
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ClientDate from "@/components/ClientDate";
import PageLayout from "@/components/PageLayout";

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

function getIcon(type: string) {
  const cls = "w-5 h-5";
  switch (type) {
    case "friend_request":
      return <UserPlus className={cls} />;
    case "calendar_event":
      return <Calendar className={cls} />;
    case "message":
      return <MessageSquare className={cls} />;
    case "call":
      return <Phone className={cls} />;
    case "video_call":
      return <Video className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}

function getNotificationTitle(notification: Notification) {
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
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const loadNotifications = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select(`*, sender:sender_id (full_name, avatar_url)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setNotifications(data as any);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("notifications_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => loadNotifications(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const clearAll = async () => {
    setNotifications([]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notifications").delete().eq("user_id", user.id);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <PageLayout
      icon={<Bell className="w-7 h-7 text-brand-gold" />}
      title="Notificaciones"
      subtitle={
        unreadCount > 0
          ? `${unreadCount} sin leer`
          : "Todo al día"
      }
      actions={
        notifications.length > 0 ? (
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-sm font-semibold hover:bg-red-500/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar todo
          </button>
        ) : undefined
      }
      glow
    >
      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-surface-2 rounded-2xl animate-pulse border border-white/6"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Bell className="w-10 h-10" />
          </div>
          <p className="empty-state-title">Sin notificaciones</p>
          <p className="empty-state-desc">
            Cuando alguien te envíe algo, aparecerá aquí.
          </p>
        </div>
      )}

      {/* Notification list */}
      {!loading && notifications.length > 0 && (
        <AnimatePresence>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className={`notification-item ${!notification.is_read ? "notification-item-unread" : ""}`}
              >
                {/* Top row */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar / icon */}
                  {notification.sender?.avatar_url ? (
                    <img
                      src={notification.sender.avatar_url}
                      alt={notification.sender.full_name}
                      className="w-11 h-11 rounded-full object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div
                      className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center ${
                        notification.is_read
                          ? "bg-gray-800 text-gray-400"
                          : "bg-brand-gold/10 text-brand-gold"
                      }`}
                    >
                      {getIcon(notification.type)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold text-white text-sm leading-snug">
                        {getNotificationTitle(notification)}
                      </h3>
                      <ClientDate
                        dateString={notification.created_at}
                        format="long"
                        className="text-xs text-gray-500 font-medium shrink-0 mt-0.5"
                      />
                    </div>
                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-xs text-green-500 font-bold transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Marcar leída
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs text-red-500 font-bold transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </PageLayout>
  );
}
