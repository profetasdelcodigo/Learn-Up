"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Brain, MessageCircle, Bell, User } from "lucide-react";
import { useSetAtom, useAtomValue } from "jotai";
import { isGlobalLoadingAtom } from "@/store/loader";
import { unreadNotificationsAtom } from "@/store/notifications";

export default function BottomNav() {
  const pathname = usePathname();
  const setIsGlobalLoading = useSetAtom(isGlobalLoadingAtom);
  const unreadCount = useAtomValue(unreadNotificationsAtom);

  const navItems = [
    { name: "Inicio", href: "/dashboard", icon: Home },
    { name: "IA", href: "/ai/profesor", icon: Brain },
    { name: "Aprendamos", href: "/chat", icon: MessageCircle },
    {
      name: "Notif",
      href: "/dashboard/notifications",
      icon: Bell,
      badge: true,
    },
    { name: "Perfil", href: "/dashboard/profile", icon: User },
    { name: "Ajustes", href: "/dashboard/settings", icon: () => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ) },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-white/6 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${isActive ? "text-brand-gold" : "text-gray-500"}`}
            >
              <div className="relative">
                <item.icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_6px_rgba(240,200,80,0.5)]" : ""}`} />
                {item.badge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-brand-black">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium font-body">{item.name}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-brand-gold rounded-t-full shadow-[0_0_8px_rgba(240,200,80,0.6)]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
