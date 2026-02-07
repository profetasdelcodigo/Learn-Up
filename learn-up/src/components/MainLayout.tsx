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
    <>
      <WelcomeTutorial />

      {!isPublicRoute && (
        <>
          <Sidebar />
          <BottomNav />
        </>
      )}

      <main
        className={`min-h-screen transition-all duration-300 ${
          !isPublicRoute ? "md:pl-64 pb-20 md:pb-0" : ""
        }`}
      >
        {children}
      </main>
    </>
  );
}
