"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

export default function ConditionalNav() {
  const pathname = usePathname();

  // Routes where navigation should be hidden
  const publicRoutes = ["/", "/login", "/onboarding"];
  const shouldHideNav =
    publicRoutes.includes(pathname) || pathname.startsWith("/auth/");

  if (shouldHideNav) return null;

  return (
    <>
      <Sidebar />
      <BottomNav />
    </>
  );
}
