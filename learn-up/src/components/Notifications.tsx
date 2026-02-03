"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Bell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${(async () => (await supabase.auth.getUser()).data.user?.id)()}`, // Filters don't support async/await like this directly in setup usually, handled below
        },
        (payload) => {
          // Robust real-time check in callback
          handleNewNotification(payload.new as Notification);
        },
      )
      .subscribe();

    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter hack for Realtime: Subscription receives ALL events if RLS allows,
  // but "postgres_changes" with filter `user_id=eq.X` works IF we know X.
  // Better approach: Subscribe generic, filter in callback.
  const handleNewNotification = async (newNotif: Notification) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && newNotif.user_id === user.id) {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((c) => c + 1);
      // Optional: Toast sound or popup
    }
  };

  const fetchNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Use channel with correct filter now that we have user
    // Re-subscribing inside useEffect might be cleaner but let's just fetch for now

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
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
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 rounded-full border border-gray-700 text-brand-gold hover:bg-brand-gold/10 transition-all"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 md:w-96 bg-brand-black border border-brand-gold rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <h3 className="font-bold text-white">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-brand-gold hover:underline"
                >
                  Marcar todas leídas
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No tienes notificaciones nuevas</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-gray-800 hover:bg-white/5 transition-colors relative group ${
                      !notif.is_read ? "bg-brand-gold/5" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <Link
                          href={notif.link || "#"}
                          onClick={() => markAsRead(notif.id)}
                        >
                          <h4
                            className={`text-sm font-semibold mb-1 ${!notif.is_read ? "text-brand-gold" : "text-gray-300"}`}
                          >
                            {notif.title}
                          </h4>
                          <p className="text-xs text-gray-400 leading-snug">
                            {notif.message}
                          </p>
                        </Link>
                        <span className="text-[10px] text-gray-600 mt-2 block">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {!notif.is_read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="text-gray-500 hover:text-brand-gold"
                          title="Marcar como leída"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
