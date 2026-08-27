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

async function getOwnedSession(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { data: session, error } = await supabase
    .from("ai_sessions")
    .select("id, user_id, environment_state")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (error || !session) throw new Error("Sesión no encontrada o no autorizada.");
  return { supabase, user, session };
}

function mergeState(base: any, patch: any) {
  return { ...(base && typeof base === "object" ? base : {}), ...patch };
}

export async function executePanelTool(
  tool: PanelToolName,
  args: Record<string, any>,
  userId: string,
  sessionId?: string | null,
) {
  if (!sessionId) {
    return { success: false, displayMessage: "No hay una sesión activa para actualizar el panel." };
  }

  const { supabase, user, session } = await getOwnedSession(sessionId);
  if (user.id !== userId) return { success: false, displayMessage: "Sesión no autorizada." };

  const state = session.environment_state && typeof session.environment_state === "object"
    ? session.environment_state
    : {};

  switch (tool) {
    case "read_professor_panel":
      return {
        success: true,
        displayMessage: "Panel del Profesor consultado.",
        data: {
          formulas: Array.isArray(state.formulas) ? state.formulas : [],
          outlineItems: Array.isArray(state.outlineItems) ? state.outlineItems : [],
          document: state.document || null,
        },
      };

    case "add_professor_formula": {
      const formulas = Array.isArray(state.formulas) ? state.formulas : [];
      if (formulas.includes(args.formula)) return { success: true, displayMessage: "La fórmula ya estaba en el panel.", data: { formulas } };
      const next = [...formulas, args.formula];
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { formulas: next }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: "✅ Fórmula agregada al panel Fórmulas.", data: { formulas: next } };
    }

    case "add_professor_outline_item": {
      const items = Array.isArray(state.outlineItems) ? state.outlineItems : [];
      if (items.includes(args.item)) return { success: true, displayMessage: "Ese punto ya está en el esquema.", data: { outlineItems: items } };
      const next = [...items, args.item];
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { outlineItems: next }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: "✅ Punto agregado al esquema del Profesor.", data: { outlineItems: next } };
    }

    case "set_professor_document": {
      const document = { id: args.documentId || null, title: args.title };
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { document }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: `✅ Documento "${args.title}" vinculado al panel Docs.`, data: { document } };
    }

    case "read_counselor_panel":
      return {
        success: true,
        displayMessage: "Panel del Consejero consultado.",
        data: {
          goals: Array.isArray(state.counselorGoals) ? state.counselorGoals : [],
          mood: state.counselorMood || null,
          journal: Array.isArray(state.counselorJournal) ? state.counselorJournal : [],
        },
      };

    case "add_counselor_goal": {
      const goals = Array.isArray(state.counselorGoals) ? state.counselorGoals : [];
      const nextId = goals.reduce((max: number, g: any) => Math.max(max, Number(g?.id) || 0), 0) + 1;
      const goal = { id: nextId, text: args.text, done: false };
      const next = [...goals, goal];
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { counselorGoals: next }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: `✅ Objetivo "${args.text}" agregado.`, data: { goals: next } };
    }

    case "toggle_counselor_goal": {
      const goals = Array.isArray(state.counselorGoals) ? state.counselorGoals : [];
      const index = goals.findIndex((g: any) => String(g?.text || "").toLowerCase() === args.text.toLowerCase());
      if (index < 0) return { success: false, displayMessage: `No encontré el objetivo "${args.text}".` };
      const next = goals.map((g: any, i: number) => i === index ? { ...g, done: args.done ?? !g.done } : g);
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { counselorGoals: next }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: `✅ Objetivo "${args.text}" actualizado.`, data: { goals: next } };
    }

    case "set_counselor_mood": {
      const mood = { id: args.mood, note: args.note || "", updatedAt: new Date().toISOString() };
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { counselorMood: mood }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: "✅ Tracker de Ánimo actualizado.", data: { mood } };
    }

    case "save_counselor_journal": {
      const journal = Array.isArray(state.counselorJournal) ? state.counselorJournal : [];
      const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: args.entry, createdAt: new Date().toISOString() };
      const next = [...journal, entry].slice(-100);
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { counselorJournal: next }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: "✅ Entrada guardada en tu Diario Emocional.", data: { journal: next } };
    }

    case "read_nutrition_panel":
      return {
        success: true,
        displayMessage: "Panel de Nutrirecetas consultado.",
        data: {
          recipe: state.nutritionRecipe || null,
          macros: state.nutritionMacros || null,
          shoppingList: Array.isArray(state.nutritionShoppingList) ? state.nutritionShoppingList : [],
          mealPlan: state.nutritionMealPlan || {},
        },
      };

    case "set_nutrition_macros": {
      const macros = { protein: args.protein, carbs: args.carbs, fats: args.fats, calories: args.calories };
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { nutritionMacros: macros }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: "✅ Macros actualizados.", data: { macros } };
    }

    case "add_shopping_item": {
      const shoppingList = Array.isArray(state.nutritionShoppingList) ? state.nutritionShoppingList : [];
      if (shoppingList.some((item: any) => String(item?.name || "").toLowerCase() === args.name.toLowerCase())) {
        return { success: true, displayMessage: "Ese ingrediente ya está en Compras.", data: { shoppingList } };
      }
      const next = [...shoppingList, { name: args.name, checked: false }];
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { nutritionShoppingList: next }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: `✅ "${args.name}" agregado a Compras.`, data: { shoppingList: next } };
    }

    case "schedule_meal": {
      const mealPlan = { ...(state.nutritionMealPlan || {}), [args.day]: args.meal };
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { nutritionMealPlan: mealPlan }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: `✅ "${args.meal}" programado para ${args.day}.`, data: { mealPlan } };
    }

    case "set_recipe_panel": {
      const recipe = { name: args.name, imageUrl: args.imageUrl || null };
      const { error } = await supabase.from("ai_sessions").update({ environment_state: mergeState(state, { nutritionRecipe: recipe }) }).eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
      return { success: true, displayMessage: `✅ Receta "${args.name}" guardada en el panel.`, data: { recipe } };
    }
  }
}
