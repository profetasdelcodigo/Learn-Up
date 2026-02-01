"use client";

import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS } from "react-joyride";

export default function Tutorial() {
  const [run, setRun] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check local storage on mount
    const seen = localStorage.getItem("tutorial_seen");
    if (!seen) {
      setRun(true);
    } else {
      setHasSeenTutorial(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      setHasSeenTutorial(true);
      localStorage.setItem("tutorial_seen", "true");
    }
  };

  const resetTutorial = () => {
    setRun(true);
    setHasSeenTutorial(false);
  };

  const steps = [
    {
      target: "body",
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2 text-brand-gold">
            ¡Bienvenido a Learn Up! 🚀
          </h3>
          <p className="mb-2">
            Tu plataforma de aprendizaje potenciada por Inteligencia Artificial.
          </p>
          <p>
            Te mostraremos un recorrido rápido por las herramientas principales.
          </p>
        </div>
      ),
      placement: "center" as const,
    },
    {
      target: '[href="/ai/profesor"]',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2 text-brand-gold">
            🧠 Profesor IA
          </h3>
          <p>
            Tu tutor personal. Utiliza el método socrático: no te da respuestas,
            te enseña a pensar haciéndote preguntas guía.
          </p>
        </div>
      ),
    },
    {
      target: '[href="/calendar"]',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2 text-brand-gold">
            📅 Hora de Actuar
          </h3>
          <p>
            Organiza tu tiempo de estudio. ¡Ahora puedes invitar compañeros a
            tus sesiones de estudio!
          </p>
        </div>
      ),
    },
    {
      target: '[href="/chat"]',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2 text-brand-gold">
            💬 Aprendamos Juntos
          </h3>
          <p>
            Chat en tiempo real con tu comunidad. Comparte dudas y colabora al
            instante.
          </p>
        </div>
      ),
    },
    {
      target: '[href="/ai/recetas"]',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2 text-brand-gold">
            🍳 Nutrirecetas
          </h3>
          <p>Genera recetas saludables con fotos reales de los platillos.</p>
        </div>
      ),
    },
  ];

  if (!mounted) return null;

  if (!run && hasSeenTutorial) {
    return (
      <button
        onClick={resetTutorial}
        className="fixed bottom-4 right-4 z-40 p-2 bg-brand-black border border-brand-gold rounded-full text-brand-gold hover:bg-brand-gold/10 text-xs shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-all"
        title="Ver Tutorial"
      >
        ❓
      </button>
    );
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleJoyrideCallback}
      floaterProps={{ disableAnimation: true }}
      styles={{
        options: {
          primaryColor: "#D4AF37",
          backgroundColor: "#000000",
          arrowColor: "#D4AF37",
          textColor: "#FFFFFF",
          overlayColor: "rgba(0, 0, 0, 0.85)",
          zIndex: 1000,
        },
        buttonClose: {
          display: "none",
        },
        tooltip: {
          border: "1px solid #D4AF37",
          borderRadius: "16px",
          boxShadow: "0 0 15px rgba(0, 255, 255, 0.4)",
        },
        buttonNext: {
          borderRadius: "9999px",
          fontWeight: "bold",
          boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
        },
        buttonBack: {
          color: "#D4AF37",
        },
        buttonSkip: {
          color: "#6B7280",
        },
      }}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Saltar",
      }}
    />
  );
}
