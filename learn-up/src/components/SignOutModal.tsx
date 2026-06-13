"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";
import { LogOut, MonitorSmartphone, X } from "lucide-react";

export default function SignOutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<"local" | "global" | null>(null);
  const [mounted, setMounted] = useState(false);
  const addToast = useSetAtom(addToastAtom);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, loading]);

  const executeSignOut = async (scope: "local" | "global") => {
    if (loading) return;
    setLoading(scope);

    try {
      // Llamar a nuestra API route que limpia cookies en el servidor
      const res = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });

      if (!res.ok) {
        console.warn("Fallo el signout del servidor, intentando limpiar localmente de todas formas");
      }

      // Limpieza exhaustiva en el cliente para evitar "sesiones fantasmas"
      await supabase.auth.signOut({ scope: scope === "global" ? "global" : "local" });
      
      if (typeof window !== "undefined") {
        // Purgar todo el almacenamiento local
        window.localStorage.clear();
        window.sessionStorage.clear();
        
        // Hard redirect para matar el estado de React (Jotai)
        window.location.replace("/login?msg=sesion_cerrada");
      }
    } catch (error) {
      console.error("Error signing out:", error);
      addToast({ message: "Hubo un problema al cerrar sesión.", type: "error" });
      setLoading(null);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-brand-black/90 p-4 backdrop-blur-xl transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => !loading && onClose()}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-brand-gold/20 bg-zinc-950 shadow-[0_24px_80px_rgba(212,175,55,0.15)] p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={!!loading}
          className="absolute top-4 right-4 rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <LogOut className="w-8 h-8 text-red-500 ml-1" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Cerrar Sesión</h2>
          <p className="text-gray-400 text-sm">
            ¿Cómo deseas cerrar tu sesión?
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => executeSignOut("local")}
            disabled={!!loading}
            className="group relative flex items-center justify-center gap-3 w-full rounded-2xl bg-red-500/10 border border-red-500/20 py-4 font-bold text-red-500 transition-all hover:bg-red-500/20 active:scale-95 disabled:opacity-70 disabled:hover:scale-100 overflow-hidden"
          >
            {loading === "local" ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                Cerrando sesión...
              </span>
            ) : (
              <>
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => executeSignOut("global")}
            disabled={!!loading}
            className="flex items-center justify-center gap-2 w-full mt-2 py-2 font-semibold text-gray-500 transition-all hover:text-white disabled:opacity-50 text-sm"
          >
            {loading === "global" ? (
              <span className="animate-pulse">Cerrando en todos...</span>
            ) : (
              <>
                <MonitorSmartphone className="w-4 h-4" />
                <span>Cerrar sesión en todos mis dispositivos</span>
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            disabled={!!loading}
            className="mt-4 text-sm text-gray-400 hover:text-white transition-colors underline decoration-white/20 underline-offset-4"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
