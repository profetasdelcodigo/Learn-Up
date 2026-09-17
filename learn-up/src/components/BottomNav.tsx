"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Brain, MessageCircle, Bell, User, Settings } from "lucide-react";
import { useAtomValue } from "jotai";
import { unreadNotificationsAtom } from "@/store/notifications";

export default function BottomNav() {
  const pathname = usePathname();
  const unreadCount = useAtomValue(unreadNotificationsAtom);

  // Mobile mirrors the essential destinations from the desktop sidebar,
  // including direct access to Settings.
  const navItems = [
    { name: "Inicio", href: "/dashboard", icon: Home },
    { name: "IA", href: "/ai/profesor", icon: Brain },
    { name: "Aprendamos", href: "/chat", icon: MessageCircle },
    { name: "Avisos", href: "/dashboard/notifications", icon: Bell, badge: true },
    { name: "Perfil", href: "/dashboard/profile", icon: User },
    { name: "Ajustes", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-black/55 backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.28)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-6 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-center transition-all duration-200 active:scale-95 ${isActive ? "text-brand-gold" : "text-gray-400"}`}
            >
              <span className={`relative flex h-8 w-10 items-center justify-center rounded-2xl transition-all ${isActive ? "bg-brand-gold/10" : "bg-transparent"}`}>
                <Icon className={`h-[1.2rem] w-[1.2rem] ${isActive ? "drop-shadow-[0_0_7px_rgba(240,200,80,0.45)]" : ""}`} strokeWidth={isActive ? 2.2 : 1.9} />
                {item.badge && unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#0A0A0F] bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate px-0.5 text-[9px] font-semibold leading-none font-body">{item.name}</span>
              {isActive && <span className="absolute bottom-0 h-0.5 w-7 rounded-t-full bg-brand-gold shadow-[0_0_10px_rgba(240,200,80,0.55)]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
