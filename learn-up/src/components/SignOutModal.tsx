import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";
import { LogOut, MonitorSmartphone, X, Laptop, Smartphone, Monitor, ChevronLeft, Loader2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Session {
  id: string;
  session_id: string;
  device_name: string;
  browser: string;
  os: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  is_current: boolean;
}

export default function SignOutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<"local" | "global" | string | null>(null);
  const [view, setView] = useState<"default" | "devices">("default");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
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

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions.filter((s: Session) => !s.revoked_at));
      }
    } catch (err) {
      console.error("Error fetching sessions", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleOpenDevices = () => {
    setView("devices");
    loadSessions();
  };

  const executeSignOut = async (scope: "local" | "global" | "specific", sessionId?: string) => {
    if (loading) return;
    setLoading(scope === "specific" && sessionId ? sessionId : scope);

    try {
      // Llamar a nuestra API route que limpia cookies en el servidor
      const res = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "specific" && sessionId
            ? { scope: "local", session_ids: [sessionId] }
            : { scope }
        ),
      });

      if (!res.ok) {
        console.warn("Fallo el signout del servidor, intentando limpiar localmente de todas formas");
      }

      // Si cerramos una sesión ESPECÍFICA que no es la actual, simplemente actualizamos la lista
      if (scope === "specific" && sessionId) {
        const targetSession = sessions.find((s) => s.session_id === sessionId);
        if (targetSession && !targetSession.is_current) {
          setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
          addToast({ message: "Sesión remota cerrada", type: "success" });
          setLoading(null);
          return;
        }
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
          onClick={() => {
            if (loading) return;
            if (view === "devices") setView("default");
            else onClose();
          }}
          disabled={!!loading}
          className="absolute top-4 right-4 rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50 z-10"
        >
          {view === "devices" ? <ChevronLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>

        {view === "default" && (
          <>
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
                    <Loader2 className="w-5 h-5 animate-spin" />
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
                onClick={handleOpenDevices}
                disabled={!!loading}
                className="flex items-center justify-center gap-2 w-full mt-2 py-2 font-semibold text-gray-500 transition-all hover:text-white disabled:opacity-50 text-sm"
              >
                <MonitorSmartphone className="w-4 h-4" />
                <span>Gestionar dispositivos conectados</span>
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
          </>
        )}

        {view === "devices" && (
          <div className="flex flex-col h-[400px]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-1">Tus Dispositivos</h2>
              <p className="text-xs text-gray-400">
                Sesiones activas en tu cuenta
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {loadingSessions ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span className="text-sm">Cargando dispositivos...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <span className="text-sm">No hay otras sesiones activas</span>
                </div>
              ) : (
                sessions.map((session) => {
                  const isMobile = session.os.toLowerCase().includes("android") || session.os.toLowerCase().includes("ios");
                  return (
                    <div key={session.session_id} className={`p-4 rounded-xl border \${session.is_current ? "border-brand-gold/30 bg-brand-gold/5" : "border-white/10 bg-white/5"} relative flex flex-col`}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                          {isMobile ? <Smartphone className="w-5 h-5 text-gray-300" /> : <Laptop className="w-5 h-5 text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {session.os} • {session.browser}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Clock className="w-3 h-3" />
                            {session.last_seen_at ? formatDistanceToNow(new Date(session.last_seen_at), { addSuffix: true, locale: es }) : "Hace poco"}
                          </div>
                          {session.is_current && (
                            <span className="inline-block px-2 py-0.5 mt-2 text-[10px] uppercase tracking-wider font-bold bg-brand-gold/20 text-brand-gold rounded-full">
                              Dispositivo Actual
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => executeSignOut("specific", session.session_id)}
                        disabled={!!loading}
                        className={`mt-4 w-full py-2 rounded-lg text-xs font-semibold transition-all \${
                          session.is_current 
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                            : "bg-white/10 text-white hover:bg-white/20"
                        } flex items-center justify-center gap-2`}
                      >
                        {loading === session.session_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            {session.is_current ? "Cerrar sesión actual" : "Cerrar sesión"}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => executeSignOut("global")}
              disabled={!!loading || sessions.length <= 1}
              className="mt-4 w-full py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === "global" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Cerrar en todos los dispositivos
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
