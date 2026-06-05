"use client";

import { useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useSetAtom } from "jotai";
import { unreadNotificationsAtom } from "@/store/notifications";
import { addToastAtom } from "@/store/ui";

// Regex to filter system call tokens like [CALL_REJECTED_VOICE], [CALL_ENDED_VIDEO], etc.
const SYSTEM_REGEX = /\[CALL_[A-Z_]+\]/;
const isSystemMsg = (text?: string) => !!text && SYSTEM_REGEX.test(text);

type RealtimeNotification = {
  title?: string | null;
  message?: string | null;
  type?: string | null;
  link?: string | null;
  room_id?: string | null;
  metadata?: {
    sender_name?: string | null;
    room_name?: string | null;
  } | null;
};

function buildToastMessage(notification: RealtimeNotification) {
  const senderName = notification.metadata?.sender_name || "Alguien";

  if (notification.type === "message" || notification.title === "Nuevo Mensaje") {
    return `Nuevo mensaje de: ${senderName}`;
  }

  if (notification.type === "call") {
    return `Llamada entrante de: ${senderName}`;
  }

  if (notification.type === "video_call") {
    return `Videollamada entrante de: ${senderName}`;
  }

  return notification.message || notification.title || "Tienes una nueva notificacion";
}

export default function NotificationManager() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const setUnreadCount = useSetAtom(unreadNotificationsAtom);
  const addToast = useSetAtom(addToastAtom);

  const fetchUnreadCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setUnreadCount(count || 0);
  }, [supabase, setUnreadCount]);

  useEffect(() => {
    // Setup Realtime Listener. Push permission is requested only from an explicit user action.
    const setupListener = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Initial fetch
      fetchUnreadCount();

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as RealtimeNotification;

            fetchUnreadCount();
            addToast({ message: buildToastMessage(newNotif), type: "info" });

            if (isSystemMsg(newNotif.message || undefined) || isSystemMsg(newNotif.title || undefined)) {
              return;
            }

            if (document.hidden && Notification.permission === "granted") {
              try {
                const n = new Notification(newNotif.title || "Learn Up", {
                  body: newNotif.message || "Tienes una nueva notificacion",
                  icon: "/favicon.svg",
                  tag: newNotif.room_id || "general",
                });

                n.onclick = () => {
                  window.focus();
                  if (newNotif.link) {
                    router.push(newNotif.link);
                  }
                  n.close();
                };
              } catch (e) {
                console.error("Error showing notification:", e);
              }
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = setupListener();

    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [supabase, router, fetchUnreadCount, addToast]);

  return null; // Headless component
}
