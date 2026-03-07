"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import WelcomeTutorial from "./WelcomeTutorial";
import NotificationManager from "./NotificationManager";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Routes where navigation should be hidden entirely
  const publicRoutes = ["/", "/login", "/onboarding"];
  const isPublicRoute =
    publicRoutes.includes(pathname) || pathname.startsWith("/auth/");

  // Chat and AI pages have their own layout/sidebars, so remove global padding
  const isNoPaddingRoute = pathname === "/chat" || pathname.startsWith("/ai/");

  // Sidebar + BottomNav ONLY shown on Dashboard (home) and NOT on public/chat routes
  const isDashboard = pathname === "/dashboard";
  const showNav = !isPublicRoute && !isNoPaddingRoute && isDashboard;

  return (
    <div className="flex h-screen bg-brand-black overflow-hidden">
      <NotificationManager />
      <WelcomeTutorial />

      {/* Desktop sidebar — only on dashboard */}
      {showNav && (
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>
      )}

      <main
        className={`flex-1 ${isPublicRoute ? "overflow-hidden" : "overflow-y-auto"} bg-brand-black ${isNoPaddingRoute ? "p-0" : "p-4 md:p-8"} relative w-full`}
      >
        <div className="w-full h-full">{children}</div>
      </main>

      {/* Mobile bottom nav — only on dashboard */}
      {showNav && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
