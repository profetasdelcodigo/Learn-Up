import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

function patchChat() {
  const p = "learn-up/src/components/AIChatComponent.tsx";
  let source = read(p);
  const original = source;

  source = source.replace(
    'const loadSessionMessages = async (sessionId: string) => {\n    setMessages([]);\n    setLoading(true);',
    'const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);',
  );

  const effectPattern = /\n  useEffect\(\(\) => \{\n    if \(currentSessionId\) \{[\s\S]*?\n  \}, \[currentSessionId\]\);/g;
  const effects = [...source.matchAll(effectPattern)];
  if (effects.length > 1) {
    const duplicate = effects[effects.length - 1];
    source = source.slice(0, duplicate.index) + source.slice(duplicate.index + duplicate[0].length);
  }

  if (!source.includes("clientMessageId?: string")) {
    source = source.replace(
      '  tool_calls?: ToolAction[];\n}',
      '  tool_calls?: ToolAction[];\n  clientMessageId?: string;\n  status?: "sending" | "streaming" | "tool_pending" | "tool_running" | "completed" | "failed";\n}',
    );
  }

  source = source.replace(
    '  const isCreatingSession = useRef(false);\n  const supabase = createClient();',
    '  const isCreatingSession = useRef(false);\n  const submitInFlight = useRef(false);\n  const supabase = createClient();',
  );

  source = source.replace(
    '    if ((!input.trim() && !file) || loading) return;',
    '    if ((!input.trim() && !file) || submitInFlight.current || uploadingMedia) return;\n    submitInFlight.current = true;',
  );

  if (!source.includes("const clientMessageId = typeof crypto")) {
    source = source.replace(
      '    const mediaType = file ? getMediaType(file) : undefined;\n    const clientSideUserMsg: Message = {\n      role: "user",',
      '    const mediaType = file ? getMediaType(file) : undefined;\n    const clientMessageId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\n      ? crypto.randomUUID()\n      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;\n    const clientSideUserMsg: Message = {\n      id: clientMessageId,\n      clientMessageId,\n      status: "sending",\n      role: "user",',
    );
  }

  source = source.replace(
    'setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));',
    'setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));',
  );

  source = source.replace(
    'prev.map(m => m === clientSideUserMsg ? { ...m, media_url: mediaUrl } : m)',
    'prev.map(m => m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl } : m)',
  );

  source = source.replace(
    'await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);',
    'const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);',
  );

  source = source.replace(
    'const historyForGroq = messages.map((m) => ({',
    'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({',
  );

  source = source.replace(
    'setMessages((prev) => [\n          ...prev,\n          { role: "assistant", content: result.response, tool_calls: result.executedActions },\n        ]);',
    'setMessages((prev) => prev\n          .map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "completed" } : m)\n          .concat({ id: `assistant-${clientMessageId}`, role: "assistant", content: result.response, status: "completed", tool_calls: result.executedActions }));',
  );

  source = source.replace(
    'await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions);',
    'await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions, `assistant-${clientMessageId}`);',
  );

  source = source.replace(
    '    } finally {\n      setLoading(false);\n    }\n  };',
    '    } finally {\n      setLoading(false);\n      submitInFlight.current = false;\n    }\n  };',
  );

  // Manual confirmation must carry the current session so panel tools can update the real panel.
  source = source.replace(
    'confirmAndExecuteTool(action.tool, action.args)',
    'confirmAndExecuteTool(action.tool, action.args, currentSessionId)',
  );

  if (source !== original) write(p, source);
  console.log("[repair] chat patched");
}

function patchAiTutorConfirmation() {
  const p = "learn-up/src/actions/ai-tutor.ts";
  let source = read(p);
  const start = source.indexOf("// ── Ejecutar herramienta confirmada por el usuario");
  if (start >= 0) {
    source = source.slice(0, start) + `// ── Ejecutar herramienta confirmada por el usuario ────────────────────────────\nexport async function confirmAndExecuteTool(\n  tool: string,\n  args: Record<string, any>,\n  sessionId?: string | null,\n): Promise<{ success: boolean; message: string; data?: any; displayMessage?: string }> {\n  const supabase = await createClient();\n  const { data: { user } } = await supabase.auth.getUser();\n  if (!user) return { success: false, message: "No autorizado. Por favor inicia sesión." };\n  const { executeUnifiedTool } = await import("@/lib/ai/tool-executor");\n  const result = await executeUnifiedTool(tool, args, user.id, sessionId);\n  return { success: Boolean(result.success), message: result.displayMessage || result.message || "", data: result.data, displayMessage: result.displayMessage };\n}\n`;
    write(p, source);
    console.log("[repair] ai-tutor confirmation patched");
  }
}

function patchNotebookRealtime() {
  const p = "learn-up/src/components/NotebookWhiteboard.tsx";
  let source = read(p);
  source = source.replace('table: "ai_environments"', 'table: "ai_sessions"');
  source = source.replace('table: "ai_environments",\n          filter:', 'table: "ai_sessions",\n          filter:');
  write(p, source);
  console.log("[repair] professor realtime target patched");
}

function rewriteJournalSidebar() {
  const p = "learn-up/src/components/JournalSidebar.tsx";
  write(p, `"use client";\n\nimport { useEffect, useState } from "react";\nimport { Book, Heart, Smile, Frown, Meh, Save, Target, Sparkles, CheckCircle2, Circle, Wind } from "lucide-react";\nimport { motion, AnimatePresence } from "framer-motion";\nimport { getAiEnvironment, updateAiEnvironment } from "@/actions/ai-environment";\nimport { createClient } from "@/utils/supabase/client";\n\nconst MOODS = [\n  { id: "happy", icon: Smile, label: "Feliz", active: "text-emerald-400" },\n  { id: "neutral", icon: Meh, label: "Neutral", active: "text-amber-400" },\n  { id: "sad", icon: Frown, label: "Triste", active: "text-rose-400" },\n] as const;\n\nconst DEFAULT_GOALS = [\n  { id: "water", text: "Beber 2L de agua", done: false },\n  { id: "meditate", text: "Meditar 10 mins", done: true },\n  { id: "essay", text: "Terminar el ensayo", done: false },\n];\n\nexport default function JournalSidebar({ currentSessionId }: { currentSessionId?: string | null }) {\n  const [goals, setGoals] = useState(DEFAULT_GOALS);\n  const [mood, setMood] = useState<string | null>(null);\n  const [note, setNote] = useState("");\n  const [ready, setReady] = useState(false);\n\n  useEffect(() => {\n    let mounted = true;\n    if (!currentSessionId) { setGoals(DEFAULT_GOALS); setMood(null); setNote(""); setReady(false); return; }\n    const load = async () => {\n      const state = await getAiEnvironment(currentSessionId);\n      if (!mounted) return;\n      if (state?.counselorGoals) setGoals(state.counselorGoals);\n      if (state?.counselorMood?.id) setMood(state.counselorMood.id);\n      if (Array.isArray(state?.counselorJournal) && state.counselorJournal.length) setNote(state.counselorJournal[state.counselorJournal.length - 1]?.text || "");\n      setReady(true);\n    };\n    load();\n    const supabase = createClient();\n    const channel = supabase.channel(`counselor_panel_${currentSessionId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "ai_sessions", filter: `id=eq.${currentSessionId}` }, load).subscribe();\n    return () => { mounted = false; supabase.removeChannel(channel); };\n  }, [currentSessionId]);\n\n  const save = async (patch: any) => {\n    if (!currentSessionId) return;\n    const state = await getAiEnvironment(currentSessionId) || {};\n    await updateAiEnvironment(currentSessionId, { ...state, ...patch });\n  };\n\n  const toggleGoal = async (id: string) => {\n    const next = goals.map(g => g.id === id ? { ...g, done: !g.done } : g);\n    setGoals(next); await save({ counselorGoals: next });\n  };\n  const chooseMood = async (id: string) => {\n    setMood(id); await save({ counselorMood: { id, note: "", updatedAt: new Date().toISOString() } });\n  };\n  const saveJournal = async () => {\n    if (!currentSessionId || !note.trim()) return;\n    const state = await getAiEnvironment(currentSessionId) || {};\n    const journal = Array.isArray(state.counselorJournal) ? state.counselorJournal : [];\n    const next = [...journal, { id: crypto.randomUUID(), text: note.trim(), createdAt: new Date().toISOString() }].slice(-100);\n    await updateAiEnvironment(currentSessionId, { ...state, counselorJournal: next });\n  };\n\n  return <div className="flex flex-col w-full h-full bg-[#050505] border-l border-white/5 font-sans text-[#e5e5e5]">\n    <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">\n      <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400"><Heart className="w-5 h-5" /></div><div><h2 className="font-semibold text-lg tracking-tight text-white">Mi Espacio</h2><p className="text-xs text-gray-400 mt-1">Reflexión y metas</p></div></div><Wind className="w-5 h-5 text-gray-600 animate-pulse" />\n    </div>\n    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">\n      <section className="space-y-4"><h3 className="text-xs font-bold tracking-widest text-indigo-400 uppercase flex items-center gap-2"><Target className="w-4 h-4" /> Objetivos de Hoy</h3><div className="grid gap-3"><AnimatePresence>{goals.map(goal => <motion.button key={goal.id} onClick={() => toggleGoal(goal.id)} layout whileTap={{ scale: 0.98 }} className={`p-4 rounded-2xl border flex items-start gap-3 text-left ${goal.done ? "opacity-50 bg-white/5 border-white/10" : "bg-indigo-500/5 border-indigo-500/20"}`}>{goal.done ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-400" /> : <Circle className="w-5 h-5 mt-0.5 text-white/40" />}<span className={goal.done ? "line-through text-gray-500" : "text-white/90"}>{goal.text}</span></motion.button>)}</AnimatePresence></div></section>\n      <section className="space-y-4"><h3 className="text-xs font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-2"><Sparkles className="w-4 h-4" /> Tracker de Ánimo</h3><div className="flex gap-3 bg-white/[0.03] p-2 rounded-3xl border border-white/5">{MOODS.map(m => { const Icon = m.icon; return <button key={m.id} onClick={() => chooseMood(m.id)} className={`flex-1 p-3 rounded-2xl border transition-all ${mood === m.id ? "bg-white/10 border-white/15" : "border-transparent hover:bg-white/5"}`}><Icon className={`w-6 h-6 mx-auto ${mood === m.id ? m.active : "text-gray-600"}`} /><span className="block text-[10px] mt-1 text-gray-500">{m.label}</span></button>; })}</div></section>\n      <section className="space-y-4"><h3 className="text-xs font-bold tracking-widest text-amber-400 uppercase flex items-center gap-2"><Book className="w-4 h-4" /> Diario Emocional</h3><div className="relative"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="¿Qué tienes en mente? Alma te escucha..." className="w-full h-32 bg-black/50 border border-white/10 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-amber-500/50" /><button onClick={saveJournal} disabled={!ready || !note.trim()} className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-xl disabled:opacity-30"><Save className="w-4 h-4" />Guardar</button></div></section>\n    </div>\n  </div>;\n}\n`);
  console.log("[repair] counselor panel rewritten");
}

function rewriteRecipeSidebar() {
  const p = "learn-up/src/components/RecipeSidebar.tsx";
  write(p, `"use client";\n\nimport { useEffect, useState } from "react";\nimport { Utensils, Flame, ShoppingCart, CalendarDays, Check, Circle } from "lucide-react";\nimport { motion } from "framer-motion";\nimport { getAiEnvironment, updateAiEnvironment } from "@/actions/ai-environment";\nimport { createClient } from "@/utils/supabase/client";\n\ntype SidebarTab = "macros" | "shopping" | "planner";\ninterface Macros { protein: number; carbs: number; fats: number; calories: number; }\nconst DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];\n\nexport default function RecipeSidebar({ currentSessionId }: { currentSessionId?: string | null }) {\n  const [activeTab, setActiveTab] = useState<SidebarTab>("macros");\n  const [recipe, setRecipe] = useState<{ name: string; imageUrl?: string | null } | null>(null);\n  const [macros, setMacros] = useState<Macros | null>(null);\n  const [shoppingList, setShoppingList] = useState<{ name: string; checked: boolean }[]>([]);\n  const [mealPlan, setMealPlan] = useState<Record<string, string>>({});\n\n  useEffect(() => {\n    if (!currentSessionId) { setRecipe(null); setMacros(null); setShoppingList([]); setMealPlan({}); return; }\n    const load = async () => {\n      const state = await getAiEnvironment(currentSessionId);\n      if (!state) return;\n      if (state.nutritionRecipe) setRecipe(state.nutritionRecipe);\n      if (state.nutritionMacros) setMacros(state.nutritionMacros);\n      if (Array.isArray(state.nutritionShoppingList)) setShoppingList(state.nutritionShoppingList);\n      if (state.nutritionMealPlan) setMealPlan(state.nutritionMealPlan);\n    };\n    load();\n    const supabase = createClient();\n    const channel = supabase.channel(`nutrition_panel_${currentSessionId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "ai_sessions", filter: `id=eq.${currentSessionId}` }, load).subscribe();\n    return () => { supabase.removeChannel(channel); };\n  }, [currentSessionId]);\n\n  const save = async (patch: any) => {\n    if (!currentSessionId) return;\n    const state = await getAiEnvironment(currentSessionId) || {};\n    await updateAiEnvironment(currentSessionId, { ...state, ...patch });\n  };\n  const toggleShopping = async (i: number) => { const next = shoppingList.map((x, idx) => idx === i ? { ...x, checked: !x.checked } : x); setShoppingList(next); await save({ nutritionShoppingList: next }); };\n  const assignMeal = async (day: string) => { if (!recipe?.name) return; const next = { ...mealPlan, [day]: recipe.name }; setMealPlan(next); await save({ nutritionMealPlan: next }); };\n  const tabs = [{ id: "macros", label: "Macros", icon: Flame }, { id: "shopping", label: "Compras", icon: ShoppingCart }, { id: "planner", label: "Semana", icon: CalendarDays }];\n  return <div className="flex flex-col w-full h-full bg-[#050505] border-l border-white/5 font-sans">\n    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5"><div className="p-2 rounded-xl bg-orange-500/20 text-orange-400"><Utensils className="w-5 h-5" /></div><div><h2 className="font-bold text-base text-white">Chef Panel</h2><p className="text-[11px] text-gray-500">Nutrición & planificación</p></div></div>\n    <div className="flex bg-black/40 mx-4 mt-3 rounded-xl p-1 border border-white/5">{tabs.map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => setActiveTab(t.id as SidebarTab)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-lg ${activeTab === t.id ? "bg-orange-500 text-white" : "text-gray-500"}`}><Icon className="w-3.5 h-3.5" />{t.label}</button>; })}</div>\n    <div className="flex-1 overflow-y-auto p-4">\n      {activeTab === "macros" && <div className="space-y-4">{recipe?.imageUrl && <img src={recipe.imageUrl} alt={recipe.name} className="w-full aspect-[4/3] object-cover rounded-2xl border border-white/10" />}{recipe?.name && <h3 className="text-lg font-bold text-white">{recipe.name}</h3>}{macros ? <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5"><div className="flex justify-between mb-4"><span className="text-orange-400 font-bold">Calorías</span><span className="text-2xl text-white font-black">{macros.calories} <small className="text-gray-500">kcal</small></span></div><div className="space-y-3">{[["Proteína",macros.protein],["Carbohidratos",macros.carbs],["Grasas",macros.fats]].map(([label,value]) => <div key={label as string} className="flex justify-between text-sm"><span className="text-gray-400">{label}</span><span className="text-white font-bold">{value}g</span></div>)}</div></div> : <p className="text-sm text-gray-500 text-center py-8">Pídele al Chef que calcule los macros.</p>}</div>}\n      {activeTab === "shopping" && <div className="space-y-2">{shoppingList.length ? shoppingList.map((item,i) => <button key={`${item.name}-${i}`} onClick={() => toggleShopping(i)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-left">{item.checked ? <Check className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-gray-600" />}<span className={item.checked ? "line-through text-gray-500" : "text-gray-300"}>{item.name}</span></button>) : <p className="text-sm text-gray-500 text-center py-10">Los ingredientes que agregue el Chef aparecerán aquí.</p>}</div>}\n      {activeTab === "planner" && <div className="space-y-2">{DAYS.map(day => <div key={day} className="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between"><span className="text-sm text-gray-300">{day}</span><button onClick={() => assignMeal(day)} disabled={!recipe?.name} className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 disabled:opacity-30">{mealPlan[day] || "Asignar receta"}</button></div>)}</div>}\n    </div>\n  </div>;\n}\n`);
  console.log("[repair] nutrition panel rewritten");
}

function main() {
  patchChat();
  patchAiTutorConfirmation();
  patchNotebookRealtime();
  rewriteJournalSidebar();
  rewriteRecipeSidebar();
}

main();
