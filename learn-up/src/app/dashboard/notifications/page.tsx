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
  senderName?: string; // resolved locally
}

// Regex to catch ALL [CALL_*] system tokens
const SYSTEM_REGEX = /\[CALL_[A-Z_]+\]/;
const isSystemMsg = (text?: string) => !!text && SYSTEM_REGEX.test(text);

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
      return "bg-brand-blue-glow/15 text-brand-blue-glow border-brand-blue-glow/20";
    case "message":
      return "bg-brand-gold/10 text-brand-gold border-brand-gold/20";
    case "call":
      return "bg-green-500/15 text-green-400 border-green-500/20";
    default:
      return "bg-brand-gold/10 text-brand-gold border-brand-gold/20";
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Simple query without FK join (avoid 400 error from missing relationship)
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, message, link, is_read, created_at, sender_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      // Filter system call tokens
      const visible = (data as Notification[]).filter(
        (n) => !isSystemMsg(n.message) && !isSystemMsg(n.title),
      );

      // Fetch sender names in a single batch query
      const senderIds = [
        ...new Set(visible.map((n) => n.sender_id).filter(Boolean)),
      ] as string[];
      let senderMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", senderIds);
        if (profiles) {
          senderMap = Object.fromEntries(
            profiles.map((p: any) => [p.id, p.full_name]),
          );
        }
      }

      setNotifications(
        visible.map((n) => ({
          ...n,
          senderName: n.sender_id ? senderMap[n.sender_id] : undefined,
        })),
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();

    const channel = supabase
      .channel("notifications_dashboard_v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchNotifications(),
      )
      .subscribe();

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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-brand-black">
      {/* Centered content — accounts for left sidebar on desktop via padding */}
      <div className="flex flex-col items-center px-4 py-8 pb-28 md:pb-8">
        <div className="w-full max-w-2xl">
          <BackButton className="mb-6" />

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Bell className="w-7 h-7 text-brand-gold" />
              Notificationes
              {unreadCount > 0 && (
                <span className="bg-brand-gold text-brand-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-gold hover:text-white border border-brand-gold/30 hover:border-brand-gold/60 px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
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
            <AnimatePresence mode="popLayout">
              {notifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 border border-gray-800 rounded-3xl"
                >
                  <Bell className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">
                    No tienes notificaciones
                  </p>
                  <p className="text-gray-700 text-sm mt-1">Estás al día 🎉</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.18 }}
                      className={`rounded-2xl border p-4 flex gap-4 transition-colors ${
                        notif.is_read
                          ? "bg-zinc-950 border-gray-800"
                          : "bg-brand-black border-brand-gold/35 shadow-[0_0_14px_rgba(212,175,55,0.06)]"
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`mt-0.5 p-2.5 rounded-full shrink-0 border ${getColor(notif.type)}`}
                      >
                        {getIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: title + time */}
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="min-w-0">
                            <h3
                              className={`font-semibold text-sm leading-tight ${notif.is_read ? "text-gray-400" : "text-white"}`}
                            >
                              {notif.title}
                            </h3>
                            {/* Sender name — shown when available */}
                            {notif.senderName && (
                              <p className="text-brand-gold text-xs font-medium mt-0.5">
                                de {notif.senderName}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 shrink-0 mt-0.5 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notif.created_at), {
                              locale: es,
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {/* Message */}
                        {notif.message && (
                          <p className="text-gray-400 text-xs mb-3 leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {notif.type === "friend_request" && (
                            <button
                              onClick={() => handleAcceptRequest(notif)}
                              className="bg-brand-gold text-brand-black px-3 py-1 rounded-full font-bold text-xs hover:bg-white transition-colors"
                            >
                              Aceptar
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
                          {/* Delete — always inline, never overlaps time */}
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
    </div>
  );
}
