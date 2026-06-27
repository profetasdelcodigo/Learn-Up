"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Database,
  Loader2,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { deleteAccountAction } from "@/actions/user";
import { createClient } from "@/utils/supabase/client";
import { appSignOut } from "@/lib/auth-logout";

const themeOptions = [
  {
    value: "dark",
    label: "Modo Oscuro",
    icon: Moon,
    iconClass: "text-brand-purple",
    bgActive: "border-brand-purple bg-brand-purple/10 shadow-glow-purple/20",
  },
  {
    value: "light",
    label: "Modo Claro",
    icon: Sun,
    iconClass: "text-brand-gold",
    bgActive: "border-brand-gold bg-brand-gold/10 shadow-glow-gold/20",
  },
  {
    value: "system",
    label: "Sistema",
    icon: Monitor,
    iconClass: "text-blue-400",
    bgActive: "border-blue-500 bg-blue-500/10 shadow-blue-500/20",
  },
];

const platformSections = [
  {
    icon: BrainCircuit,
    title: "IA",
    description:
      "Modelos, IA Libre, proveedores, herramientas, trazabilidad de procesos y Cerebro Unico.",
    details:
      "Los controles de agentes salen del chat y quedan centralizados aqui para evitar paneles flotantes.",
  },
  {
    icon: BookOpen,
    title: "Biblioteca",
    description:
      "Subidas, documentos, extraccion de texto, fuentes y memoria documental para los agentes.",
    details:
      "Las rutas seguras por usuario se mantienen; los errores de formato o permisos deben mostrarse al subir.",
  },
  {
    icon: Users,
    title: "Aprendamos Juntos",
    description:
      "Chat, grupos, llamadas, perfiles compartidos y notificaciones sociales.",
    details:
      "La fuente de perfiles debe ser siempre profiles para nombre, usuario, avatar, escuela y grado.",
  },
  {
    icon: Bell,
    title: "Notificaciones",
    description:
      "Toasts, realtime, push del dispositivo y eventos de IA, calendario, llamadas y mensajes.",
    details:
      "El permiso push se activa por accion explicita del usuario; el listener global queda montado en toda la app.",
  },
  {
    icon: Database,
    title: "Repositorios IA",
    description:
      "The Architect, Neo Cyber, Claude Code, Claude Cookbooks y agentes externos como conocimiento comun.",
    details:
      "Estos repos alimentan a los agentes mediante busqueda/herramientas; no deben ejecutar codigo libre ni revelar secretos.",
  },
];

export default function SettingsPage() {
  const supabase = createClient();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    setMounted(true);

    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserEmail(data.user.email || "");
    };

    void getUser();
  }, [supabase]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAccountAction();
      if (result.success) {
        await appSignOut({
          scope: "local",
          redirectReason: "cuenta_eliminada",
          clearPwaState: true,
        });
        return;
      }

      alert("No se pudo eliminar tu cuenta: " + result.error);
      setIsDeleting(false);
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar tu cuenta. Verifica tu sesion e intentalo otra vez.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-[var(--foreground)]">
          <Settings className="h-8 w-8 text-brand-gold" />
          Ajustes
        </h1>
        <p className="mt-2 font-body text-gray-500 dark:text-gray-400">
          Administra tus preferencias, privacidad, IA y seguridad de tu cuenta.
        </p>
      </div>

      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl border border-white/10 p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-brand-purple/10 p-2">
              <Monitor className="h-6 w-6 text-brand-purple" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--foreground)]">
                Apariencia
              </h2>
              <p className="font-body text-sm text-gray-500 dark:text-gray-400">
                Personaliza como se ve Learn Up.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {mounted &&
              themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = theme === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                      isActive
                        ? opt.bgActive
                        : "border-white/10 text-gray-500 hover:border-white/20 hover:bg-white/5 dark:text-gray-400"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isActive ? opt.iconClass : "text-gray-500"}`} />
                    <span className="font-medium">{opt.label}</span>
                    {isActive && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                  </button>
                );
              })}
          </div>

          {mounted && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Tema actual:{" "}
              <span className="font-semibold capitalize text-brand-gold">
                {resolvedTheme}
              </span>
            </p>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl border border-white/10 p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-brand-gold/10 p-2">
              <BrainCircuit className="h-6 w-6 text-brand-gold" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--foreground)]">
                Centro de Control
              </h2>
              <p className="font-body text-sm text-gray-500 dark:text-gray-400">
                Configuracion global para IA, Biblioteca, Aprendamos Juntos y notificaciones.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {platformSections.map((section) => {
              const Icon = section.icon;

              return (
                <article
                  key={section.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-xl border border-brand-gold/25 bg-brand-gold/10 p-2 text-brand-gold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">{section.title}</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {section.description}
                      </p>
                      <p className="mt-3 text-xs text-brand-gold/90">{section.details}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl border border-white/10 p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-green-500/10 p-2">
              <Shield className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--foreground)]">
                Privacidad y Seguridad
              </h2>
              <p className="font-body text-sm text-gray-500 dark:text-gray-400">
                Administra tu informacion y accesos.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Correo electronico</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{userEmail}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Terminos y Privacidad</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Revisa los acuerdos legales de la plataforma.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicies(true)}
                className="shrink-0 text-sm text-brand-gold hover:underline"
              >
                Ver politicas
              </button>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-red-500/10 p-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-red-500">
                Zona de Peligro
              </h2>
              <p className="font-body text-sm text-red-400/80">
                Acciones irreversibles para tu cuenta.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">
                Eliminar Cuenta Permanentemente
              </h3>
              <p className="text-sm text-red-300">
                Se borraran todos tus datos, conversaciones, archivos de la biblioteca y progreso.
                Esta accion no se puede deshacer.
              </p>
            </div>

            {!showConfirmDelete ? (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 font-medium text-red-400 transition-colors hover:bg-red-500/30"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar Cuenta
              </button>
            ) : (
              <div className="flex shrink-0 flex-col gap-2">
                <p className="text-right text-xs font-bold text-red-400">
                  Estas absolutamente seguro?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={isDeleting}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-white/20 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Si, eliminar todo
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.section>
      </div>

      {showPolicies && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass-strong relative max-h-[85dvh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  Politicas de Learn Up
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Resumen operativo para privacidad, seguridad y uso de IA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicies(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-[var(--foreground)]"
                aria-label="Cerrar politicas"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65dvh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              <section>
                <h3 className="mb-2 font-semibold text-[var(--foreground)]">Privacidad</h3>
                <p>
                  Learn Up usa tus datos para autenticarte, guardar tu progreso, mostrar perfiles
                  dentro de la plataforma y permitir funciones de IA. Las conversaciones privadas no
                  deben exponerse a otros usuarios.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-[var(--foreground)]">Archivos e IA</h3>
                <p>
                  Los archivos subidos se usan para responder tus solicitudes educativas. Los agentes
                  no deben revelar secretos, credenciales, instrucciones internas ni datos privados de
                  otras personas.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-[var(--foreground)]">Seguridad</h3>
                <p>
                  Las acciones con efectos externos, como enviar mensajes, crear eventos o abrir
                  enlaces, requieren confirmacion del usuario. El modo Jarvis no tiene ejecucion libre
                  de codigo ni acceso arbitrario al dispositivo en produccion.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-[var(--foreground)]">
                  Contenido y responsabilidad
                </h3>
                <p>
                  La plataforma es educativa. Las respuestas de IA pueden equivocarse y deben
                  verificarse cuando se usen para decisiones importantes.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
