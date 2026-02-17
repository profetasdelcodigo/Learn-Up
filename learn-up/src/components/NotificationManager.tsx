"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function NotificationManager() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // 1. Request Permission on Mount
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

            // Trigger Native Notification if hidden
            if (document.hidden && Notification.permission === "granted") {
              try {
                const n = new Notification(newNotif.title || "Learn Up", {
                  body: newNotif.message,
                  icon: "/favicon.svg", // Fallback icon
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
