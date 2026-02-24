"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

// Regex to filter system call tokens like [CALL_REJECTED_VOICE], [CALL_ENDED_VIDEO], etc.
const SYSTEM_REGEX = /\[CALL_[A-Z_]+\]/;
const isSystemMsg = (text?: string) => !!text && SYSTEM_REGEX.test(text);

export default function NotificationManager() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    // 1. Request permission on mount
    const requestPermission = async () => {
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    };
    requestPermission();

    // 2. Setup Realtime Listener
    const setupListener = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

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
            const newNotif = payload.new;

            // Skip system call tokens — never show them as native notifications
            if (isSystemMsg(newNotif.message) || isSystemMsg(newNotif.title))
              return;

            // Trigger Native Notification if the tab is hidden
            if (document.hidden && Notification.permission === "granted") {
              try {
                const n = new Notification(newNotif.title || "Learn Up", {
                  body: newNotif.message,
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
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = setupListener();

    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [supabase, router]);

  return null; // Headless component
}
