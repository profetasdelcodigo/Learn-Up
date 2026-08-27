"use client";

import { useEffect, useState } from "react";
import { Utensils, Flame, ShoppingCart, CalendarDays, Check, Circle } from "lucide-react";
import { getAiEnvironment, updateAiEnvironment } from "@/actions/ai-environment";
import { createClient } from "@/utils/supabase/client";

type SidebarTab = "macros" | "shopping" | "planner";
interface Macros { protein: number; carbs: number; fats: number; calories: number; }
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function RecipeSidebar({ currentSessionId }: { currentSessionId?: string | null }) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("macros");
  const [recipe, setRecipe] = useState<{ name: string; imageUrl?: string | null } | null>(null);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [shoppingList, setShoppingList] = useState<{ name: string; checked: boolean }[]>([]);
  const [mealPlan, setMealPlan] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!currentSessionId) { setRecipe(null); setMacros(null); setShoppingList([]); setMealPlan({}); return; }
    const load = async () => { const state = await getAiEnvironment(currentSessionId); if (!state) return; if (state.nutritionRecipe) setRecipe(state.nutritionRecipe); if (state.nutritionMacros) setMacros(state.nutritionMacros); if (Array.isArray(state.nutritionShoppingList)) setShoppingList(state.nutritionShoppingList); if (state.nutritionMealPlan) setMealPlan(state.nutritionMealPlan); };
    load();
    const supabase = createClient();
    const channel = supabase.channel("nutrition_panel_" + currentSessionId).on("postgres_changes", { event: "UPDATE", schema: "public", table: "ai_sessions", filter: "id=eq." + currentSessionId }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentSessionId]);
  const save = async (patch: any) => { if (!currentSessionId) return; const state = await getAiEnvironment(currentSessionId) || {}; await updateAiEnvironment(currentSessionId, { ...state, ...patch }); };
  const toggleShopping = async (i: number) => { const next = shoppingList.map((x, idx) => idx === i ? { ...x, checked: !x.checked } : x); setShoppingList(next); await save({ nutritionShoppingList: next }); };
  const assignMeal = async (day: string) => { if (!recipe?.name) return; const next = { ...mealPlan, [day]: recipe.name }; setMealPlan(next); await save({ nutritionMealPlan: next }); };
  const tabs = [{ id: "macros", label: "Macros", icon: Flame }, { id: "shopping", label: "Compras", icon: ShoppingCart }, { id: "planner", label: "Semana", icon: CalendarDays }];
  return <div className="flex flex-col w-full h-full bg-[#050505] border-l border-white/5 font-sans">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5"><div className="p-2 rounded-xl bg-orange-500/20 text-orange-400"><Utensils className="w-5 h-5" /></div><div><h2 className="font-bold text-base text-white">Chef Panel</h2><p className="text-[11px] text-gray-500">Nutrición & planificación</p></div></div>
    <div className="flex bg-black/40 mx-4 mt-3 rounded-xl p-1 border border-white/5">{tabs.map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => setActiveTab(t.id as SidebarTab)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-lg ${activeTab === t.id ? "bg-orange-500 text-white" : "text-gray-500"}`}><Icon className="w-3.5 h-3.5" />{t.label}</button>; })}</div>
    <div className="flex-1 overflow-y-auto p-4">
      {activeTab === "macros" && <div className="space-y-4">{recipe?.imageUrl && <img src={recipe.imageUrl} alt={recipe.name} className="w-full aspect-[4/3] object-cover rounded-2xl border border-white/10" />}{recipe?.name && <h3 className="text-lg font-bold text-white">{recipe.name}</h3>}{macros ? <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5"><div className="flex justify-between mb-4"><span className="text-orange-400 font-bold">Calorías</span><span className="text-2xl text-white font-black">{macros.calories} <small className="text-gray-500">kcal</small></span></div><div className="space-y-3">{[["Proteína",macros.protein],["Carbohidratos",macros.carbs],["Grasas",macros.fats]].map(([label,value]) => <div key={String(label)} className="flex justify-between text-sm"><span className="text-gray-400">{label}</span><span className="text-white font-bold">{value}g</span></div>)}</div></div> : <p className="text-sm text-gray-500 text-center py-8">Pídele al Chef que calcule los macros.</p>}</div>}
      {activeTab === "shopping" && <div className="space-y-2">{shoppingList.length ? shoppingList.map((item,i) => <button key={item.name + String(i)} onClick={() => toggleShopping(i)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-left">{item.checked ? <Check className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-gray-600" />}<span className={item.checked ? "line-through text-gray-500" : "text-gray-300"}>{item.name}</span></button>) : <p className="text-sm text-gray-500 text-center py-10">Los ingredientes que agregue el Chef aparecerán aquí.</p>}</div>}
      {activeTab === "planner" && <div className="space-y-2">{DAYS.map(day => <div key={day} className="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between"><span className="text-sm text-gray-300">{day}</span><button onClick={() => assignMeal(day)} disabled={!recipe?.name} className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 disabled:opacity-30">{mealPlan[day] || "Asignar receta"}</button></div>)}</div>}
    </div>
  </div>;
}