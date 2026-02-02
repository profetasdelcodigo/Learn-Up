"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Brain, Calendar, MessageCircle, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Inicio", href: "/dashboard", icon: Home },
    { name: "IA", href: "/ai/profesor", icon: Brain },
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "Agenda", href: "/calendar", icon: Calendar },
    { name: "Perfil", href: "/dashboard/profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-black/95 backdrop-blur-xl border-t border-brand-gold/30 md:hidden pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive
                  ? "text-brand-gold"
                  : "text-gray-500 hover:text-brand-gold/70"
              }`}
            >
              <item.icon
                className={`w-6 h-6 ${isActive ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" : ""}`}
              />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
