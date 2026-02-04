"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Brain, MessageCircle, Star, MoveRight, Check } from "lucide-react";
import Logo from "./Logo";

export default function WelcomeTutorial() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    checkTutorialStatus();
  }, []);

  const checkTutorialStatus = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("has_seen_tutorial")
      .eq("id", user.id)
      .single();

    if (data && !data.has_seen_tutorial) {
      setIsVisible(true);
    }
  };

  const completeTutorial = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ has_seen_tutorial: true })
      .eq("id", user.id);

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
              unen.
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
              <Brain className="w-12 h-12 text-brand-blue-glow animate-pulse" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">Potencia tu Mente</h2>
            <p className="text-gray-400 text-lg">
              Accede a tutores de IA las 24/7, genera recetas nutritivas y
              recursos educativos.
            </p>
          </div>
        );
      case 2:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500"
            >
              <MessageCircle className="w-12 h-12 text-purple-500" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white">
              Conecta y Colabora
            </h2>
            <p className="text-gray-400 text-lg">
              Chatea con amigos, realiza videollamadas y comparte conocimiento
              en tiempo real.
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
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-brand-gold" : "bg-gray-800"}`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (step < 2) setStep(step + 1);
                else completeTutorial();
              }}
              className="bg-brand-gold text-brand-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-white transition-all transform hover:scale-105"
            >
              {step < 2 ? (
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
