import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

async function authContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

export const panelTools = [
  {
    name: "read_professor_graph",
    description: "Lee el Grafo de Conocimiento real del usuario para el panel Profesor IA.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ limit: z.number().int().min(1).max(200).default(100) }),
    execute: async ({ limit }: { limit: number }) => {
      const { supabase, user } = await authContext();
      const [{ data: nodes, error: nError }, { data: edges, error: eError }] = await Promise.all([
        supabase.from("knowledge_nodes").select("id,title,description,confidence_level,source_type,created_at,last_reviewed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
        supabase.from("knowledge_edges").select("*").eq("user_id", user.id).limit(limit * 2),
      ]);
      if (nError) throw nError;
      if (eError) throw eError;
      return { success: true, message: `Grafo: ${nodes?.length || 0} conceptos y ${edges?.length || 0} relaciones reales.`, data: { nodes: nodes || [], edges: edges || [] } };
    },
  },
  {
    name: "read_professor_docs",
    description: "Lee los documentos indexados reales del usuario para el panel Docs de Profesor IA.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({}),
    execute: async () => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("ai_documents").select("id,title,source_url,mime_type,status,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200);
      if (error) throw error;
      return { success: true, message: `${data?.length || 0} documentos reales disponibles.`, data: { documents: data || [] } };
    },
  },
  {
    name: "add_advisor_goal",
    description: "Añade un objetivo real al panel Objetivos de Hoy de Consejero.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ title: z.string().min(1).max(300) }),
    execute: async ({ title }: { title: string }) => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("advisor_goals").insert({ user_id: user.id, title, completed: false }).select("id,title,completed,created_at,updated_at").single();
      if (error) throw error;
      return { success: true, message: "Objetivo añadido al panel real.", data };
    },
  },
  {
    name: "complete_advisor_goal",
    description: "Marca un objetivo real del panel Consejero como completado.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ goal_id: z.string().uuid(), completed: z.boolean().default(true) }),
    execute: async ({ goal_id, completed }: { goal_id: string; completed: boolean }) => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("advisor_goals").update({ completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", goal_id).eq("user_id", user.id).select("id,title,completed,completed_at,updated_at").single();
      if (error || !data) throw error || new Error("Objetivo no encontrado.");
      return { success: true, message: completed ? "Objetivo completado en el panel." : "Objetivo reabierto en el panel.", data };
    },
  },
  {
    name: "log_advisor_mood",
    description: "Registra un estado de ánimo real en el Tracker de Ánimo.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ mood: z.string().min(1).max(80), note: z.string().max(1000).optional() }),
    execute: async ({ mood, note }: { mood: string; note?: string }) => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("advisor_mood_entries").insert({ user_id: user.id, mood, note: note || null }).select("id,mood,note,created_at").single();
      if (error) throw error;
      return { success: true, message: "Estado de ánimo guardado en el tracker real.", data };
    },
  },
  {
    name: "add_advisor_journal_entry",
    description: "Guarda una entrada real en el Diario Emocional.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ content: z.string().min(1).max(10000) }),
    execute: async ({ content }: { content: string }) => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("advisor_journal_entries").insert({ user_id: user.id, content }).select("id,content,created_at,updated_at").single();
      if (error) throw error;
      return { success: true, message: "Entrada guardada en el diario real.", data };
    },
  },
  {
    name: "save_nutrition_recipe",
    description: "Guarda una receta real en el panel de Nutrirecetas.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ name: z.string().min(1).max(200), description: z.string().max(2000).optional(), ingredients: z.any(), macros: z.any().optional() }),
    execute: async ({ name, description, ingredients, macros }: { name: string; description?: string; ingredients: unknown; macros?: unknown }) => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("nutrition_recipes").insert({ user_id: user.id, name, description: description || null, ingredients, macros: macros || null }).select("id,name,description,ingredients,macros,created_at,updated_at").single();
      if (error) throw error;
      return { success: true, message: "Receta guardada en Nutrirecetas.", data };
    },
  },
  {
    name: "add_nutrition_shopping_item",
    description: "Añade un producto real a la lista Compras de Nutrirecetas.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ name: z.string().min(1).max(200), quantity: z.string().optional(), unit: z.string().optional() }),
    execute: async ({ name, quantity, unit }: { name: string; quantity?: string; unit?: string }) => {
      const { supabase, user } = await authContext();
      const { data, error } = await supabase.from("nutrition_shopping_items").insert({ user_id: user.id, name, quantity: quantity || null, unit: unit || null, checked: false }).select("id,name,quantity,unit,checked,created_at,updated_at").single();
      if (error) throw error;
      return { success: true, message: "Producto añadido a Compras.", data };
    },
  },
  {
    name: "set_nutrition_week_plan",
    description: "Configura una entrada real del plan semanal de Nutrirecetas.",
    requiresConfirmation: false,
    externalEffect: false,
    schema: z.object({ weekday: z.number().int().min(0).max(6), recipe_id: z.string().uuid().optional(), recipe_name: z.string().max(200).optional() }),
    execute: async ({ weekday, recipe_id, recipe_name }: { weekday: number; recipe_id?: string; recipe_name?: string }) => {
      const { supabase, user } = await authContext();
      const payload = { user_id: user.id, weekday, recipe_id: recipe_id || null, recipe_name: recipe_name || null, updated_at: new Date().toISOString() };
      const existing = await supabase.from("nutrition_week_plan").select("id").eq("user_id", user.id).eq("weekday", weekday).maybeSingle();
      if (existing.error) throw existing.error;
      const result = existing.data?.id
        ? await supabase.from("nutrition_week_plan").update(payload).eq("id", existing.data.id).eq("user_id", user.id).select("id,user_id,weekday,recipe_id,recipe_name,updated_at").single()
        : await supabase.from("nutrition_week_plan").insert(payload).select("id,user_id,weekday,recipe_id,recipe_name,updated_at").single();
      if (result.error) throw result.error;
      return { success: true, message: "Plan semanal actualizado en la base real.", data: result.data };
    },
  },
];
