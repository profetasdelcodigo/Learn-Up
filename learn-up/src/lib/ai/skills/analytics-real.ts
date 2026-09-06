import { z } from "zod";
import type { Skill, ToolDefinition } from "../ai/core/types";
import { createClient } from "@/utils/supabase/server";
import { getAICompletion } from "@/lib/ai";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[\",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function countRows(supabase: any, table: string, userId: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  return count || 0;
}

export const viewStudyStatsReal: ToolDefinition = {
  id: "view_study_stats", category: "analytics", description: "Estadísticas reales de uso académico disponibles en Learn Up.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const [sessions, messages, documents, nodes, habits] = await Promise.all([
      countRows(supabase, "ai_sessions", user.id),
      countRows(supabase, "ai_messages", user.id),
      countRows(supabase, "ai_documents", user.id),
      countRows(supabase, "knowledge_nodes", user.id),
      countRows(supabase, "habits", user.id),
    ]);
    return { success: true, message: "Estadísticas obtenidas de los datos reales del usuario.", data: { sessions, messages, documents, knowledge_nodes: nodes, active_habits: habits } };
  },
};

export const generateWeeklyReportReal: ToolDefinition = {
  id: "generate_weekly_report", category: "analytics", description: "Genera un reporte semanal basado exclusivamente en actividad real del usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [messages, sessions, completions] = await Promise.all([
      supabase.from("ai_messages").select("id,created_at,role").eq("role", "user").eq("session_id", supabase.from ? undefined : undefined),
      supabase.from("ai_sessions").select("id,ai_type,title,created_at,updated_at").eq("user_id", user.id).gte("updated_at", since).order("updated_at", { ascending: false }).limit(100),
      supabase.from("habit_completions").select("id,completed_date,created_at").eq("user_id", user.id).gte("created_at", since).limit(500),
    ]);
    const userMessageQuery = await supabase.from("ai_messages").select("id,created_at").eq("role", "user").gte("created_at", since).in("session_id", (sessions.data || []).map((s: any) => s.id).length ? (sessions.data || []).map((s: any) => s.id) : ["00000000-0000-0000-0000-000000000000"]);
    if (userMessageQuery.error) throw userMessageQuery.error;
    if (sessions.error) throw sessions.error;
    if (completions.error) throw completions.error;
    const stats = { period_days: 7, sessions_updated: sessions.data?.length || 0, user_messages: userMessageQuery.data?.length || 0, habit_completions: completions.data?.length || 0 };
    const completion = await getAICompletion([{ role: "user", content: `Resume estas estadísticas reales de Learn Up en un breve reporte semanal para un estudiante. No inventes métricas ni conclusiones no sustentadas. Datos: ${JSON.stringify(stats)}` }], "gemini-3.8-flash");
    const report = completion?.choices?.[0]?.message?.content || "";
    if (!report.trim()) return { success: false, error: "No se pudo generar el reporte a partir de los datos reales." };
    return { success: true, message: "Reporte semanal generado con actividad real.", data: { stats, report } };
  },
};

export const viewExamHistoryReal: ToolDefinition = {
  id: "view_exam_history", category: "analytics", description: "Consulta sesiones de examen realmente registradas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ limit: z.number().int().min(1).max(100).default(20) }),
  execute: async ({ limit }) => {
    const { supabase, user } = await currentUser();
    const { data, error } = await supabase.from("ai_sessions").select("id,title,created_at,updated_at").eq("user_id", user.id).eq("ai_type", "exam").order("updated_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return { success: true, message: `Se encontraron ${data?.length || 0} sesiones de examen reales.`, data: { exams: data || [] } };
  },
};

export const analyzeStrengthsWeaknessesReal: ToolDefinition = {
  id: "analyze_strengths_weaknesses", category: "analytics", description: "Analiza señales académicas reales disponibles en el historial y grafo.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const [nodes, exams] = await Promise.all([
      supabase.from("knowledge_nodes").select("title,confidence_level,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200),
      supabase.from("ai_sessions").select("title,updated_at").eq("user_id", user.id).eq("ai_type", "exam").order("updated_at", { ascending: false }).limit(100),
    ]);
    if (nodes.error) throw nodes.error;
    if (exams.error) throw exams.error;
    const strong = (nodes.data || []).filter((n: any) => typeof n.confidence_level === "number" && n.confidence_level >= 80).slice(0, 20);
    const weak = (nodes.data || []).filter((n: any) => typeof n.confidence_level === "number" && n.confidence_level < 60).slice(0, 20);
    if (!strong.length && !weak.length) return { success: false, error: "No hay suficiente información real en el grafo para determinar fortalezas o debilidades." };
    return { success: true, message: "Análisis basado en datos reales del grafo de conocimiento.", data: { strengths: strong, weaknesses: weak, exam_sessions: exams.data || [] } };
  },
};

export const viewHabitStreaksReal: ToolDefinition = {
  id: "view_habit_streaks", category: "analytics", description: "Calcula rachas a partir de completaciones reales de hábitos.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const { data: habits, error: habitError } = await supabase.from("habits").select("id,title,streak,completed_dates,is_active").eq("user_id", user.id).eq("is_active", true).order("updated_at", { ascending: false });
    if (habitError) throw habitError;
    const results = (habits || []).map((h: any) => ({ id: h.id, habit: h.title, current_streak: typeof h.streak === "number" ? h.streak : 0, completed_dates: h.completed_dates || [] }));
    return { success: true, message: `${results.length} hábitos activos consultados.`, data: { habits: results } };
  },
};

export const detectProcrastinationReal: ToolDefinition = {
  id: "detect_procrastination", category: "analytics", description: "Compara actividad real reciente con el periodo anterior; no inventa un diagnóstico.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const now = Date.now(); const startRecent = new Date(now - 7 * 86400000).toISOString(); const startPrevious = new Date(now - 14 * 86400000).toISOString();
    const [{ count: recent }, { count: previous }] = await Promise.all([
      supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", startRecent),
      supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", startPrevious).lt("created_at", startRecent),
    ]);
    const r = recent || 0; const p = previous || 0;
    return { success: true, message: "Actividad reciente comparada con el periodo anterior.", data: { recent_user_messages: r, previous_user_messages: p, change_ratio: p ? Number(((r - p) / p).toFixed(3)) : null, interpretation: p === 0 ? "No hay periodo anterior suficiente para comparar." : r < p ? "La actividad reciente es menor que la del periodo anterior." : "La actividad reciente no es menor que la del periodo anterior." } };
  },
};

export const generateAcademicDashboardReal: ToolDefinition = {
  id: "generate_academic_dashboard", category: "analytics", description: "Construye un resumen académico con métricas reales disponibles.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const [sessions, docs, nodes, habits, messages] = await Promise.all([
      countRows(supabase, "ai_sessions", user.id), countRows(supabase, "ai_documents", user.id), countRows(supabase, "knowledge_nodes", user.id), countRows(supabase, "habits", user.id), countRows(supabase, "ai_messages", user.id),
    ]);
    return { success: true, message: "Dashboard académico calculado desde datos reales.", data: { sessions, documents: docs, concepts: nodes, active_habits: habits, messages } };
  },
};

export const viewActivityHeatmapReal: ToolDefinition = {
  id: "view_activity_heatmap", category: "analytics", description: "Actividad diaria real del usuario para los últimos 30 días.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(7).max(90).default(30) }),
  execute: async ({ days }) => {
    const { supabase, user } = await currentUser();
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase.from("ai_messages").select("created_at").eq("role", "user").eq("session_id", supabase.from ? undefined : undefined).gte("created_at", since);
    const fallback = error ? await supabase.from("ai_messages").select("created_at,session_id").gte("created_at", since).in("session_id", (await supabase.from("ai_sessions").select("id").eq("user_id", user.id)).data?.map((s:any)=>s.id) || ["00000000-0000-0000-0000-000000000000"]) : { data, error };
    if (fallback.error) throw fallback.error;
    const counts: Record<string, number> = {};
    for (const row of (fallback.data || [])) { const day = String(row.created_at).slice(0, 10); counts[day] = (counts[day] || 0) + 1; }
    return { success: true, message: "Mapa de actividad construido desde mensajes reales.", data: { days, counts } };
  },
};

export const analyzeTimeDistributionReal: ToolDefinition = {
  id: "analyze_time_distribution", category: "analytics", description: "Analiza distribución de mensajes por tipo de IA cuando no existen tiempos de estudio instrumentados.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const { data, error } = await supabase.from("ai_sessions").select("ai_type").eq("user_id", user.id).limit(500);
    if (error) throw error;
    const byType: Record<string, number> = {}; for (const row of data || []) byType[row.ai_type] = (byType[row.ai_type] || 0) + 1;
    return { success: false, error: "Learn Up no almacena actualmente minutos de estudio por materia en una columna fiable; no se puede fabricar una distribución de tiempo.", data: { session_distribution_by_ai_type: byType } };
  },
};

export const predictExamScoreReal: ToolDefinition = {
  id: "predict_exam_score", category: "analytics", description: "Predice una nota solo cuando existen suficientes resultados de examen reales con calificaciones registradas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ exam_id: z.string().min(1) }),
  execute: async ({ exam_id }) => {
    const { supabase, user } = await currentUser();
    const { data: session } = await supabase.from("ai_sessions").select("id,title").eq("id", exam_id).eq("user_id", user.id).eq("ai_type", "exam").maybeSingle();
    if (!session) return { success: false, error: "No se encontró el examen indicado." };
    const { data: exams } = await supabase.from("ai_sessions").select("title,updated_at").eq("user_id", user.id).eq("ai_type", "exam").limit(200);
    const scores = (exams || []).map((e:any) => { const m = String(e.title || "").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i); return m ? Number(m[1]) : null; }).filter((x:any) => typeof x === "number" && Number.isFinite(x));
    if (scores.length < 2) return { success: false, error: "No hay al menos dos calificaciones reales registradas para hacer una predicción responsable." };
    const predicted = Number((scores.reduce((a:number,b:number)=>a+b,0)/scores.length).toFixed(2));
    return { success: true, message: "Predicción calculada a partir de calificaciones registradas.", data: { exam_id, predicted_score: predicted, sample_size: scores.length } };
  },
};

export const calculateGpaReal: ToolDefinition = {
  id: "calculate_gpa", category: "analytics", description: "Calcula GPA solo si existen calificaciones académicas estructuradas almacenadas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => ({ success: false, error: "No existe una tabla fiable de calificaciones por curso en el esquema actual de Learn Up; no se puede inventar un GPA." }),
};

export const exportStatsCsvReal: ToolDefinition = {
  id: "export_stats_csv", category: "analytics", description: "Exporta actividad real de aprendizaje a CSV.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
  execute: async ({ days }) => {
    const { supabase, user } = await currentUser();
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase.from("ai_messages").select("created_at,role,session_id").eq("role", "user").gte("created_at", since).order("created_at", { ascending: true }).limit(5000);
    if (error) throw error;
    const rows = ["date,session_id,role", ...(data || []).map((r:any)=>[csvEscape(String(r.created_at).slice(0,10)),csvEscape(r.session_id),csvEscape(r.role)].join(","))];
    return { success: true, message: "CSV generado con actividad real.", data: { csv: rows.join("\n"), rows: data?.length || 0, days } };
  },
};

export const generateCustomChartReal: ToolDefinition = {
  id: "generate_custom_chart", category: "analytics", description: "Genera una especificación de gráfico a partir de los datos entregados por el usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ data: z.string().min(1), type: z.enum(["bar", "pie", "line"]).default("bar") }),
  execute: async ({ data, type }) => ({ success: true, message: "Especificación de gráfico generada desde los datos proporcionados.", data: { chartType: type, source: data } }),
};

export const viewLearningVelocityReal: ToolDefinition = {
  id: "view_learning_velocity", category: "analytics", description: "Compara volumen real de mensajes del usuario entre dos periodos de siete días.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const now = Date.now(); const recentStart = new Date(now - 7*86400000).toISOString(); const previousStart = new Date(now - 14*86400000).toISOString();
    const [{ count: recent }, { count: previous }] = await Promise.all([
      supabase.from("ai_messages").select("id", {count:"exact",head:true}).eq("role","user").gte("created_at",recentStart).in("session_id", (await supabase.from("ai_sessions").select("id").eq("user_id",user.id)).data?.map((s:any)=>s.id) || ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("ai_messages").select("id", {count:"exact",head:true}).eq("role","user").gte("created_at",previousStart).lt("created_at",recentStart).in("session_id", (await supabase.from("ai_sessions").select("id").eq("user_id",user.id)).data?.map((s:any)=>s.id) || ["00000000-0000-0000-0000-000000000000"]),
    ]);
    return { success: true, message: "Velocidad de aprendizaje aproximada a partir de actividad real.", data: { recent_user_messages: recent || 0, previous_user_messages: previous || 0, comparison: (recent || 0) - (previous || 0) } };
  },
};

const overrides: Record<string, ToolDefinition> = {
  view_study_stats: viewStudyStatsReal,
  generate_weekly_report: generateWeeklyReportReal,
  view_exam_history: viewExamHistoryReal,
  analyze_strengths_weaknesses: analyzeStrengthsWeaknessesReal,
  view_habit_streaks: viewHabitStreaksReal,
  detect_procrastination: detectProcrastinationReal,
  generate_academic_dashboard: generateAcademicDashboardReal,
  view_activity_heatmap: viewActivityHeatmapReal,
  analyze_time_distribution: analyzeTimeDistributionReal,
  predict_exam_score: predictExamScoreReal,
  calculate_gpa: calculateGpaReal,
  export_stats_csv: exportStatsCsvReal,
  generate_custom_chart: generateCustomChartReal,
  view_learning_velocity: viewLearningVelocityReal,
};

export function withRealAnalyticsOverrides(skill: Skill): Skill {
  return { ...skill, tools: skill.tools.map((tool) => overrides[tool.id] || tool) };
}
