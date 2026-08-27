import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

export const PanelToolSchemas = {
  read_professor_panel: z.object({}),
  add_professor_formula: z.object({ formula: z.string().min(1) }),
  add_professor_outline_item: z.object({ item: z.string().min(1) }),
  set_professor_document: z.object({ title: z.string().min(1), documentId: z.string().optional() }),
  read_counselor_panel: z.object({}),
  add_counselor_goal: z.object({ text: z.string().min(1) }),
  toggle_counselor_goal: z.object({ text: z.string().min(1), done: z.boolean().optional() }),
  set_counselor_mood: z.object({ mood: z.enum(["happy", "neutral", "sad"]), note: z.string().optional() }),
  save_counselor_journal: z.object({ entry: z.string().min(1) }),
  read_nutrition_panel: z.object({}),
  set_nutrition_macros: z.object({ protein: z.number().min(0), carbs: z.number().min(0), fats: z.number().min(0), calories: z.number().min(0) }),
  add_shopping_item: z.object({ name: z.string().min(1) }),
  schedule_meal: z.object({ day: z.enum(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]), meal: z.string().min(1) }),
  set_recipe_panel: z.object({ name: z.string().min(1), imageUrl: z.string().url().optional() }),
} as const;

export type PanelToolName = keyof typeof PanelToolSchemas;
export function isPanelTool(name: string): name is PanelToolName {
  return Object.prototype.hasOwnProperty.call(PanelToolSchemas, name);
}

export function getPanelToolPrompt(): string {
  return `\n\n═══════════════════════════════════════════════════\n🧩 PANELES INTERACTIVOS REALES\n═══════════════════════════════════════════════════\nUsa estas herramientas cuando la petición tenga que leer o modificar los paneles del usuario. Son herramientas reales y sus cambios se guardan en la sesión. No describas una acción como realizada si la herramienta no se ejecutó.\n\nPROFESOR IA:\nread_professor_panel {}\nadd_professor_formula {"formula":"..."}\nadd_professor_outline_item {"item":"..."}\nset_professor_document {"title":"...","documentId":"opcional"}\n\nCONSEJERO:\nread_counselor_panel {}\nadd_counselor_goal {"text":"..."}\ntoggle_counselor_goal {"text":"...","done":true|false}\nset_counselor_mood {"mood":"happy|neutral|sad","note":"opcional"}\nsave_counselor_journal {"entry":"..."}\n\nNUTRIRECETAS:\nread_nutrition_panel {}\nset_nutrition_macros {"protein":0,"carbs":0,"fats":0,"calories":0}\nadd_shopping_item {"name":"..."}\nschedule_meal {"day":"Lun|Mar|Mié|Jue|Vie|Sáb|Dom","meal":"..."}\nset_recipe_panel {"name":"...","imageUrl":"opcional"}\n\nEstas llamadas son internas y estructuradas. Nunca escribas JSON de tools en la respuesta final al estudiante.`;
}

async function getOwnedSession(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { data: session, error } = await supabase.from("ai_sessions").select("id, user_id, environment_state").eq("id", sessionId).eq("user_id", user.id).single();
  if (error || !session) throw new Error("Sesión no encontrada o no autorizada.");
  return { supabase, user, session };
}
function mergeState(base: any, patch: any) { return { ...(base && typeof base === "object" ? base : {}), ...patch }; }

export async function executePanelTool(tool: PanelToolName, args: Record<string, any>, userId: string, sessionId?: string | null) {
  if (!sessionId) return { success: false, displayMessage: "No hay una sesión activa para actualizar el panel." };
  const { supabase, user, session } = await getOwnedSession(sessionId);
  if (user.id !== userId) return { success: false, displayMessage: "Sesión no autorizada." };
  const state = session.environment_state && typeof session.environment_state === "object" ? session.environment_state : {};
  const save = async (nextState: any, displayMessage: string, data?: any) => {
    const { error } = await supabase.from("ai_sessions").update({ environment_state: nextState }).eq("id", sessionId).eq("user_id", userId);
    if (error) throw error;
    return { success: true, displayMessage, data };
  };
  switch (tool) {
    case "read_professor_panel": return { success: true, displayMessage: "Panel del Profesor consultado.", data: { formulas: state.formulas || [], outlineItems: state.outlineItems || [], document: state.document || null } };
    case "add_professor_formula": { const formulas = Array.isArray(state.formulas) ? state.formulas : []; if (formulas.includes(args.formula)) return { success: true, displayMessage: "La fórmula ya estaba en el panel.", data: { formulas } }; const next = [...formulas, args.formula]; return save(mergeState(state, { formulas: next }), "✅ Fórmula agregada al panel Fórmulas.", { formulas: next }); }
    case "add_professor_outline_item": { const items = Array.isArray(state.outlineItems) ? state.outlineItems : []; if (items.includes(args.item)) return { success: true, displayMessage: "Ese punto ya estaba en el esquema.", data: { outlineItems: items } }; const next = [...items, args.item]; return save(mergeState(state, { outlineItems: next }), "✅ Punto agregado al esquema del Profesor.", { outlineItems: next }); }
    case "set_professor_document": { const document = { id: args.documentId || null, title: args.title }; return save(mergeState(state, { document }), `✅ Documento "${args.title}" vinculado a Docs.`, { document }); }
    case "read_counselor_panel": return { success: true, displayMessage: "Panel del Consejero consultado.", data: { goals: state.counselorGoals || [], mood: state.counselorMood || null, journal: state.counselorJournal || [] } };
    case "add_counselor_goal": { const goals = Array.isArray(state.counselorGoals) ? state.counselorGoals : []; if (goals.some((g: any) => String(g.text || "").toLowerCase() === args.text.toLowerCase())) return { success: true, displayMessage: "Ese objetivo ya existe.", data: { goals } }; const id = goals.reduce((m: number, g: any) => Math.max(m, Number(g.id) || 0), 0) + 1; const next = [...goals, { id, text: args.text, done: false }]; return save(mergeState(state, { counselorGoals: next }), `✅ Objetivo "${args.text}" agregado.`, { goals: next }); }
    case "toggle_counselor_goal": { const goals = Array.isArray(state.counselorGoals) ? state.counselorGoals : []; const index = goals.findIndex((g: any) => String(g.text || "").toLowerCase() === args.text.toLowerCase()); if (index < 0) return { success: false, displayMessage: `No encontré el objetivo "${args.text}".` }; const next = goals.map((g: any, i: number) => i === index ? { ...g, done: args.done ?? !g.done } : g); return save(mergeState(state, { counselorGoals: next }), `✅ Objetivo "${args.text}" actualizado.`, { goals: next }); }
    case "set_counselor_mood": { const mood = { id: args.mood, note: args.note || "", updatedAt: new Date().toISOString() }; return save(mergeState(state, { counselorMood: mood }), "✅ Tracker de Ánimo actualizado.", { mood }); }
    case "save_counselor_journal": { const journal = Array.isArray(state.counselorJournal) ? state.counselorJournal : []; const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: args.entry, createdAt: new Date().toISOString() }; const next = [...journal, entry].slice(-100); return save(mergeState(state, { counselorJournal: next }), "✅ Entrada guardada en tu Diario Emocional.", { journal: next }); }
    case "read_nutrition_panel": return { success: true, displayMessage: "Panel de Nutrirecetas consultado.", data: { recipe: state.nutritionRecipe || null, macros: state.nutritionMacros || null, shoppingList: state.nutritionShoppingList || [], mealPlan: state.nutritionMealPlan || {} } };
    case "set_nutrition_macros": { const macros = { protein: args.protein, carbs: args.carbs, fats: args.fats, calories: args.calories }; return save(mergeState(state, { nutritionMacros: macros }), "✅ Macros actualizados.", { macros }); }
    case "add_shopping_item": { const list = Array.isArray(state.nutritionShoppingList) ? state.nutritionShoppingList : []; if (list.some((x: any) => String(x.name || "").toLowerCase() === args.name.toLowerCase())) return { success: true, displayMessage: "Ese ingrediente ya está en Compras.", data: { shoppingList: list } }; const next = [...list, { name: args.name, checked: false }]; return save(mergeState(state, { nutritionShoppingList: next }), `✅ "${args.name}" agregado a Compras.`, { shoppingList: next }); }
    case "schedule_meal": { const next = { ...(state.nutritionMealPlan || {}), [args.day]: args.meal }; return save(mergeState(state, { nutritionMealPlan: next }), `✅ "${args.meal}" programado para ${args.day}.`, { mealPlan: next }); }
    case "set_recipe_panel": { const recipe = { name: args.name, imageUrl: args.imageUrl || null }; return save(mergeState(state, { nutritionRecipe: recipe }), `✅ Receta "${args.name}" guardada en Nutrirecetas.`, { recipe }); }
  }
}
