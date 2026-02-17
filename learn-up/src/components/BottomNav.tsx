"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Brain, MessageCircle, Bell, User } from "lucide-react";

interface BottomNavProps {
  unreadCount?: number;
}

export default function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { name: "Inicio", href: "/dashboard", icon: Home },
    { name: "IA", href: "/ai/profesor", icon: Brain },
    { name: "Chat", href: "/chat", icon: MessageCircle },
    {
      name: "Notif",
      href: "/dashboard/notifications",
      icon: Bell,
      badge: true,
    }, // Updated href to match Sidebar
    { name: "Perfil", href: "/dashboard/profile", icon: User },
  ];

  // Hidden on desktop
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-black/95 backdrop-blur-xl border-t border-brand-gold/30 z-40"
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
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? "text-brand-gold" : "text-gray-500"}`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.badge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-brand-black">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.name}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-1 bg-brand-gold rounded-t-full shadow-[0_0_10px_#D4AF37]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
