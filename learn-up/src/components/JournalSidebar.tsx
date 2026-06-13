"use client";

import { useState } from "react";
import { Book, Heart, Smile, Frown, Meh, Save, Target, Sparkles, CheckCircle2, Circle, Wind } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MOODS = [
  { id: "happy", icon: Smile, color: "text-emerald-400", activeBg: "bg-emerald-400/20 border-emerald-400/50" },
  { id: "neutral", icon: Meh, color: "text-amber-400", activeBg: "bg-amber-400/20 border-amber-400/50" },
  { id: "sad", icon: Frown, color: "text-rose-400", activeBg: "bg-rose-400/20 border-rose-400/50" },
];

export default function JournalSidebar() {
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [goals, setGoals] = useState([
    { id: 1, text: "Beber 2L de agua", done: false, color: "bg-pink-500/10 border-pink-500/20 hover:border-pink-500/40" },
    { id: 2, text: "Meditar 10 mins", done: true, color: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40" },
    { id: 3, text: "Terminar el ensayo", done: false, color: "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40" },
  ]);

  const toggleGoal = (id: number) => {
    setGoals(goals.map(g => g.id === id ? { ...g, done: !g.done } : g));
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#050505] border-l border-white/5 font-sans text-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight text-white leading-none">Mi Espacio</h2>
            <p className="text-xs text-gray-400 mt-1">Reflexión y metas</p>
          </div>
        </div>
        <Wind className="w-5 h-5 text-gray-600 animate-pulse" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {/* Muro de Metas (Post-its) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-indigo-400 uppercase flex items-center gap-2">
              <Target className="w-4 h-4" /> Objetivos de Hoy
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence>
              {goals.map((goal) => (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleGoal(goal.id)}
                  className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex items-start gap-3 ${goal.color} ${goal.done ? 'opacity-50 grayscale' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {goal.done ? (
                      <CheckCircle2 className="w-5 h-5 text-white/70" />
                    ) : (
                      <Circle className="w-5 h-5 text-white/40" />
                    )}
                  </div>
                  <p className={`text-sm font-medium ${goal.done ? 'line-through text-white/50' : 'text-white/90'}`}>
                    {goal.text}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Mood Tracker */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Tracker de Ánimo
            </h3>
          </div>
          <div className="flex items-center gap-3 bg-surface-2 p-2 rounded-3xl border border-white/5">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const isActive = mood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 ${
                    isActive 
                      ? m.activeBg 
                      : "border-transparent bg-transparent hover:bg-white/5 text-gray-500"
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-1 ${isActive ? m.color : ""}`} />
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${isActive ? m.color : "opacity-0"}`}>
                    {m.id}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick Note */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold tracking-widest text-amber-400 uppercase flex items-center gap-2">
            <Book className="w-4 h-4" /> Diario Emocional
          </h3>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿Qué tienes en mente? Alma te escucha..."
              className="relative w-full h-32 bg-black/50 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-amber-500/50 transition-colors font-serif placeholder:text-gray-600 shadow-inner"
            />
            <button
              disabled={!note.trim()}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-black text-xs font-bold uppercase tracking-wider rounded-xl hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all disabled:opacity-0 disabled:translate-y-2 duration-300"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
