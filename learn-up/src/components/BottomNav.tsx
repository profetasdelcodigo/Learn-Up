"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Brain, MessageCircle, Bell, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Inicio", href: "/dashboard", icon: Home },
    { name: "IA", href: "/dashboard/ai", icon: Brain },
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "Notif", href: "/notifications", icon: Bell, badge: true },
    { name: "Perfil", href: "/profile", icon: User },
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
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? "text-brand-gold" : "text-gray-500"}`}
            >
              <item.icon className="w-5 h-5" />
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
