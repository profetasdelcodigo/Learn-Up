"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";
import { Monitor, Smartphone, X } from "lucide-react";

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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const addToast = useSetAtom(addToastAtom);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/auth/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {
        addToast({ message: "No se pudieron cargar las sesiones", type: "error" });
      })
      .finally(() => setLoading(false));
  }, [open, addToast]);

  if (!open) return null;

  const signOut = async (scope: "local" | "others" | "global") => {
    setSubmitting(scope);
    try {
      const res = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) throw new Error("signout_failed");

      if (scope === "others") {
        addToast({ message: "Se cerraron las otras sesiones", type: "success" });
        const refreshed = await fetch("/api/auth/sessions").then((r) => r.json());
        setSessions(refreshed.sessions || []);
        setSubmitting(null);
        return;
      }

      await supabase.auth.signOut({ scope: "local" });
      window.location.href = "/login";
    } catch {
      setSubmitting(null);
      addToast({ message: "No se pudo cerrar la sesion", type: "error" });
    }
  };

  const activeSessions = sessions.filter((s) => !s.revoked_at);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-brand-gold/25 bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Cerrar sesion</h2>
            <p className="text-xs text-gray-400">
              Elige si quieres cerrar solo este dispositivo o tambien otros.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto px-5 py-4">
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
                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
                      session.is_current
                        ? "border-brand-gold/40 bg-brand-gold/10"
                        : "border-white/6 bg-white/[0.03]"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-brand-gold" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {session.device_name || "Dispositivo"}
                        </p>
                        {session.is_current && (
                          <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-brand-black">
                            Actual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        Inicio: {new Date(session.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ultima actividad: {new Date(session.last_seen_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {activeSessions.length === 0 && (
                <p className="text-sm text-gray-400">No hay sesiones registradas aun.</p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-white/6 px-5 py-4 sm:grid-cols-3">
          <button
            onClick={() => signOut("local")}
            disabled={!!submitting}
            className="rounded-xl bg-brand-gold px-3 py-2 text-sm font-bold text-brand-black disabled:opacity-60"
          >
            {submitting === "local" ? "Cerrando..." : "Cerrar este"}
          </button>
          <button
            onClick={() => signOut("others")}
            disabled={!!submitting}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:border-brand-gold/40 disabled:opacity-60"
          >
            {submitting === "others" ? "Cerrando..." : "Cerrar otros"}
          </button>
          <button
            onClick={() => signOut("global")}
            disabled={!!submitting}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
          >
            {submitting === "global" ? "Cerrando..." : "Cerrar todos"}
          </button>
        </div>
      </div>
    </div>
  );
}
