"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, BookOpen, Users, Brain, Calendar, LogIn } from "lucide-react";

export default function Home() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Animated mesh background relying on global body glows */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating orbs */}
        <motion.div
          className="absolute top-1/4 -left-20 w-80 h-80 bg-white/5 rounded-full blur-[120px]"
          animate={{
            x: [0, 80, 0],
            y: [0, 40, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-20 w-80 h-80 bg-brand-gold/15 rounded-full blur-[120px]"
          animate={{
            x: [0, -60, 0],
            y: [0, -30, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px]"
          style={{ background: "rgba(56,189,248,0.04)" }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center max-w-4xl"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-surface-2/80 border border-white/8 backdrop-blur-xl"
          >
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
            <span className="text-sm text-gray-300 font-body">Plataforma educativa con IA</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight font-display"
          >
            Learn{" "}
            <span className="text-gradient-gold">Up</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg md:text-xl text-gray-400 mb-14 max-w-2xl mx-auto font-body leading-relaxed"
          >
            Tu compañero de estudio que nunca duerme. Tutores IA especializados,
            aprendizaje colaborativo y organización inteligente — todo gratis.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {[
              { icon: Brain, label: "Tutores IA 24/7", color: "brand-purple" },
              { icon: Users, label: "Aprende en Grupo", color: "brand-emerald" },
              { icon: Calendar, label: "Organiza tu Tiempo", color: "brand-blue-glow" },
              { icon: BookOpen, label: "Biblioteca Digital", color: "brand-gold" },
            ].map((feat, i) => (
              <motion.div
                key={feat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2/60 border border-white/6 backdrop-blur-sm`}
              >
                <feat.icon className={`w-4 h-4 text-${feat.color}`} />
                <span className="text-sm text-gray-300 font-body">{feat.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/login?mode=signin">
              <motion.button
                className="btn-primary px-10 py-4 text-base"
                whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(240,200,80,0.3)" }}
                whileTap={{ scale: 0.97 }}
              >
                <LogIn className="w-5 h-5" />
                Iniciar Sesión
              </motion.button>
            </Link>
            <Link href="/login?mode=signup">
              <motion.button
                className="btn-ghost px-10 py-4 text-base border-brand-gold/30 text-brand-gold hover:bg-brand-gold/5"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Crear Cuenta Gratis
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="absolute bottom-8 text-gray-600 text-xs font-body tracking-wider"
        >
          © 2026 Learn Up · Educación del futuro, hoy.
        </motion.div>
      </div>
    </div>
  );
}
