"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAtomValue, useSetAtom } from "jotai";
import { toastsAtom, removeToastAtom } from "@/store/ui";
import { X } from "lucide-react";

const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });
const BottomNav = dynamic(() => import("./BottomNav"), { ssr: false });
const WelcomeTutorial = dynamic(() => import("./WelcomeTutorial"), { ssr: false });
const NotificationManager = dynamic(() => import("./NotificationManager"), { ssr: false });
const SessionHeartbeat = dynamic(() => import("./SessionHeartbeat"), { ssr: false });
import PageTransition from "./PageTransition";

const PUBLIC_ROUTES = ["/", "/login", "/onboarding"];
const FULLSCREEN_ROUTES = ["/chat"];

const responsiveUiStyles = `
  @media (max-width: 767px) {
    main:has(#chat-form) form#chat-form {
      margin-bottom: calc(4.5rem + env(safe-area-inset-bottom));
      border-radius: 1.25rem;
      padding: 0.4rem;
    }
    main:has(#chat-form) form#chat-form > div:first-of-type {
      min-height: 2.55rem !important;
      padding-top: 0 !important;
    }
    main:has(#chat-form) form#chat-form textarea {
      min-height: 2.45rem !important;
      max-height: 7rem;
      padding-top: 0.35rem !important;
      padding-bottom: 0.3rem !important;
      font-size: 0.95rem;
      line-height: 1.35;
    }
    main:has(#chat-form) form#chat-form > div:last-child {
      padding-bottom: 0.15rem !important;
    }
    main:has(#chat-form) form#chat-form button {
      min-width: 2.25rem;
      min-height: 2.25rem;
      flex-shrink: 0;
    }
    main:has(#chat-form) form#chat-form .bg-surface-3 {
      max-width: 38vw;
      overflow: hidden;
    }
    main:has(#chat-form) form#chat-form [class*="bg-white/5"][class*="rounded-2xl"] {
      padding: 0.8rem !important;
      border-radius: 1rem !important;
    }

    main:has(#chat-message-input) [class*="fixed"][class*="bottom-0"][class*="border-t"] {
      bottom: calc(4.5rem + env(safe-area-inset-bottom)) !important;
      padding: 0.55rem 0.75rem 0.55rem !important;
      background: rgba(10, 10, 15, 0.92);
      backdrop-filter: blur(18px);
    }
    main:has(#chat-message-input) .chat-bg-pattern {
      padding-bottom: 9rem !important;
    }
    main:has(#chat-message-input) [class*="max-w-[85%]"] {
      max-width: 88% !important;
    }
    main:has(#chat-message-input) textarea#chat-message-input {
      min-height: 2.65rem !important;
      padding-top: 0.55rem !important;
      padding-bottom: 0.55rem !important;
    }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    main:has(#chat-form) form#chat-form textarea {
      font-size: 0.95rem;
    }
    main:has(#chat-message-input) [class*="max-w-[85%]"] {
      max-width: 76% !important;
    }
  }
`;

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const toasts = useAtomValue(toastsAtom);
  const removeToast = useSetAtom(removeToastAtom);

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/auth/");
  const isFullscreen =
    FULLSCREEN_ROUTES.includes(pathname) || pathname.startsWith("/ai/");
  const showNav = !isPublicRoute;
  const isDashboard = pathname === "/dashboard";

  return (
    <div className={`flex w-full ${isFullscreen ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      <NotificationManager />
      <WelcomeTutorial />
      <SessionHeartbeat />

      <div
        className="fixed right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto glass-strong border border-brand-gold/30 text-white px-4 py-3 rounded-xl shadow-glow-gold font-medium flex items-center justify-between min-w-[300px] animate-in slide-in-from-right-5 fade-in duration-300 font-body"
          >
            <span className="text-brand-gold">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 hover:bg-white/5 rounded-full p-1"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ))}
      </div>

      {showNav && isDashboard && (
        <div className="hidden md:flex shrink-0 sticky top-0 h-dvh">
          <Sidebar />
        </div>
      )}

      <main className={`flex flex-col flex-1 relative w-full min-w-0 ${isFullscreen ? "overflow-hidden" : ""}`}>
        <div className={["w-full flex-1 flex flex-col", showNav && !isFullscreen ? "pb-nav" : ""].filter(Boolean).join(" ")}>
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* Keep navigation reachable on phone screens, including AI and Aprendamos Juntos fullscreen routes. */}
      {showNav && (
        <div className="fixed bottom-0 inset-x-0 md:hidden z-[80]">
          <BottomNav />
        </div>
      )}

      <style jsx global>{responsiveUiStyles}</style>
    </div>
  );
}
