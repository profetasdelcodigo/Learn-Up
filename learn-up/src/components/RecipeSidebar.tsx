"use client";

import { useEffect, useState } from "react";
import { Utensils, Flame, ShoppingCart, CalendarDays, Check, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RecipeSidebarProps {
  messages: any[];
}

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
}

type SidebarTab = "macros" | "shopping" | "planner";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function RecipeSidebar({ messages }: RecipeSidebarProps) {
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState<string>("Esperando receta...");
  const [macros, setMacros] = useState<Macros | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>("macros");
  const [shoppingList, setShoppingList] = useState<{ name: string; checked: boolean }[]>([]);
  const [mealPlan, setMealPlan] = useState<Record<string, string>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length === 0) return;

    const lastMessage = assistantMessages[assistantMessages.length - 1].content;

    // Extract image
    const imgMatch = lastMessage.match(/!\[.*?\]\((https:\/\/images\.unsplash\.com.*?)\)/);
    if (imgMatch) {
      setRecipeImage(imgMatch[1]);
    } else {
      setRecipeImage(null);
    }

    // Extract name
    const nameMatch = lastMessage.match(/🍽️\s*([^\n]+)/);
    if (nameMatch) {
      setRecipeName(nameMatch[1].replace(/\*/g, '').trim());
    }

    // Extract macros
    const textLower = lastMessage.toLowerCase();
    const extractNum = (regex: RegExp) => {
      const match = textLower.match(regex);
      return match ? parseInt(match[1]) : null;
    };

    const protein = extractNum(/prote[ií]nas?\s*[:\-]?\s*(\d+)\s*g?/);
    const carbs = extractNum(/carbohidratos?\s*[:\-]?\s*(\d+)\s*g?/);
    const fats = extractNum(/grasas?\s*[:\-]?\s*(\d+)\s*g?/);
    const calories = extractNum(/calor[ií]as?\s*[:\-]?\s*(\d+)\s*k?cal/);

    if (protein || carbs || fats || calories) {
      setMacros({
        protein: protein || 0,
        carbs: carbs || 0,
        fats: fats || 0,
        calories: calories || 0
      });
    } else {
      setMacros(null);
    }

    // Auto-extract ingredients for shopping list
    const ingredientSection = lastMessage.match(/ingredientes[:\s]*\n([\s\S]*?)(?=\n(?:preparación|instrucciones|pasos|modo|procedimiento|\*\*|#{1,3}\s))/i);
    if (ingredientSection) {
      const lines = ingredientSection[1].split("\n").filter((l: string) => l.trim().length > 2);
      const items = lines.map((l: string) => ({
        name: l.replace(/^[\s\-•*\d.]+/, "").trim(),
        checked: false,
      })).filter((item: { name: string }) => item.name.length > 1);
      if (items.length > 0) setShoppingList(items);
    }
  }, [messages]);

  const toggleShoppingItem = (idx: number) => {
    setShoppingList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item))
    );
  };

  const assignMealToDay = (day: string) => {
    if (recipeName && recipeName !== "Esperando receta...") {
      setMealPlan((prev) => ({ ...prev, [day]: recipeName }));
    }
  };

  const totalMacros = macros ? (macros.protein + macros.carbs + macros.fats) || 1 : 1;
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: "macros", label: "Macros", icon: <Flame className="w-3.5 h-3.5" /> },
    { id: "shopping", label: "Compras", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
    { id: "planner", label: "Semana", icon: <CalendarDays className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-[#050505] border-l border-white/5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white leading-none">Chef Panel</h2>
            <p className="text-[11px] text-gray-500 mt-1">Nutrición & planificación</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex bg-black/40 mx-4 mt-3 rounded-xl p-1 border border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
        <AnimatePresence mode="wait">
          {/* ── MACROS TAB ── */}
          {activeTab === "macros" && (
            <motion.div key="macros" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              {recipeImage && (
                <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  <img src={recipeImage} alt="Recipe" className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-4 right-4 z-20">
                    <h3 className="text-lg font-bold text-white leading-tight">{recipeName}</h3>
                  </div>
                </div>
              )}

              {macros ? (
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2 text-orange-400">
                      <Flame className="w-5 h-5" />
                      <span className="font-bold text-sm">Calorías</span>
                    </div>
                    <span className="text-2xl font-black text-white">{macros.calories > 0 ? macros.calories : "---"} <span className="text-sm font-normal text-gray-500">kcal</span></span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "Proteína", value: macros.protein, color: "rose" },
                      { label: "Carbohidratos", value: macros.carbs, color: "blue" },
                      { label: "Grasas", value: macros.fats, color: "yellow" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className={`text-${color}-400 font-medium`}>{label}</span>
                          <span className="text-white font-bold">{value}g</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(value / totalMacros) * 100}%` }}
                            className={`h-full bg-${color}-500 rounded-full`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                  <Utensils className="w-10 h-10 opacity-30 mb-4" />
                  <p className="text-sm">Pídele al Chef una receta para ver los macros</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SHOPPING LIST TAB ── */}
          {activeTab === "shopping" && (
            <motion.div key="shopping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {shoppingList.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Lista de Compras</p>
                    <span className="text-xs text-orange-400 font-bold">{checkedCount}/{shoppingList.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${(checkedCount / shoppingList.length) * 100}%` }}
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    {shoppingList.map((item, i) => (
                      <motion.button
                        key={i}
                        onClick={() => toggleShoppingItem(i)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                          item.checked
                            ? "bg-emerald-500/10 border-emerald-500/20 text-gray-500"
                            : "bg-white/[0.02] border-white/5 hover:border-orange-500/30 text-gray-300"
                        }`}
                      >
                        {item.checked ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                        )}
                        <span className={`text-sm ${item.checked ? "line-through" : ""}`}>{item.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                  <ShoppingCart className="w-10 h-10 opacity-30 mb-4" />
                  <p className="text-sm">Cuando el Chef genere una receta, los ingredientes aparecerán aquí como lista de compras</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── MEAL PLANNER TAB ── */}
          {activeTab === "planner" && (
            <motion.div key="planner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Planificador Semanal</p>
              {DAYS.map((day) => (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedDay(expandedDay === day ? null : day)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center text-xs font-bold border border-orange-500/20">
                        {day.slice(0, 2)}
                      </span>
                      <span className="text-sm text-gray-300">{mealPlan[day] || "Sin asignar"}</span>
                    </div>
                    {expandedDay === day ? (
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedDay === day && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3">
                          <button
                            onClick={() => assignMealToDay(day)}
                            disabled={!recipeName || recipeName === "Esperando receta..."}
                            className="w-full py-2 text-xs font-semibold rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors border border-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {recipeName && recipeName !== "Esperando receta..."
                              ? `Asignar "${recipeName}"`
                              : "Genera una receta primero"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
