"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelRightClose, PanelLeft, PanelRight, X } from "lucide-react";

interface NotebookLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export default function NotebookLayout({ leftPanel, centerPanel, rightPanel }: NotebookLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const isLg = window.innerWidth >= 1024;
      setIsDesktop(isLg);
      if (isLg) {
        setLeftOpen(true);
        setRightOpen(true);
      } else {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-[calc(100dvh-4rem)] md:h-dvh overflow-hidden bg-[#060608] relative">
      {/* Overlay para móvil/tablet cuando hay un drawer abierto */}
      <AnimatePresence>
        {!isDesktop && (leftOpen || rightOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setLeftOpen(false); setRightOpen(false); }}
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Left Panel - Sources & History */}
      <AnimatePresence>
        {leftOpen && (
          <motion.aside
            initial={{ x: isDesktop ? 0 : -280, width: isDesktop ? 0 : 280, opacity: isDesktop ? 0 : 1 }}
            animate={{ x: 0, width: 280, opacity: 1 }}
            exit={{ x: isDesktop ? 0 : -280, width: isDesktop ? 0 : 280, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className={`flex flex-col border-r border-white/10 bg-surface-1/95 backdrop-blur-xl overflow-hidden shrink-0 
              ${isDesktop ? 'static' : 'absolute left-0 top-0 bottom-0 z-50 shadow-2xl'}`}
          >
            {!isDesktop && (
              <button 
                onClick={() => setLeftOpen(false)}
                className="absolute top-3 right-3 z-50 p-2 bg-black/50 rounded-full text-gray-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="w-[280px] h-full">
              {leftPanel}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-brand-black">
        {/* Toggle buttons for desktop & mobile */}
        <div className="absolute top-3 left-3 z-20 flex gap-1">
          <button 
            onClick={() => setLeftOpen(!leftOpen)} 
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2/80 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors backdrop-blur-md shadow-lg shadow-black/20"
            title="Archivos e Historial"
          >
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
        
        <div className="absolute top-3 right-3 z-20 flex gap-1">
          <button 
            onClick={() => setRightOpen(!rightOpen)} 
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2/80 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors backdrop-blur-md shadow-lg shadow-black/20"
            title="Pizarra y Herramientas"
          >
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>

        {centerPanel}
      </div>

      {/* Right Panel - Notebook/Whiteboard */}
      <AnimatePresence>
        {rightOpen && (
          <motion.aside
            initial={{ x: isDesktop ? 0 : 340, width: isDesktop ? 0 : 340, opacity: isDesktop ? 0 : 1 }}
            animate={{ x: 0, width: 340, opacity: 1 }}
            exit={{ x: isDesktop ? 0 : 340, width: isDesktop ? 0 : 340, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className={`flex flex-col border-l border-white/10 bg-surface-1/95 backdrop-blur-xl overflow-hidden shrink-0
              ${isDesktop ? 'static' : 'absolute right-0 top-0 bottom-0 z-50 shadow-2xl'}`}
          >
            {!isDesktop && (
              <button 
                onClick={() => setRightOpen(false)}
                className="absolute top-3 right-3 z-50 p-2 bg-black/50 rounded-full text-gray-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="w-[340px] h-full">
              {rightPanel}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
