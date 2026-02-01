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
} from "lucide-react";
import BottomNav from "./BottomNav";

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
      { name: "Modo Práctica", href: "/ai/practica" },
      { name: "Consejero IA", href: "/ai/consejero" },
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
    name: "Chat",
    href: "/chat",
    icon: MessageCircle,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-brand-black border-r border-brand-gold flex-col z-30">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-brand-gold">Learn Up</h1>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.children &&
                  item.children.some((child) => pathname === child.href));

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                      isActive
                        ? "bg-brand-gold text-brand-black font-semibold shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                        : "text-gray-300 hover:bg-brand-gold/10 hover:text-brand-gold"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>

                  {/* Submenu */}
                  {item.children && (
                    <ul className="mt-2 ml-8 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={`block px-4 py-2 text-sm rounded-xl transition-all ${
                              pathname === child.href
                                ? "bg-brand-gold/20 text-brand-gold"
                                : "text-gray-400 hover:bg-brand-gold/10 hover:text-brand-gold"
                            }`}
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full px-4 py-3 text-sm text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10 rounded-2xl transition-all text-center"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
