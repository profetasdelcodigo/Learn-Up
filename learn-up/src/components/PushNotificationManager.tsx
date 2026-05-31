"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export default function PushNotificationManager() {
  const supabase = useMemo(() => createClient(), []);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const syncEnabled = () => {
      setEnabled(localStorage.getItem("learnup_push_enabled") === "true");
    };

    syncEnabled();
    window.addEventListener("learnup:push-enabled", syncEnabled);
    return () => window.removeEventListener("learnup:push-enabled", syncEnabled);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    async function setupPush() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const platform = Capacitor.getPlatform();

      if (platform === "web") {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          return;
        }

        try {
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();

          if (!subscription) {
            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!publicVapidKey) return;

            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
            });
          }

          // Send subscription to backend
          await fetch("/api/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "subscribe",
              subscription,
            }),
          });
        } catch (e) {
          console.error("Error setting up web push notifications:", e);
        }
      } else {
        // Capacitor Android/iOS
        try {
          let permStatus = await PushNotifications.checkPermissions();

          if (permStatus.receive === "prompt") {
            permStatus = await PushNotifications.requestPermissions();
          }

          if (permStatus.receive !== "granted") {
            console.warn("User denied push permissions on native");
            return;
          }

          await PushNotifications.register();

          PushNotifications.addListener("registration", async (token) => {
            // Capacitor token is usually for FCM or APNS
            // For simplicity, we store it in the same table, the backend will need to know it's a native token
            // if we use a unified sender. Or we can wrap it as a "subscription" object.
            await fetch("/api/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "subscribe",
                subscription: {
                  endpoint: "native-capacitor",
                  keys: { token: token.value, platform: platform },
                },
              }),
            });
          });

          PushNotifications.addListener("registrationError", (error: any) => {
            console.error("Push registration error: ", error);
          });

          PushNotifications.addListener(
            "pushNotificationReceived",
            (notification) => {
              console.log("Push received: ", notification);
            },
          );

          PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (notification) => {
              console.log("Push action performed: ", notification);
            },
          );
        } catch (e) {
          console.error("Error setting up native push notifications:", e);
        }
      }
    }

    setupPush();
  }, [enabled, supabase]);

  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
