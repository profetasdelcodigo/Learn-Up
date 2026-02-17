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

  // Routes where navigation should be hidden
  const publicRoutes = ["/", "/login", "/onboarding"];
  const isPublicRoute =
    publicRoutes.includes(pathname) || pathname.startsWith("/auth/");

  // Hide sidebar on chat page (has its own sidebar)
  const isChatPage = pathname === "/chat";

  return (
    <div className="flex h-screen bg-brand-black overflow-hidden">
      <NotificationManager />
      <WelcomeTutorial />

      {!isPublicRoute && !isChatPage && (
        <div className="hidden md:flex flex-shrink-0">
          <Sidebar />
        </div>
      )}

      <main
        className={`flex-1 overflow-y-auto bg-brand-black ${isChatPage ? "p-0" : "p-4 md:p-8"} relative`}
      >
        <div
          className={isChatPage ? "w-full h-full" : "max-w-6xl mx-auto w-full"}
        >
          {children}
        </div>
      </main>

      {!isPublicRoute && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
