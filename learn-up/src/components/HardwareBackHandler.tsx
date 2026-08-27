"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

// Routes where back button should exit the app (root screens)
const ROOT_ROUTES = ["/dashboard", "/login", "/onboarding", "/"];

/**
 * HardwareBackHandler
 * Listens to the Capacitor Android hardware back button and iOS swipe-back gesture.
 * - If the user is on a root route → calls App.exitApp() to exit the app.
 * - Otherwise → calls router.back() just like the on-screen BackButton.
 * Works only on native platforms; on web it is a no-op.
 */
export default function HardwareBackHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Capacitor is only available on native platforms; guard against SSR / browser.
    const loadCapacitor = async () => {
      try {
        const { App } = await import("@capacitor/app");

        const handler = await App.addListener(
          "backButton",
          ({ canGoBack }: { canGoBack: boolean }) => {
            // If we're at a root screen, exit the app
            if (ROOT_ROUTES.includes(pathname)) {
              App.exitApp();
            } else {
              // Otherwise navigate back in history
              if (canGoBack) {
                window.history.back();
              } else {
                router.back();
              }
            }
          },
        );

        cleanup = () => {
          handler.remove();
        };
      } catch {
        // Capacitor not available (browser environment) — silently ignore
      }
    };

    loadCapacitor();

    return () => {
      cleanup?.();
    };
  }, [pathname, router]);

  return null; // This component renders nothing
}
