"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import WelcomeTutorial from "./WelcomeTutorial";

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

  return (
    <div className="flex h-screen bg-brand-black overflow-hidden">
      <WelcomeTutorial />

      {!isPublicRoute && (
        <div className="hidden md:flex flex-shrink-0">
          <Sidebar />
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-brand-black p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto w-full">{children}</div>
      </main>

      {!isPublicRoute && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
