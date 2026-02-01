"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, BookOpen, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-brand-black overflow-hidden">
      {/* Animated background glows */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 -left-1/4 w-96 h-96 bg-brand-blue-glow opacity-20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-brand-blue-glow opacity-20 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl"
        >
          {/* Icon with glow effect */}
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 mb-8 rounded-full border border-brand-gold bg-brand-black/50 backdrop-blur-sm"
            animate={{
              boxShadow: [
                "0 0 20px rgba(212, 175, 55, 0.3)",
                "0 0 40px rgba(212, 175, 55, 0.5)",
                "0 0 20px rgba(212, 175, 55, 0.3)",
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Sparkles className="w-10 h-10 text-brand-gold" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-7xl font-bold text-white mb-6 tracking-tight"
          >
            Learn <span className="text-brand-gold">Up</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto"
          >
            La plataforma educativa donde docentes y estudiantes colaboran,
            aprenden y crecen juntos
          </motion.p>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap justify-center gap-6 mb-12"
          >
            <div className="flex items-center gap-2 text-gray-400">
              <BookOpen className="w-5 h-5 text-brand-gold" />
              <span>Biblioteca Digital</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="w-5 h-5 text-brand-gold" />
              <span>Colaboración en Tiempo Real</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Sparkles className="w-5 h-5 text-brand-gold" />
              <span>Recetas Educativas</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/login">
              <motion.button
                className="px-8 py-4 bg-brand-gold text-brand-black font-semibold rounded-full hover:bg-brand-gold/90 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Entrar
              </motion.button>
            </Link>
            <Link href="/login?mode=signup">
              <motion.button
                className="px-8 py-4 bg-transparent border-2 border-brand-gold text-brand-gold font-semibold rounded-full hover:bg-brand-gold/10 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Registrarse
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-8 text-gray-500 text-sm"
        >
          © 2026 Learn Up. Educación del futuro, hoy.
        </motion.div>
      </div>
    </div>
  );
}
