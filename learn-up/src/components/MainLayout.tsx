"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAtomValue, useSetAtom } from "jotai";
import { toastsAtom, removeToastAtom } from "@/store/ui";
import { X } from "lucide-react";

const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });
const BottomNav = dynamic(() => import("./BottomNav"), { ssr: false });
const WelcomeTutorial = dynamic(() => import("./WelcomeTutorial"), { ssr: false });
const NotificationManager = dynamic(() => import("./NotificationManager"), { ssr: false });

// Routes where the nav and layout chrome should NOT appear
const PUBLIC_ROUTES = ["/", "/login", "/onboarding"];

// Routes that manage their own full-screen layout (no padding, no nav interference)
const FULLSCREEN_ROUTES = ["/chat"];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const toasts = useAtomValue(toastsAtom);
  const removeToast = useSetAtom(removeToastAtom);

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/auth/");

  const isFullscreen =
    FULLSCREEN_ROUTES.includes(pathname) || pathname.startsWith("/ai/");

  // Show nav on all authenticated routes
  const showNav = !isPublicRoute;

  // Sidebar only on dashboard desktop
  const isDashboard = pathname === "/dashboard";

  return (
    <div
      className={`flex w-full ${
        isFullscreen ? "h-dvh overflow-hidden" : "min-h-dvh"
      }`}
    >
      <NotificationManager />
      <WelcomeTutorial />

      {/* Global Toast Container */}
      <div 
        className="fixed right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto glass-strong border border-brand-gold/30 text-white px-4 py-3 rounded-xl shadow-glow-gold font-medium flex items-center justify-between min-w-[300px] animate-in slide-in-from-right-5 fade-in duration-300 font-body"
          >
            <span className="text-brand-gold">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 hover:bg-white/5 rounded-full p-1"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ))}
      </div>

      {/* Desktop sidebar — only on dashboard */}
      {showNav && isDashboard && (
        <div className="hidden md:flex shrink-0 sticky top-0 h-dvh">
          <Sidebar />
        </div>
      )}

      <main
        className={`flex-1 relative w-full ${
          isFullscreen ? "overflow-hidden flex flex-col" : "min-w-0"
        }`}
      >
        {/* Content wrapper */}
        <div
          className={[
            "w-full",
            // Padding bottom for bottom nav
            showNav && !isFullscreen ? "pb-nav" : "",
            isFullscreen ? "flex flex-col h-full" : "min-h-full",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — all authenticated NON-fullscreen routes */}
      {showNav && !isFullscreen && (
        <div className="fixed bottom-0 inset-x-0 md:hidden z-50">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
