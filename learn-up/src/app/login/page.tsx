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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {},
            emailRedirectTo: `https://learn-up-qmgx.onrender.com/auth/callback?next=/onboarding`,
          },
        });

        if (error) throw error;

        // If user already existed, signUp returns identities: []
        if (data?.user && data.user.identities?.length === 0) {
          setError("Este correo ya está registrado. Por favor, inicia sesión.");
          setLoading(false);
          return;
        }

        // If email confirmation is disabled in Supabase, session is immediately available
        if (data?.session) {
          router.push("/onboarding");
        } else {
          // Confirmation email sent
          setSuccessMsg(
            "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg === "User already registered" ||
        msg.includes("already registered")
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
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Background Decorative Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] bg-brand-gold opacity-5 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.03, 0.08, 0.03] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-1/4 w-[400px] h-[400px] bg-brand-gold opacity-5 rounded-full blur-[100px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.02, 0.06, 0.02] }}
          transition={{ duration: 12, repeat: Infinity, delay: 2 }}
        />
      </div>

      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 lg:gap-0 bg-gray-900/40 backdrop-blur-xl border border-brand-gold/20 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10">
        {/* Left Side — Branding */}
        <div className="w-full lg:w-[45%] p-8 sm:p-12 flex flex-col items-center lg:items-start justify-center text-center lg:text-left bg-gradient-to-br from-brand-gold/10 to-transparent border-b lg:border-b-0 lg:border-r border-brand-gold/10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 mb-6 rounded-3xl border border-brand-gold/40 bg-brand-black/50 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.15)]"
          >
            <Sparkles className="w-10 h-10 text-brand-gold" />
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Learn <span className="text-brand-gold">Up</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-sm leading-relaxed">
            La plataforma educativa definitiva. Conéctate con{" "}
            {isSignup ? "tu futuro" : "tu comunidad"} y alcanza tus metas.
          </p>
        </div>

        {/* Right Side — Form */}
        <div className="w-full lg:flex-1 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {isSignup ? "Crear Cuenta" : "Bienvenido de nuevo"}
              </h2>
              <p className="text-gray-500">
                {isSignup
                  ? "Únete a nuestra comunidad"
                  : "Inicia sesión para continuar"}
              </p>
            </div>

            {/* Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-2xl text-green-400 text-sm"
              >
                {successMsg}
              </motion.div>
            )}

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-all disabled:opacity-50 mb-6 shadow-lg active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 text-xs font-bold uppercase tracking-widest">
                o con email
              </span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-400 ml-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-brand-black/50 border border-gray-800 rounded-2xl text-white focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/50 transition-all placeholder:text-gray-600"
                    placeholder="ejemplo@correo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-400 ml-2">
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
                    className="w-full pl-12 pr-4 py-3.5 bg-brand-black/50 border border-gray-800 rounded-2xl text-white focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/50 transition-all placeholder:text-gray-600"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 px-6 py-4 bg-brand-gold text-brand-black font-bold rounded-2xl hover:brightness-110 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    {isSignup ? "Registrar ahora" : "Entrar a Learn Up"}
                  </>
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-8 space-y-4 text-center">
              <p className="text-gray-500 text-sm">
                {isSignup ? "¿Ya tienes cuenta?" : "¿Nuevo aquí?"}{" "}
                <Link
                  href={isSignup ? "/login" : "/login?mode=signup"}
                  className="text-brand-gold hover:underline font-bold"
                >
                  {isSignup ? "Inicia sesión" : "Regístrate gratis"}
                </Link>
              </p>
              <Link
                href="/"
                className="inline-block text-xs uppercase tracking-widest text-gray-600 hover:text-brand-gold transition-colors font-bold"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-brand-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
