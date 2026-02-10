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
  X,
} from "lucide-react";
import BottomNav from "./BottomNav";
import Logo from "./Logo";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

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
    name: "Notificaciones",
    href: "/dashboard/notifications",
    icon: Bell,
    showBadge: true, // Mark this item to show notification badge
  },
  {
    name: "Chat",
    href: "/chat",
    icon: MessageCircle,
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
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  // Toast Notification State
  const [toasts, setToasts] = useState<
    {
      id: string;
      message: string;
      type: "info" | "success" | "error" | "warning";
    }[]
  >([]);

  const addToast = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
  ) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Real-time subscription for new notifications
    const setupRealtime = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        const channel = supabase
          .channel("notifications")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${currentUser.id}`,
            },
            (payload) => {
              fetchUnreadCount(); // Refresh count on new notification
              // Show Toast
              const newNotification = payload.new as any;
              addToast(
                newNotification.message || "Tienes una nueva notificación",
                "info",
              );
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              fetchUnreadCount(); // Refresh count when marked as read
            },
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    setupRealtime();
  }, [supabase]);

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-brand-gold text-brand-black px-4 py-3 rounded-xl shadow-lg font-medium flex items-center justify-between min-w-[300px] animate-in slide-in-from-right-5 fade-in duration-300"
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 hover:bg-black/10 rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav unreadCount={unreadCount} />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-full bg-brand-black border-r border-brand-gold flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <Link href="/dashboard">
            <Logo />
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
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all relative ${
                      isActive
                        ? "bg-brand-gold text-brand-black font-semibold shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                        : "text-gray-300 hover:bg-brand-gold/10 hover:text-brand-gold"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {/* Notification Badge */}
                    {item.showBadge && unreadCount > 0 && (
                      <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-brand-black">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
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
