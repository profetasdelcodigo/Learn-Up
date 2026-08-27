import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSetAtom } from "jotai";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  Clock,
  Laptop,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Smartphone,
  X,
} from "lucide-react";
import { addToastAtom } from "@/store/ui";
import { appSignOut, type AppSignOutScope } from "@/lib/auth-logout";

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

type LoadingState = AppSignOutScope | string | null;

export default function SignOutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<LoadingState>(null);
  const [view, setView] = useState<"default" | "devices">("default");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [mounted, setMounted] = useState(false);
  const addToast = useSetAtom(addToastAtom);

  const activeSessions = useMemo(
    () => sessions.filter((session) => !session.revoked_at),
    [sessions],
  );
  const otherSessions = activeSessions.filter((session) => !session.is_current);

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

  useEffect(() => {
    if (open) setView("default");
  }, [open]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/auth/sessions", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudieron cargar las sesiones.");
      const data = await res.json();
      setSessions(data.sessions.filter((s: Session) => !s.revoked_at));
    } catch (err) {
      console.error("Error fetching sessions", err);
      addToast({
        message: "No se pudieron cargar los dispositivos.",
        type: "error",
      });
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleOpenDevices = () => {
    setView("devices");
    void loadSessions();
  };

  const executeSignOut = async (
    scope: AppSignOutScope,
    sessionId?: string,
  ) => {
    if (loading) return;

    const targetSession = sessionId
      ? activeSessions.find((session) => session.session_id === sessionId)
      : null;
    const effectiveScope =
      scope === "selected" && targetSession?.is_current ? "local" : scope;
    const loadingKey = scope === "selected" && sessionId ? sessionId : scope;

    setLoading(loadingKey);
    try {
      await appSignOut({
        scope: effectiveScope,
        sessionIds: scope === "selected" && sessionId ? [sessionId] : [],
        redirect: effectiveScope === "local" || effectiveScope === "global",
        redirectReason:
          effectiveScope === "global" ? "sesion_cerrada_global" : "sesion_cerrada",
        clearPwaState: effectiveScope === "global",
      });

      if (effectiveScope === "selected" && sessionId) {
        setSessions((prev) =>
          prev.filter((session) => session.session_id !== sessionId),
        );
        addToast({ message: "Sesión remota cerrada.", type: "success" });
      }

      if (effectiveScope === "others") {
        setSessions((prev) => prev.filter((session) => session.is_current));
        addToast({
          message: "Se cerraron las demás sesiones.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Error signing out:", error);
      addToast({
        message:
          error instanceof Error
            ? error.message
            : "Hubo un problema al cerrar sesión.",
        type: "error",
      });
    } finally {
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

      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-brand-gold/20 bg-zinc-950 p-6 shadow-[0_24px_80px_rgba(212,175,55,0.15)]">
        <button
          type="button"
          onClick={() => {
            if (loading) return;
            if (view === "devices") setView("default");
            else onClose();
          }}
          disabled={!!loading}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label={view === "devices" ? "Volver" : "Cerrar"}
        >
          {view === "devices" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </button>

        {view === "default" && (
          <>
            <div className="mb-6 mt-2 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                <LogOut className="ml-1 h-8 w-8 text-red-500" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">
                Cerrar sesión
              </h2>
              <p className="text-sm text-gray-400">
                Elige si quieres cerrar solo este dispositivo o gestionar otros.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void executeSignOut("local")}
                disabled={!!loading}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/10 py-4 font-bold text-red-500 transition-all hover:bg-red-500/20 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
              >
                {loading === "local" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Cerrando este dispositivo...
                  </span>
                ) : (
                  <>
                    <LogOut className="h-5 w-5" />
                    <span>Cerrar este dispositivo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenDevices}
                disabled={!!loading}
                className="mt-2 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-500 transition-all hover:text-white disabled:opacity-50"
              >
                <MonitorSmartphone className="h-4 w-4" />
                <span>Gestionar dispositivos conectados</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={!!loading}
                className="mt-4 text-sm text-gray-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {view === "devices" && (
          <div className="flex h-[460px] flex-col">
            <div className="mb-4 text-center">
              <h2 className="mb-1 text-xl font-bold text-white">
                Tus dispositivos
              </h2>
              <p className="text-xs text-gray-400">
                Cierra una sesión específica o todas las demás.
              </p>
            </div>

            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
              {loadingSessions ? (
                <div className="flex h-full flex-col items-center justify-center text-gray-500">
                  <Loader2 className="mb-2 h-8 w-8 animate-spin" />
                  <span className="text-sm">Cargando dispositivos...</span>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-gray-500">
                  <span className="text-sm">No hay sesiones activas.</span>
                </div>
              ) : (
                activeSessions.map((session) => {
                  const os = session.os || "Dispositivo";
                  const browser = session.browser || "Navegador";
                  const isMobile =
                    os.toLowerCase().includes("android") ||
                    os.toLowerCase().includes("ios");

                  return (
                    <div
                      key={session.session_id}
                      className={`relative flex flex-col rounded-xl border p-4 ${
                        session.is_current
                          ? "border-brand-gold/30 bg-brand-gold/5"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-white/10 p-2">
                          {isMobile ? (
                            <Smartphone className="h-5 w-5 text-gray-300" />
                          ) : (
                            <Laptop className="h-5 w-5 text-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {os} • {browser}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {session.device_name || "Dispositivo registrado"}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            {session.last_seen_at
                              ? formatDistanceToNow(
                                  new Date(session.last_seen_at),
                                  { addSuffix: true, locale: es },
                                )
                              : "Hace poco"}
                          </div>
                          {session.is_current && (
                            <span className="mt-2 inline-block rounded-full bg-brand-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                              Actual
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void executeSignOut("selected", session.session_id)
                        }
                        disabled={!!loading}
                        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                          session.is_current
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {loading === session.session_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4" />
                            {session.is_current
                              ? "Cerrar sesión actual"
                              : "Cerrar esta sesión"}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void executeSignOut("others")}
                disabled={!!loading || otherSessions.length === 0}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-50"
              >
                {loading === "others" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MonitorSmartphone className="h-4 w-4" />
                )}
                Cerrar otros
              </button>

              <button
                type="button"
                onClick={() => void executeSignOut("global")}
                disabled={!!loading || activeSessions.length === 0}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-500/20 disabled:opacity-50"
              >
                {loading === "global" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Cerrar todos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
