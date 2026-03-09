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
      className="flex bg-brand-black overflow-hidden"
      style={{ height: "100dvh" }}
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
          "flex-1 relative w-full overflow-hidden",
          isPublicRoute ? "" : "flex flex-col",
          isFullscreen ? "p-0" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          isFullscreen
            ? {}
            : {
                // On non-fullscreen pages, main scroll area avoids BottomNav
                overflowY: "auto",
              }
        }
      >
        {/* Content area — add bottom padding so BottomNav doesn't hide content */}
        <div
          className={[
            "w-full",
            isPublicRoute ? "h-full" : "",
            // On non-fullscreen authenticated pages, add pb-nav so content
            // isn't hidden behind the BottomNav
            showNav && !isFullscreen ? "pb-nav" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — all authenticated routes */}
      {showNav && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
