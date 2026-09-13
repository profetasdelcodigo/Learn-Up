"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Loader2, Sparkles } from "lucide-react";
import {
  StaggerContainer,
  FadeUpItem,
} from "@/components/animations/StaggerReveal";
import { Capacitor } from "@capacitor/core";

export default function LoginPage() {
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      setIsSignup(searchParams.get("mode") === "signup");
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const supabase = createClient();

  const getRedirectUrl = (path: string) => {
    const isNative =
      typeof window !== "undefined" && Capacitor.isNativePlatform();
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://learn-up-qmgx.onrender.com";

    if (isNative) {
      return `com.learnup.app://auth/callback?next=${encodeURIComponent(path)}`;
    }

    return `${baseUrl}/auth/callback?next=${encodeURIComponent(path)}`;
  };

  useEffect(() => {
    if (isSignup) {
      const savedEmail = sessionStorage.getItem("prefill_email");
      if (savedEmail) {
        setEmail(savedEmail);
        sessionStorage.removeItem("prefill_email");
      }
    }
  }, [isSignup]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSignup) {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result?.error || "No se pudo crear la cuenta.");
        }

        setSuccessMsg(
          "¡Cuenta creada! Revisa tu correo y confirma tu dirección para continuar con tu perfil.",
        );
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.message || "";
      if (
        msg.includes("already registered") ||
        msg.includes("ya está registrado")
      ) {
        setError("Este correo ya está registrado. Usa 'Inicia sesión'.");
      } else if (
        msg === "Invalid login credentials" ||
        msg.includes("Invalid login credentials")
      ) {
        setError("Correo o contraseña incorrectos.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Confirma tu correo antes de iniciar sesión.");
      } else if (msg.includes("Password should be at least")) {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError(msg || "Ocurrió un error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getRedirectUrl("/onboarding"),
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Ocurrió un error");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row overflow-y-auto">
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden border-r border-white/6">
        <div className="absolute inset-0 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-lg"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 mb-8 rounded-3xl border border-brand-gold/20 bg-surface-2/50 backdrop-blur-md shadow-glow-gold">
            <Sparkles className="w-12 h-12 text-brand-gold" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 font-display">
            Learn <span className="text-gradient-gold">Up</span>
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed font-body">
            La plataforma educativa definitiva. Conéctate con{" "}
            {isSignup ? "tu futuro" : "tu comunidad"}, aprende a tu propio ritmo
            y alcanza todas tus metas.
          </p>
        </motion.div>
      </div>

      <div className="w-full lg:w-1/2 flex-1 min-h-dvh lg:min-h-0 flex items-center justify-center relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 w-full max-w-md p-4 sm:p-10 py-12 lg:py-10 mx-auto"
        >
          <div className="glass-strong border border-white/8 rounded-2xl p-8 sm:p-10 shadow-2xl">
            <StaggerContainer delayOffset={0.3}>
              <FadeUpItem>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2 font-display">
                    {isSignup ? "Crear Cuenta" : "Bienvenido"}
                  </h2>
                  <p className="text-gray-500 font-body">
                    {isSignup
                      ? "Únete a Learn Up"
                      : "Inicia sesión para continuar"}
                  </p>
                </div>
              </FadeUpItem>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/8 border border-red-500/30 rounded-xl text-red-400 text-sm font-body"
                >
                  {error}
                </motion.div>
              )}

              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-brand-emerald/8 border border-brand-emerald/30 rounded-xl text-brand-emerald text-sm font-body"
                >
                  {successMsg}
                </motion.div>
              )}

              <FadeUpItem>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  id="google-auth-btn"
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mb-6 font-body"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continuar con Google
                </button>
              </FadeUpItem>

              <FadeUpItem>
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-gray-600 text-xs font-body uppercase tracking-wider">o</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>
              </FadeUpItem>

              <FadeUpItem>
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div>
                    <label htmlFor="email-input" className="block text-sm font-medium text-gray-400 mb-2 font-body">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="email-input"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="input-base pl-12 !rounded-xl"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password-input" className="block text-sm font-medium text-gray-400 mb-2 font-body">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="password-input"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        className="input-base pl-12 !rounded-xl"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} id="submit-auth-btn" className="btn-primary w-full !rounded-xl">
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        {isSignup ? "Registrarse" : "Iniciar Sesión"}
                      </>
                    )}
                  </button>
                </form>
              </FadeUpItem>

              <FadeUpItem>
                <div className="mt-6 text-center text-sm text-gray-500 font-body">
                  {isSignup ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
                  <a
                    href={isSignup ? "/login" : "/login?mode=signup"}
                    className="relative z-20 inline-block text-brand-gold hover:underline font-semibold cursor-pointer"
                  >
                    {isSignup ? "Inicia sesión" : "Regístrate"}
                  </a>
                </div>
              </FadeUpItem>

              <FadeUpItem>
                <div className="mt-4 text-center">
                  <a
                    href="/"
                    className="relative z-20 inline-block text-sm text-gray-600 hover:text-gray-400 transition-colors font-body cursor-pointer"
                  >
                    ← Volver al inicio
                  </a>
                </div>
              </FadeUpItem>
            </StaggerContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
