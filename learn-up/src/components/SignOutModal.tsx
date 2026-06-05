"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";
import { Check, Monitor, Smartphone, X } from "lucide-react";

type SessionRow = {
  id: string;
  session_id: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  is_current: boolean;
};

export default function SignOutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const addToast = useSetAtom(addToastAtom);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const finishLocalSignOut = useCallback(async () => {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise((resolve) => window.setTimeout(resolve, 800)),
    ]).catch(() => {});
    window.location.replace("/login");
  }, [supabase]);

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sessions");
      if (res.status === 401) {
        await finishLocalSignOut();
        return;
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      addToast({ message: "No se pudieron cargar las sesiones", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast, finishLocalSignOut]);

  useEffect(() => {
    if (!open) return;
    refreshSessions();
    setSelectedSessionIds([]);
  }, [open, refreshSessions]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  function toggleSession(sessionId: string) {
    setSelectedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId],
    );
  }

  function postSignOut(payload: Record<string, unknown>) {
    return fetch("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  }

  const signOutSelected = async () => {
    if (selectedSessionIds.length === 0) {
      addToast({ message: "Selecciona al menos una sesion", type: "info" });
      return;
    }

    setSubmitting("selected");
    try {
      const res = await postSignOut({ session_ids: selectedSessionIds });
      if (!res.ok) throw new Error("signout_failed");

      const closesCurrentSession = sessions.some(
        (session) =>
          session.is_current && selectedSessionIds.includes(session.session_id),
      );

      if (closesCurrentSession) {
        await finishLocalSignOut();
        return;
      }

      addToast({ message: "Sesiones seleccionadas cerradas", type: "success" });
      setSelectedSessionIds([]);
      await refreshSessions();
      setSubmitting(null);
    } catch {
      setSubmitting(null);
      addToast({ message: "No se pudieron cerrar las sesiones", type: "error" });
    }
  };

  const signOut = async (scope: "local" | "others" | "global") => {
    setSubmitting(scope);
    try {
      const request = postSignOut({ scope });

      if (scope === "local" || scope === "global") {
        await Promise.race([
          request,
          new Promise((resolve) => window.setTimeout(resolve, 1200)),
        ]);
        await finishLocalSignOut();
        return;
      }

      const res = await request;
      if (!res.ok) throw new Error("signout_failed");

      if (scope === "others") {
        addToast({ message: "Se cerraron las otras sesiones", type: "success" });
        await refreshSessions();
        setSubmitting(null);
        return;
      }

    } catch {
      setSubmitting(null);
      addToast({ message: "No se pudo cerrar la sesion", type: "error" });
    }
  };

  const activeSessions = sessions.filter((s) => !s.revoked_at);
  const selectableSessions = activeSessions.filter((s) => !s.is_current);
  const allSelectableSelected =
    selectableSessions.length > 0 &&
    selectableSessions.every((s) => selectedSessionIds.includes(s.session_id));

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-brand-black/90 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-modal-title"
    >
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[min(720px,calc(100dvh-32px))] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101016] shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 bg-white/[0.03] px-5 py-4">
          <div>
            <h2 id="signout-modal-title" className="text-xl font-bold text-white">
              Cerrar sesion
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              Selecciona sesiones especificas o usa una accion rapida.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {selectableSessions.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Cierre individual
                </p>
                <p className="text-xs text-gray-400">
                  Elige uno o varios dispositivos sin cerrar todos los demas.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelectedSessionIds(
                    allSelectableSelected
                      ? []
                      : selectableSessions.map((s) => s.session_id),
                  )
                }
                className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-brand-gold/40"
              >
                {allSelectableSelected ? "Limpiar" : "Seleccionar otros"}
              </button>
            </div>
          )}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {activeSessions.map((session) => {
                const isMobile = /movil|android|ios/i.test(session.device_name);
                const Icon = isMobile ? Smartphone : Monitor;
                const selected = selectedSessionIds.includes(session.session_id);
                return (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() =>
                      session.is_current
                        ? undefined
                        : toggleSession(session.session_id)
                    }
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      session.is_current
                        ? "border-brand-gold/50 bg-brand-gold/12 shadow-[0_0_0_1px_rgba(250,204,21,0.08)]"
                        : selected
                          ? "border-brand-gold/50 bg-brand-gold/10"
                        : "border-white/8 bg-white/[0.04]"
                    }`}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10">
                      <Icon className="h-5 w-5 text-brand-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {session.device_name || "Dispositivo"}
                        </p>
                        {session.is_current && (
                          <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-brand-black">
                            Actual
                          </span>
                        )}
                        {!session.is_current && selected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-brand-black">
                            <Check className="h-3 w-3" />
                            Seleccionada
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-300">
                        Inicio: {new Date(session.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        Ultima actividad: {new Date(session.last_seen_at).toLocaleString()}
                      </p>
                    </div>
                  </button>
                );
              })}
              {activeSessions.length === 0 && (
                <p className="text-sm text-gray-400">No hay sesiones registradas aun.</p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-white/8 bg-black/20 px-5 py-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={signOutSelected}
            disabled={!!submitting || selectedSessionIds.length === 0}
            className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-3 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting === "selected"
              ? "Cerrando..."
              : `Cerrar seleccionadas (${selectedSessionIds.length})`}
          </button>
          <button
            type="button"
            onClick={() => signOut("local")}
            disabled={!!submitting}
            className="rounded-xl bg-brand-gold px-3 py-3 text-sm font-bold text-brand-black transition hover:bg-brand-gold/90 disabled:opacity-60"
          >
            {submitting === "local" ? "Cerrando..." : "Cerrar este"}
          </button>
          <button
            type="button"
            onClick={() => signOut("others")}
            disabled={!!submitting}
            className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-sm font-semibold text-white transition hover:border-brand-gold/40 hover:bg-white/[0.06] disabled:opacity-60"
          >
            {submitting === "others" ? "Cerrando..." : "Cerrar todas las demas"}
          </button>
          <button
            type="button"
            onClick={() => signOut("global")}
            disabled={!!submitting}
            className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
          >
            {submitting === "global" ? "Cerrando..." : "Cerrar todos"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
