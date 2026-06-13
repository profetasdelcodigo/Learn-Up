"use client";

import { useState } from "react";
import { Network, FileText, BrainCircuit, Maximize2, X, Calculator, ListTree, BookOpenCheck, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "graph" | "document" | "formulas" | "outline";

export default function NotebookWhiteboard() {
  const [activeTab, setActiveTab] = useState<Tab>("graph");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [outlineItems, setOutlineItems] = useState<string[]>([
    "Concepto principal",
    "Definiciones clave",
    "Fórmulas y teoremas",
    "Ejemplos resueltos",
    "Ejercicios propuestos",
  ]);
  const [formulas, setFormulas] = useState<string[]>([
    "E = mc²",
    "F = ma",
    "a² + b² = c²",
  ]);
  const [newFormula, setNewFormula] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "graph", label: "Grafo", icon: <Network className="w-3.5 h-3.5" /> },
    { id: "document", label: "Docs", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "formulas", label: "Fórmulas", icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: "outline", label: "Esquema", icon: <ListTree className="w-3.5 h-3.5" /> },
  ];

  const handleCopyFormula = (formula: string, idx: number) => {
    navigator.clipboard.writeText(formula);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleAddFormula = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFormula.trim()) {
      setFormulas((prev) => [...prev, newFormula.trim()]);
      setNewFormula("");
    }
  };

  return (
    <div className={`flex flex-col w-full h-full bg-[#060608] border-l border-white/10 ${isFullscreen ? 'fixed inset-0 z-50 bg-brand-black' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface-2/40 backdrop-blur-xl shrink-0" style={{ paddingTop: isFullscreen ? "1rem" : "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm text-white">Espacio Académico</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-black/50 rounded-lg p-0.5 border border-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "text-gray-500 hover:text-white"
                }`}
              >
                {tab.icon}
                <span className="hidden xl:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ── Grafo de Conocimiento ── */}
          {activeTab === "graph" && (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center flex-col text-center p-8 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.05),transparent_70%)]"
            >
              <div className="relative w-40 h-40 mb-6">
                {/* Animated nodes */}
                <motion.div animate={{ y: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Network className="w-5 h-5 text-cyan-400" />
                </motion.div>
                <motion.div animate={{ y: [5, -5, 5] }} transition={{ repeat: Infinity, duration: 4 }} className="absolute bottom-6 left-4 w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/40" />
                <motion.div animate={{ x: [3, -3, 3] }} transition={{ repeat: Infinity, duration: 3.5 }} className="absolute bottom-2 right-6 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40" />
                <motion.div animate={{ x: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 2.8 }} className="absolute top-12 right-2 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 160 160">
                  <line x1="80" y1="30" x2="35" y2="110" stroke="rgb(6,182,212)" strokeWidth="1" />
                  <line x1="80" y1="30" x2="115" y2="80" stroke="rgb(139,92,246)" strokeWidth="1" />
                  <line x1="35" y1="110" x2="110" y2="130" stroke="rgb(245,158,11)" strokeWidth="1" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Grafo de Conocimiento</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Los conceptos aprendidos se conectarán aquí visualmente. Pregúntale al Profesor para empezar.
              </p>
            </motion.div>
          )}

          {/* ── Visor de Documentos ── */}
          {activeTab === "document" && (
            <motion.div
              key="document"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col p-4"
            >
              <div className="w-full h-full rounded-2xl border border-white/10 bg-black/30 flex flex-col">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                  <BookOpenCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Lector de Documentos</span>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                  <div>
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm mb-1">Sube un PDF o documento al chat</p>
                    <p className="text-gray-600 text-xs">El contenido aparecerá aquí para lectura lado a lado</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Pizarra de Fórmulas ── */}
          {activeTab === "formulas" && (
            <motion.div
              key="formulas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar"
            >
              <div className="space-y-3">
                {formulas.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 transition-all"
                  >
                    <code className="text-lg font-mono text-cyan-300 tracking-wider">{f}</code>
                    <button
                      onClick={() => handleCopyFormula(f, i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10"
                    >
                      {copiedIdx === i ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                  </motion.div>
                ))}
              </div>
              <form onSubmit={handleAddFormula} className="flex gap-2 mt-auto sticky bottom-0 bg-[#060608] pt-2">
                <input
                  value={newFormula}
                  onChange={(e) => setNewFormula(e.target.value)}
                  placeholder="Agregar fórmula..."
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                />
                <button type="submit" className="px-4 py-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl text-sm font-bold hover:bg-cyan-500/30 transition-colors border border-cyan-500/30">
                  +
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Esquema / Índice ── */}
          {activeTab === "outline" && (
            <motion.div
              key="outline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col p-4 gap-2 overflow-y-auto custom-scrollbar"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2 px-1">Índice de la Clase</p>
              {outlineItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group cursor-default"
                >
                  <span className="mt-0.5 w-6 h-6 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{item}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
