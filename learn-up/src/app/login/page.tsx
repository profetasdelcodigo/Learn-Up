"use client";

import { Suspense } from "react";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Username is now handled in Onboarding
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Username is collected in /onboarding
            data: {},
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
          },
        });
        if (error) throw error;
        // Immediate redirect might not work if confirmation is managed, but explicit message is better
        // The router.push will happen, but user is unauthenticated usually if confirm needed.
        // User requested: "Evita que el sistema pida confirmación if not strict".
        // That is a Supabase Dashboard setting (Disable Confirm Email). Code can't force it.
        router.push("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: any) {
      if (isSignup && err.message === "User already registered") {
        router.push("/login?mode=signin");
        setError("El correo ya está registrado. Por favor, inicia sesión.");
      } else if (!isSignup && err.message === "Invalid login credentials") {
        setError(
          "Correo o contraseña incorrectos. Si no tienes cuenta, regístrate.",
        );
      } else {
        setError(err.message || "Ocurrió un error");
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
          redirectTo: "https://learn-up-qmgx.onrender.com/auth/callback",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Ocurrió un error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side - Branding (Visible on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden border-r border-brand-gold/20 bg-gradient-to-br from-brand-black to-brand-brown/10">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] bg-brand-gold opacity-10 rounded-full blur-[100px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-lg"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 mb-8 rounded-3xl border border-brand-gold/50 bg-brand-black/50 backdrop-blur-md shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <Sparkles className="w-12 h-12 text-brand-gold" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            Learn <span className="text-brand-gold">Up</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            La plataforma educativa definitiva. Conéctate con{" "}
            {isSignup ? "tu futuro" : "tu comunidad"}, aprende a tu propio ritmo
            y alcanza todas tus metas.
          </p>
        </motion.div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-brand-black">
        {/* Mobile-only background glow */}
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <motion.div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-brand-gold opacity-10 rounded-full blur-[60px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="bg-brand-black/60 lg:bg-brand-black/40 backdrop-blur-xl border border-brand-gold/30 lg:border-brand-gold/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                {isSignup ? "Crear Cuenta" : "Bienvenido"}
              </h2>
              <p className="text-gray-400">
                {isSignup ? "Únete a Learn Up" : "Inicia sesión para continuar"}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Google OAuth */}
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-900 font-medium rounded-full hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-500 text-sm">o</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Email/Password form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-gold text-brand-black font-semibold rounded-full hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
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

            {/* Toggle mode */}
            <div className="mt-6 text-center text-sm text-gray-400">
              {isSignup ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
              <Link
                href={isSignup ? "/login" : "/login?mode=signup"}
                className="text-brand-gold hover:underline font-medium"
              >
                {isSignup ? "Inicia sesión" : "Regístrate"}
              </Link>
            </div>

            {/* Back to home */}
            <div className="mt-4 text-center">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen bg-brand-black overflow-hidden flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
