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
      className="flex bg-brand-black"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <NotificationManager />
      <WelcomeTutorial />

      {/* Desktop sidebar — only on dashboard */}
      {showNav && isDashboard && (
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>
      )}

      <main
        className={[
          "flex-1 relative w-full",
          isPublicRoute ? "" : "flex flex-col",
          // Fullscreen routes manage their own scroll internally
          isFullscreen ? "overflow-hidden" : "overflow-y-auto",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Content wrapper */}
        <div
          className={[
            "w-full",
            isPublicRoute ? "h-full" : "",
            // Non-fullscreen authenticated pages need bottom padding so content
            // is not hidden behind the BottomNav
            showNav && !isFullscreen ? "pb-nav" : "",
            isFullscreen ? "h-full flex flex-col" : "",
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
