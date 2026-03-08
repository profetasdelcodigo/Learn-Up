"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import {
  Brain,
  MessageCircle,
  MoveRight,
  Check,
  BookOpen,
  Presentation,
  Users,
} from "lucide-react";
import Logo from "./Logo";

export default function WelcomeTutorial() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    // Only automatically show the tutorial on the dashboard
    if (pathname === "/dashboard") {
      checkTutorialStatus();
    }
  }, [pathname]);

  async function checkTutorialStatus() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Check localStorage first for immediate responsiveness and fallback
    const localFlag = localStorage.getItem(`tutorial_seen_${user.id}`);
    if (localFlag === "true") {
      return; // Already seen on this device
    }

    const { data } = await supabase
      .from("profiles")
      .select("has_seen_tutorial")
      .eq("id", user.id)
      .single();

    if (data && !data.has_seen_tutorial) {
      setIsVisible(true);
    } else if (data?.has_seen_tutorial) {
      // Sync local state if DB says it's seen but local doesn't
      localStorage.setItem(`tutorial_seen_${user.id}`, "true");
    }
  }

  const completeTutorial = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Set locally immediately to prevent flickers regardless of DB response
    if (user) {
      localStorage.setItem(`tutorial_seen_${user.id}`, "true");

      // Update DB quietly
      await supabase
        .from("profiles")
        .update({ has_seen_tutorial: true })
        .eq("id", user.id);
    }

    setIsVisible(false);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-24 h-24 mx-auto bg-brand-gold/10 rounded-full flex items-center justify-center border border-brand-gold"
            >
              <Logo className="w-16 h-16" showText={false} />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">
              Bienvenido a Learn Up
            </h2>
            <p className="text-gray-400 text-lg">
              Tu plataforma educativa integral donde la IA y la colaboración se
              unen para impulsar tu aprendizaje.
            </p>
          </div>
        );
      case 1:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-brand-blue-glow/10 rounded-full flex items-center justify-center border border-brand-blue-glow"
            >
              <Presentation className="w-12 h-12 text-brand-blue-glow" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">Tu Dashboard</h2>
            <p className="text-gray-400 text-lg">
              Sigue tu progreso, ve tus próximos eventos, continúa tus hilos
              recientes de IA y accede rápido a las herramientas principales.
            </p>
          </div>
        );
      case 2:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/50"
            >
              <Brain className="w-12 h-12 text-purple-400 animate-pulse" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">
              Herramientas Educativas AI
            </h2>
            <p className="text-gray-400 text-lg">
              Interactúa con chatbots especializados: Consejero, Tutor y
              Profesor, diseñados para guiarte y enseñarte temas complejos.
            </p>
          </div>
        );
      case 3:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/50"
            >
              <BookOpen className="w-12 h-12 text-green-400" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">
              Biblioteca Inteligente
            </h2>
            <p className="text-gray-400 text-lg">
              Organiza tus apuntes, sube archivos y usa IA para extraer
              resúmenes, conceptos clave y cuestionarios de tus propios
              documentos.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/50"
            >
              <Users className="w-12 h-12 text-orange-400" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">
              Grupos y Salas de Estudio
            </h2>
            <p className="text-gray-400 text-lg">
              Únete a comunidades, chatea con otros estudiantes, haz preguntas
              junto a la IA y entra en salas y videollamadas con LiveKit.
            </p>
          </div>
        );
      case 5:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-brand-gold/10 rounded-full flex items-center justify-center border border-brand-gold"
            >
              <MessageCircle className="w-12 h-12 text-brand-gold" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">¡Todo listo!</h2>
            <p className="text-gray-400 text-lg">
              Estás preparado para comenzar tu experiencia en Learn Up. ¡Sácale
              el máximo provecho a la plataforma!
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-brand-black/95 flex items-center justify-center p-4 backdrop-blur-md"
      >
        <div className="max-w-md w-full relative">
          <div className="absolute top-0 right-0">
            <button
              onClick={completeTutorial}
              className="text-gray-500 hover:text-white text-sm"
            >
              Saltar
            </button>
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-[300px] flex items-center justify-center"
          >
            {renderStep()}
          </motion.div>

          <div className="flex justify-between items-center mt-8">
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-brand-gold" : "bg-gray-800"}`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (step < 5) setStep(step + 1);
                else completeTutorial();
              }}
              className="bg-brand-gold text-brand-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-white transition-all transform hover:scale-105"
            >
              {step < 5 ? (
                <>
                  Siguiente <MoveRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Empezar <Check className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
