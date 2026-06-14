"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Brain,
  Calendar,
  ChefHat,
  BookOpen,
  MessageCircle,
  Bell,
  Camera,
  LogOut,
} from "lucide-react";
import Logo from "./Logo";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { unreadNotificationsAtom } from "@/store/notifications";
import SignOutModal from "./SignOutModal";

const navigation = [
  {
    name: "Inicio",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "Potencia tu Mente",
    href: "/ai/profesor",
    icon: Brain,
    children: [
      { name: "Profesor IA", href: "/ai/profesor" },
      { name: "Examen IA", href: "/ai/practica" },
      { name: "Consejero IA", href: "/ai/consejero" },
      { name: "Aprendamos Juntos", href: "/chat" },
    ],
  },
  {
    name: "Hora de Actuar",
    href: "/calendar",
    icon: Calendar,
  },
  {
    name: "Nutrirecetas",
    href: "/ai/recetas",
    icon: ChefHat,
  },
  {
    name: "Biblioteca",
    href: "/library",
    icon: BookOpen,
  },
  {
    name: "Álbum del Saber",
    href: "/album",
    icon: Camera,
  },
  {
    name: "Notificaciones",
    href: "/dashboard/notifications",
    icon: Bell,
    showBadge: true,
  },
  {
    name: "Mi Perfil",
    href: "/dashboard/profile",
    icon: (props: any) => (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const unreadCount = useAtomValue(unreadNotificationsAtom);
  const [showSignOut, setShowSignOut] = useState(false);

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col h-full bg-surface-1 border-r border-white/6 md:w-[72px] lg:w-64 transition-all duration-300 z-40">
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-white/6 flex justify-center lg:justify-start overflow-hidden whitespace-nowrap">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="lg:hidden text-brand-gold font-bold text-xl">LU</span>
            <div className="hidden lg:block"><Logo /></div>
          </Link>
        </div>
        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4 custom-scrollbar overflow-x-hidden">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.children &&
                  item.children.some((child) => pathname === child.href));

              return (
                <li key={item.name} className="group/item">
                  <Link
                    href={item.href}
                    title={item.name}
                    className={`flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3 rounded-xl transition-all duration-300 relative font-body ${
                      isActive
                        ? "bg-gradient-to-r from-brand-gold to-brand-gold-dim text-brand-black font-semibold shadow-glow-gold"
                        : "text-gray-400 hover:bg-white/5 hover:text-brand-gold"
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="hidden lg:inline whitespace-nowrap opacity-100 transition-opacity">{item.name}</span>
                    {/* Notification Badge */}
                    {item.showBadge && unreadCount > 0 && (
                      <span className="absolute top-2 right-2 lg:right-2 flex items-center justify-center w-4 h-4 lg:w-5 lg:h-5 bg-red-500 text-white text-[10px] lg:text-xs font-bold rounded-full border border-surface-1">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>

                  {/* Submenu solo en desktop (lg) */}
                  {item.children && (
                    <ul className="hidden lg:block mt-2 ml-8 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={`block px-4 py-2 text-sm rounded-lg transition-all duration-300 font-body whitespace-nowrap ${
                              pathname === child.href
                                ? "bg-brand-gold/10 text-brand-gold border-l-2 border-brand-gold"
                                : "text-gray-500 hover:bg-white/3 hover:text-brand-gold"
                            }`}
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {/* Tooltip para submenu en tablet (md) - Se podría implementar si se desea */}
                </li>
              );
            })}
          </ul>
        </nav>
        {/* Footer */}
        <div className="p-3 lg:p-4 border-t border-white/6">
          <button
            onClick={() => setShowSignOut(true)}
            title="Cerrar Sesión"
            className="w-full p-3 lg:px-4 lg:py-3 text-sm text-gray-500 hover:text-brand-gold hover:bg-white/3 rounded-xl transition-all duration-300 text-center font-body flex justify-center lg:justify-start items-center gap-2"
          >
            <LogOut className="w-5 h-5 lg:hidden" />
            <span className="hidden lg:inline">Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      <SignOutModal open={showSignOut} onClose={() => setShowSignOut(false)} />
    </>
  );
}
