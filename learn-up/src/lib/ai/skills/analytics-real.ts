import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { getAICompletion } from "@/lib/ai";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

async function sessionIds(supabase: any, userId: string) {
  const { data, error } = await supabase.from("ai_sessions").select("id").eq("user_id", userId).limit(1000);
  if (error) throw error;
  return (data || []).map((row: any) => row.id);
}

async function countRows(supabase: any, table: string, userId: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  return count || 0;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[\",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const viewStudyStatsReal: ToolDefinition = {
  id: "view_study_stats", category: "analytics", description: "Consulta estadísticas reales disponibles del usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
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
    return { success: true, message: "Estadísticas obtenidas desde datos reales.", data: { sessions, messages, documents, knowledge_nodes: nodes, habits } };
  },
};

export const generateWeeklyReportReal: ToolDefinition = {
  id: "generate_weekly_report", category: "analytics", description: "Genera un reporte semanal usando solo actividad real registrada.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const ids = await sessionIds(supabase, user.id);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [messages, sessions, completions] = await Promise.all([
      ids.length ? supabase.from("ai_messages").select("id,created_at").eq("role", "user").in("session_id", ids).gte("created_at", since) : { data: [], error: null },
      supabase.from("ai_sessions").select("id,ai_type,title,created_at,updated_at").eq("user_id", user.id).gte("updated_at", since).order("updated_at", { ascending: false }).limit(100),
      supabase.from("habit_completions").select("id,completed_date,created_at").eq("user_id", user.id).gte("created_at", since).limit(500),
    ]);
    if (messages.error) throw messages.error;
    if (sessions.error) throw sessions.error;
    if (completions.error) throw completions.error;
    const stats = { period_days: 7, user_messages: messages.data?.length || 0, sessions_updated: sessions.data?.length || 0, habit_completions: completions.data?.length || 0 };
    const response = await getAICompletion([{ role: "user", content: `Escribe un reporte semanal breve y honesto usando solamente estas métricas reales. No inventes otras métricas ni actividad: ${JSON.stringify(stats)}` }], "gemini-3.8-flash");
    const report = response?.choices?.[0]?.message?.content || "";
    if (!report.trim()) return { success: false, error: "No se pudo generar el reporte." };
    return { success: true, message: "Reporte semanal generado con datos reales.", data: { stats, report } };
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
  id: "analyze_strengths_weaknesses", category: "analytics", description: "Analiza únicamente señales reales del grafo de conocimiento.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const { data, error } = await supabase.from("knowledge_nodes").select("id,title,confidence_level,source_type,updated_at").eq("user_id", user.id).order("confidence_level", { ascending: false }).limit(200);
    if (error) throw error;
    const strengths = (data || []).filter((n: any) => typeof n.confidence_level === "number" && n.confidence_level >= 80).slice(0, 20);
    const weaknesses = (data || []).filter((n: any) => typeof n.confidence_level === "number" && n.confidence_level < 60).slice(0, 20);
    if (!strengths.length && !weaknesses.length) return { success: false, error: "No hay suficiente información real de confianza en el grafo." };
    return { success: true, message: "Análisis calculado desde el grafo real.", data: { strengths, weaknesses } };
  },
};

export const viewHabitStreaksReal: ToolDefinition = {
  id: "view_habit_streaks", category: "analytics", description: "Consulta rachas reales almacenadas en hábitos.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const { data, error } = await supabase.from("habits").select("id,title,streak,completed_dates,is_active,updated_at").eq("user_id", user.id).eq("is_active", true).order("updated_at", { ascending: false });
    if (error) throw error;
    return { success: true, message: `${data?.length || 0} hábitos activos consultados.`, data: { habits: data || [] } };
  },
};

export const detectProcrastinationReal: ToolDefinition = {
  id: "detect_procrastination", category: "analytics", description: "Compara actividad real de las últimas dos semanas sin inventar un diagnóstico.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const ids = await sessionIds(supabase, user.id);
    if (!ids.length) return { success: true, message: "No hay sesiones para analizar.", data: { recent: 0, previous: 0, comparable: false } };
    const now = Date.now(); const recentStart = new Date(now - 7 * 86400000).toISOString(); const previousStart = new Date(now - 14 * 86400000).toISOString();
    const [{ count: recent }, { count: previous }] = await Promise.all([
      supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").in("session_id", ids).gte("created_at", recentStart),
      supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").in("session_id", ids).gte("created_at", previousStart).lt("created_at", recentStart),
    ]);
    return { success: true, message: "Actividad comparada con datos reales.", data: { recent: recent || 0, previous: previous || 0, comparable: (previous || 0) > 0, change: (recent || 0) - (previous || 0) } };
  },
};

export const generateAcademicDashboardReal: ToolDefinition = {
  id: "generate_academic_dashboard", category: "analytics", description: "Calcula un resumen académico usando únicamente métricas reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const [sessions, documents, concepts, habits, messages] = await Promise.all([
      countRows(supabase, "ai_sessions", user.id), countRows(supabase, "ai_documents", user.id), countRows(supabase, "knowledge_nodes", user.id), countRows(supabase, "habits", user.id), countRows(supabase, "ai_messages", user.id),
    ]);
    return { success: true, message: "Dashboard calculado con datos reales.", data: { sessions, documents, concepts, habits, messages } };
  },
};

export const viewActivityHeatmapReal: ToolDefinition = {
  id: "view_activity_heatmap", category: "analytics", description: "Cuenta actividad diaria real del usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(7).max(90).default(30) }),
  execute: async ({ days }) => {
    const { supabase, user } = await currentUser(); const ids = await sessionIds(supabase, user.id); const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = ids.length ? await supabase.from("ai_messages").select("created_at").eq("role", "user").in("session_id", ids).gte("created_at", since) : { data: [], error: null };
    if (error) throw error;
    const counts: Record<string, number> = {}; for (const row of data || []) { const day = String(row.created_at).slice(0, 10); counts[day] = (counts[day] || 0) + 1; }
    return { success: true, message: "Mapa de actividad construido desde mensajes reales.", data: { days, counts } };
  },
};

export const analyzeTimeDistributionReal: ToolDefinition = {
  id: "analyze_time_distribution", category: "analytics", description: "Distribuye sesiones por superficie; no inventa minutos de estudio no almacenados.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser();
    const { data, error } = await supabase.from("ai_sessions").select("ai_type").eq("user_id", user.id).limit(1000);
    if (error) throw error;
    const distribution: Record<string, number> = {}; for (const row of data || []) distribution[row.ai_type] = (distribution[row.ai_type] || 0) + 1;
    return { success: false, error: "No existe una métrica fiable de minutos por materia en el esquema actual; no se puede fabricar.", data: { session_distribution_by_ai_type: distribution } };
  },
};

export const predictExamScoreReal: ToolDefinition = {
  id: "predict_exam_score", category: "analytics", description: "Predice nota solo con calificaciones reales registradas en sesiones de examen.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ exam_id: z.string().min(1) }),
  execute: async ({ exam_id }) => {
    const { supabase, user } = await currentUser();
    const { data: exam } = await supabase.from("ai_sessions").select("id,title").eq("id", exam_id).eq("user_id", user.id).eq("ai_type", "exam").maybeSingle();
    if (!exam) return { success: false, error: "No se encontró el examen indicado." };
    const { data: exams, error } = await supabase.from("ai_sessions").select("title").eq("user_id", user.id).eq("ai_type", "exam").limit(200);
    if (error) throw error;
    const scores = (exams || []).map((e:any) => String(e.title || "").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i)?.[1]).filter(Boolean).map(Number);
    if (scores.length < 2) return { success: false, error: "No hay suficientes calificaciones reales para hacer una predicción responsable." };
    const predicted = Number((scores.reduce((a:number,b:number)=>a+b,0)/scores.length).toFixed(2));
    return { success: true, message: "Predicción calculada con calificaciones reales.", data: { exam_id, predicted_score: predicted, sample_size: scores.length } };
  },
};

export const calculateGpaReal: ToolDefinition = {
  id: "calculate_gpa", category: "analytics", description: "Calcula GPA solamente con calificaciones académicas estructuradas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => ({ success: false, error: "No existe un expediente fiable de calificaciones por curso en el esquema actual; no se puede inventar un GPA." }),
};

export const exportStatsCsvReal: ToolDefinition = {
  id: "export_stats_csv", category: "analytics", description: "Exporta actividad real de mensajes del usuario a CSV.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
  execute: async ({ days }) => {
    const { supabase, user } = await currentUser(); const ids = await sessionIds(supabase, user.id); const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = ids.length ? await supabase.from("ai_messages").select("created_at,role,session_id").eq("role", "user").in("session_id", ids).gte("created_at", since).order("created_at", { ascending: true }).limit(5000) : { data: [], error: null };
    if (error) throw error;
    const csv = ["date,session_id,role", ...(data || []).map((r:any)=>`${csvEscape(String(r.created_at).slice(0,10))},${csvEscape(r.session_id)},${csvEscape(r.role)}`)].join("\n");
    return { success: true, message: "CSV creado con actividad real.", data: { csv, rows: data?.length || 0, days } };
  },
};

export const generateCustomChartReal: ToolDefinition = {
  id: "generate_custom_chart", category: "analytics", description: "Prepara un gráfico a partir de los datos entregados por el usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ data: z.string().min(1), type: z.enum(["bar", "pie", "line"]).default("bar") }),
  execute: async ({ data, type }) => ({ success: true, message: "Datos listos para representar en un gráfico.", data: { chartType: type, source: data } }),
};

export const viewLearningVelocityReal: ToolDefinition = {
  id: "view_learning_velocity", category: "analytics", description: "Compara volumen real de actividad entre dos semanas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    const { supabase, user } = await currentUser(); const ids = await sessionIds(supabase, user.id);
    if (!ids.length) return { success: true, message: "No hay sesiones para comparar.", data: { recent: 0, previous: 0, change: 0 } };
    const now = Date.now(); const recentStart = new Date(now - 7*86400000).toISOString(); const previousStart = new Date(now - 14*86400000).toISOString();
    const [{ count: recent }, { count: previous }] = await Promise.all([
      supabase.from("ai_messages").select("id", {count:"exact",head:true}).eq("role","user").in("session_id",ids).gte("created_at",recentStart),
      supabase.from("ai_messages").select("id", {count:"exact",head:true}).eq("role","user").in("session_id",ids).gte("created_at",previousStart).lt("created_at",recentStart),
    ]);
    return { success: true, message: "Velocidad calculada con actividad real.", data: { recent: recent || 0, previous: previous || 0, change: (recent || 0) - (previous || 0) } };
  },
};

const OVERRIDES: Record<string, ToolDefinition> = {
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
  return { ...skill, tools: skill.tools.map((tool) => OVERRIDES[tool.id] || tool) };
}
