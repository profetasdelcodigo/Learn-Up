"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Users, Brain, Calendar, LogIn } from "lucide-react";

export default function Home() {
  const features = [
    { icon: Brain, label: "Tutores IA 24/7", tone: "purple" },
    { icon: Users, label: "Aprende en Grupo", tone: "emerald" },
    { icon: Calendar, label: "Organiza tu Tiempo", tone: "neutral" },
    { icon: BookOpen, label: "Biblioteca Digital", tone: "neutral" },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#09090D] text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[800px] w-[800px] rounded-full bg-violet-400/10 blur-[160px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[720px] w-[720px] rounded-full bg-emerald-400/[0.07] blur-[170px]" />
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white/[0.03] to-transparent" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl text-center"
        >
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 backdrop-blur-xl"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-body text-sm text-white/65">Plataforma educativa con IA</span>
          </motion.div>

          <motion.h1
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-5 font-display text-6xl font-bold tracking-tight text-white sm:text-7xl md:text-8xl"
          >
            Learn {" "}
            <span className="bg-gradient-to-r from-violet-300 via-violet-200 to-emerald-300 bg-clip-text text-transparent">
              Up
            </span>
          </motion.h1>

          <motion.p
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mx-auto mb-12 max-w-2xl font-body text-lg leading-relaxed text-white/50 sm:text-xl"
          >
            Aprende con IA. Salas en vivo, exámenes a medida y herramientas para estudiar mejor.
          </motion.p>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mb-12 flex flex-wrap justify-center gap-3"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const toneClass =
                feature.tone === "purple"
                  ? "text-violet-300"
                  : feature.tone === "emerald"
                    ? "text-emerald-300"
                    : "text-white/45";

              return (
                <motion.div
                  key={feature.label}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.55 + index * 0.08 }}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2 backdrop-blur-sm"
                >
                  <Icon className={`h-4 w-4 ${toneClass}`} strokeWidth={1.9} />
                  <span className="font-body text-sm text-white/60">{feature.label}</span>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="flex flex-col justify-center gap-4 sm:flex-row"
          >
            <Link href="/login?mode=signin">
              <motion.button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-emerald-400 px-10 py-4 font-display text-base font-bold text-white shadow-[0_14px_40px_rgba(139,92,246,0.18)] transition-all duration-300 sm:w-auto"
                whileHover={{ scale: 1.025, boxShadow: "0 16px 48px rgba(139,92,246,0.24)" }}
                whileTap={{ scale: 0.975 }}
              >
                <LogIn className="h-5 w-5" />
                Iniciar Sesión
              </motion.button>
            </Link>
            <Link href="/login?mode=signup">
              <motion.button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-10 py-4 font-display text-base font-semibold text-white/80 backdrop-blur-xl transition-all duration-300 hover:border-violet-300/25 hover:bg-white/[0.06] sm:w-auto"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.975 }}
              >
                Crear Cuenta Gratis
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.05 }}
          className="absolute bottom-8 font-body text-xs tracking-[0.18em] text-white/30"
        >
          © 2026 Learn Up · Educación del futuro, hoy.
        </motion.div>
      </div>
    </div>
  );
}
