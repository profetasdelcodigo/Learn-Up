"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Users, Brain, Calendar, LogIn } from "lucide-react";

export default function Home() {
  const features = [
    { icon: Brain, label: "Tutores IA 24/7", tone: "gold" },
    { icon: Users, label: "Aprende en Grupo", tone: "blue" },
    { icon: Calendar, label: "Organiza tu Tiempo", tone: "neutral" },
    { icon: BookOpen, label: "Biblioteca Digital", tone: "neutral" },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#08090D] text-white">
      <div className="absolute inset-0 overflow-hidden">
        {/* Dominant diagonal brand glows: warm upper-left / cool lower-right */}
        <div className="absolute -left-[18%] -top-[22%] h-[900px] w-[900px] rounded-full bg-[#F0C850]/[0.14] blur-[170px]" />
        <div className="absolute -bottom-[24%] -right-[18%] h-[900px] w-[900px] rounded-full bg-[#38BDF8]/[0.12] blur-[180px]" />

        {/* Very subtle opposite-corner echoes */}
        <div className="absolute -right-[24%] -top-[24%] h-[650px] w-[650px] rounded-full bg-[#38BDF8]/[0.025] blur-[170px]" />
        <div className="absolute -bottom-[24%] -left-[24%] h-[650px] w-[650px] rounded-full bg-[#F0C850]/[0.02] blur-[170px]" />

        {/* Keep the center intentionally almost black */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(8,9,13,0.1)_0%,rgba(8,9,13,0.62)_52%,rgba(8,9,13,0.9)_100%)]" />

        <div
          className="absolute inset-0 opacity-[0.016]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
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
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#38BDF8]" />
            <span className="font-body text-sm text-white/65">Plataforma educativa con IA</span>
          </motion.div>

          <motion.h1
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-5 font-display text-6xl font-bold tracking-tight text-white sm:text-7xl md:text-8xl"
          >
            Learn {" "}
            <span className="bg-gradient-to-r from-[#F0C850] via-[#F4D97A] to-[#38BDF8] bg-clip-text text-transparent">
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
                feature.tone === "gold"
                  ? "text-[#F0C850]"
                  : feature.tone === "blue"
                    ? "text-[#38BDF8]"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F0C850] to-[#38BDF8] px-10 py-4 font-display text-base font-bold text-[#08090D] shadow-[0_14px_40px_rgba(240,200,80,0.14)] transition-all duration-300 sm:w-auto"
                whileHover={{ scale: 1.025, boxShadow: "0 16px 48px rgba(56,189,248,0.2)" }}
                whileTap={{ scale: 0.975 }}
              >
                <LogIn className="h-5 w-5" />
                Iniciar Sesión
              </motion.button>
            </Link>
            <Link href="/login?mode=signup">
              <motion.button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-10 py-4 font-display text-base font-semibold text-white/80 backdrop-blur-xl transition-all duration-300 hover:border-[#F0C850]/25 hover:bg-white/[0.06] sm:w-auto"
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
