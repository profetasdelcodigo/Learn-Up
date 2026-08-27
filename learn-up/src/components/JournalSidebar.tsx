"use client";

import { useEffect, useState } from "react";
import { Book, Heart, Smile, Frown, Meh, Save, Target, Sparkles, CheckCircle2, Circle, Wind } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAiEnvironment, updateAiEnvironment } from "@/actions/ai-environment";
import { createClient } from "@/utils/supabase/client";

const MOODS = [
  { id: "happy", icon: Smile, label: "Feliz", active: "text-emerald-400" },
  { id: "neutral", icon: Meh, label: "Neutral", active: "text-amber-400" },
  { id: "sad", icon: Frown, label: "Triste", active: "text-rose-400" },
] as const;
const DEFAULT_GOALS = [
  { id: "water", text: "Beber 2L de agua", done: false },
  { id: "meditate", text: "Meditar 10 mins", done: true },
  { id: "essay", text: "Terminar el ensayo", done: false },
];

export default function JournalSidebar({ currentSessionId }: { currentSessionId?: string | null }) {
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (!currentSessionId) { setGoals(DEFAULT_GOALS); setMood(null); setNote(""); setReady(false); return; }
    const load = async () => {
      const state = await getAiEnvironment(currentSessionId);
      if (!mounted) return;
      if (Array.isArray(state?.counselorGoals)) setGoals(state.counselorGoals);
      if (state?.counselorMood?.id) setMood(state.counselorMood.id);
      if (Array.isArray(state?.counselorJournal) && state.counselorJournal.length) setNote(state.counselorJournal[state.counselorJournal.length - 1]?.text || "");
      setReady(true);
    };
    load();
    const supabase = createClient();
    const channel = supabase.channel("counselor_panel_" + currentSessionId).on("postgres_changes", { event: "UPDATE", schema: "public", table: "ai_sessions", filter: "id=eq." + currentSessionId }, load).subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [currentSessionId]);
  const save = async (patch: any) => { if (!currentSessionId) return; const state = await getAiEnvironment(currentSessionId) || {}; await updateAiEnvironment(currentSessionId, { ...state, ...patch }); };
  const toggleGoal = async (id: any) => { const next = goals.map(g => String(g.id) === String(id) ? { ...g, done: !g.done } : g); setGoals(next); await save({ counselorGoals: next }); };
  const chooseMood = async (id: string) => { setMood(id); await save({ counselorMood: { id, note: "", updatedAt: new Date().toISOString() } }); };
  const saveJournal = async () => { if (!currentSessionId || !note.trim()) return; const state = await getAiEnvironment(currentSessionId) || {}; const journal = Array.isArray(state.counselorJournal) ? state.counselorJournal : []; const next = [...journal, { id: String(Date.now()) + "-" + Math.random().toString(36).slice(2), text: note.trim(), createdAt: new Date().toISOString() }].slice(-100); await updateAiEnvironment(currentSessionId, { ...state, counselorJournal: next }); };
  return <div className="flex flex-col w-full h-full bg-[#050505] border-l border-white/5 font-sans text-[#e5e5e5]">
    <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400"><Heart className="w-5 h-5" /></div><div><h2 className="font-semibold text-lg tracking-tight text-white">Mi Espacio</h2><p className="text-xs text-gray-400 mt-1">Reflexión y metas</p></div></div><Wind className="w-5 h-5 text-gray-600 animate-pulse" /></div>
    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
      <section className="space-y-4"><h3 className="text-xs font-bold tracking-widest text-indigo-400 uppercase flex items-center gap-2"><Target className="w-4 h-4" /> Objetivos de Hoy</h3><div className="grid gap-3"><AnimatePresence>{goals.map(goal => <motion.button key={String(goal.id)} onClick={() => toggleGoal(goal.id)} layout whileTap={{ scale: 0.98 }} className={`p-4 rounded-2xl border flex items-start gap-3 text-left ${goal.done ? "opacity-50 bg-white/5 border-white/10" : "bg-indigo-500/5 border-indigo-500/20"}`}>{goal.done ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-400" /> : <Circle className="w-5 h-5 mt-0.5 text-white/40" />}<span className={goal.done ? "line-through text-gray-500" : "text-white/90"}>{goal.text}</span></motion.button>)}</AnimatePresence></div></section>
      <section className="space-y-4"><h3 className="text-xs font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-2"><Sparkles className="w-4 h-4" /> Tracker de Ánimo</h3><div className="flex gap-3 bg-white/[0.03] p-2 rounded-3xl border border-white/5">{MOODS.map(m => { const Icon = m.icon; return <button key={m.id} onClick={() => chooseMood(m.id)} className={`flex-1 p-3 rounded-2xl border transition-all ${mood === m.id ? "bg-white/10 border-white/15" : "border-transparent hover:bg-white/5"}`}><Icon className={`w-6 h-6 mx-auto ${mood === m.id ? m.active : "text-gray-600"}`} /><span className="block text-[10px] mt-1 text-gray-500">{m.label}</span></button>; })}</div></section>
      <section className="space-y-4"><h3 className="text-xs font-bold tracking-widest text-amber-400 uppercase flex items-center gap-2"><Book className="w-4 h-4" /> Diario Emocional</h3><div className="relative"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="¿Qué tienes en mente? Alma te escucha..." className="w-full h-32 bg-black/50 border border-white/10 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-amber-500/50" /><button onClick={saveJournal} disabled={!ready || !note.trim()} className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-xl disabled:opacity-30"><Save className="w-4 h-4" />Guardar</button></div></section>
    </div>
  </div>;
}