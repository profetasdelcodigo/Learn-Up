"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  Trash2,
  UserPlus,
  MessageSquare,
  Phone,
  Video,
  Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { acceptFriendRequest } from "@/actions/friendship";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  sender_id?: string;
}

// Internal system message tokens that should never be shown
const SYSTEM_TOKENS = [
  "[CALL_ENDED_VOICE]",
  "[CALL_ENDED_VIDEO]",
  "[CALL_STARTED]",
  "[CALL_OFFER",
  "[CALL_ACCEPTED]",
  "[CALL_REJECTED]",
];

function isSystemMsg(msg: string): boolean {
  return SYSTEM_TOKENS.some((t) => msg?.includes(t));
}

function getIcon(type: string) {
  switch (type) {
    case "friend_request":
      return <UserPlus className="w-5 h-5" />;
    case "message":
      return <MessageSquare className="w-5 h-5" />;
    case "call":
      return <Phone className="w-5 h-5" />;
    case "video_call":
      return <Video className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
}

function getColor(type: string) {
  switch (type) {
    case "friend_request":
      return "bg-purple-500/15 text-purple-400";
    case "message":
      return "bg-brand-gold/15 text-brand-gold";
    case "call":
      return "bg-green-500/15 text-green-400";
    default:
      return "bg-brand-gold/15 text-brand-gold";
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // Stable Supabase client — never recreated on render
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Intentionally simple query — NO join so no 400 from missing FK relationship
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, message, link, is_read, created_at, sender_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      // Filter out system call messages that should never be shown
      const visible = (data as Notification[]).filter(
        (n) => !isSystemMsg(n.message || "") && !isSystemMsg(n.title || ""),
      );
      setNotifications(visible);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications_dashboard_v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchNotifications(),
      )
      .subscribe();

    // Also re-fetch on tab focus
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [supabase, fetchNotifications]);

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
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const handleAcceptRequest = async (notification: Notification) => {
    try {
      if (notification.sender_id) {
        await acceptFriendRequest(notification.sender_id);
        await deleteNotification(notification.id);
      } else {
        router.push("/chat");
      }
    } catch (e) {
      console.error("Error accepting friend request:", e);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8 md:pl-72 pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto mt-8 md:mt-0">
        <BackButton className="mb-6" />

        <div className="flex items-center justify-between mb-8 border-b border-brand-gold/20 pb-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-brand-gold" />
            Centro de Notificaciones
          </h1>
          {notifications.some((n) => !n.is_read) && (
            <button
              onClick={markAllRead}
              className="text-xs text-brand-gold hover:text-white border border-brand-gold/30 hover:border-brand-gold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Marcar todas como leídas
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
          </div>
        ) : (
          <AnimatePresence>
            {notifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 border border-gray-800 rounded-3xl bg-brand-black/50"
              >
                <Bell className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  No tienes notificaciones
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl border p-4 flex gap-3 transition-all ${
                      notif.is_read
                        ? "bg-brand-black/40 border-gray-800"
                        : "bg-brand-black/80 border-brand-gold/40 shadow-[0_0_12px_rgba(212,175,55,0.05)]"
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`mt-0.5 p-2.5 rounded-full shrink-0 ${getColor(notif.type)}`}
                    >
                      {getIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                          className={`font-semibold text-sm leading-tight ${notif.is_read ? "text-gray-400" : "text-white"}`}
                        >
                          {notif.title}
                        </h3>
                        <span className="text-xs text-gray-600 shrink-0 mt-0.5">
                          {formatDistanceToNow(new Date(notif.created_at), {
                            locale: es,
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      {notif.message && !isSystemMsg(notif.message) && (
                        <p className="text-gray-400 text-sm mb-3 leading-relaxed truncate">
                          {notif.message}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {notif.type === "friend_request" && (
                          <button
                            onClick={() => handleAcceptRequest(notif)}
                            className="bg-brand-gold text-brand-black px-3 py-1.5 rounded-full font-semibold text-xs hover:bg-white transition-colors"
                          >
                            Aceptar Solicitud
                          </button>
                        )}
                        {notif.link && notif.type !== "friend_request" && (
                          <button
                            onClick={() => router.push(notif.link!)}
                            className="text-brand-gold text-xs font-bold hover:underline"
                          >
                            Ver detalles
                          </button>
                        )}
                        {/* Inline delete — never overlaps timestamp */}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="ml-auto p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
