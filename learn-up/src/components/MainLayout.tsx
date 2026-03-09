"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import WelcomeTutorial from "./WelcomeTutorial";
import NotificationManager from "./NotificationManager";

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
      className={`flex bg-brand-black w-full ${
        isFullscreen ? "h-dvh overflow-hidden" : "min-h-dvh"
      }`}
    >
      <NotificationManager />
      <WelcomeTutorial />

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
            "w-full h-full",
            // Padding bottom for bottom nav
            showNav && !isFullscreen ? "pb-nav" : "",
            isFullscreen ? "flex flex-col" : "",
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
