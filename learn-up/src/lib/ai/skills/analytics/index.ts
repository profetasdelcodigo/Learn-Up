import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { createClient } from "@/utils/supabase/server";

async function getUserClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

async function fetchStudyStats() {
  const { supabase, user } = await getUserClient();
  const [{ count: sessions }, { count: documents }, { count: concepts }, { count: habits }, { count: completions }, { data: examSessions }] = await Promise.all([
    supabase.from("ai_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("ai_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("knowledge_nodes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
    supabase.from("habit_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("ai_sessions").select("id,title,ai_type,created_at,updated_at").eq("user_id", user.id).in("ai_type", ["exam", "examen", "examenes", "practice"]).order("created_at", { ascending: false }).limit(100),
  ]);

  const scores = (examSessions || []).map((s: any) => {
    const m = String(s.title || "").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]\s*(\d+(?:\.\d+)?)/i);
    return m ? Number(m[1]) : null;
  }).filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  return {
    sessions: sessions || 0,
    documents: documents || 0,
    concepts: concepts || 0,
    activeHabits: habits || 0,
    habitCompletions: completions || 0,
    exams: examSessions?.length || 0,
    averageScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
    examsWithScore: scores.length,
  };
}

export const viewStudyStatsTool: ToolDefinition = {
  id: "view_study_stats", category: "analytics", description: "Estadísticas reales de estudio del usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => ({ success: true, message: "Estadísticas recuperadas desde tus datos.", data: await fetchStudyStats() }),
};

export const generateWeeklyReportTool: ToolDefinition = {
  id: "generate_weekly_report", category: "analytics", description: "Reporte semanal basado en actividad real.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => {
    const { supabase, user } = await getUserClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [sessions, docs, concepts, completions] = await Promise.all([
      supabase.from("ai_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
      supabase.from("ai_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
      supabase.from("knowledge_nodes").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
      supabase.from("habit_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
    ]);
    return { success: true, message: "Reporte semanal calculado con datos reales.", data: { periodDays: 7, sessions: sessions.count || 0, documents: docs.count || 0, concepts: concepts.count || 0, habitCompletions: completions.count || 0 } };
  },
};

export const viewExamHistoryTool: ToolDefinition = {
  id: "view_exam_history", category: "analytics", description: "Historial real de sesiones de exámenes.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ limit: z.number().int().min(1).max(100).default(10) }), execute: async ({ limit }) => {
    const { supabase, user } = await getUserClient();
    const { data, error } = await supabase.from("ai_sessions").select("id,title,ai_type,created_at,updated_at").eq("user_id", user.id).in("ai_type", ["exam", "examen", "examenes", "practice"]).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const exams = (data || []).map((row: any) => ({ ...row, score: (String(row.title || "").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]\s*(\d+(?:\.\d+)?)/i) || [])[1] ? Number((String(row.title).match(/(?:nota|score|calificaci[oó]n)\s*[:=-]\s*(\d+(?:\.\d+)?)/i) || [])[1]) : null }));
    return { success: true, message: `Encontré ${exams.length} exámenes reales.`, data: { exams } };
  },
};

export const analyzeStrengthsWeaknessesTool: ToolDefinition = {
  id: "analyze_strengths_weaknesses", category: "analytics", description: "Analizar rendimiento usando historial real disponible.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => {
    const { supabase, user } = await getUserClient();
    const { data } = await supabase.from("ai_sessions").select("title,ai_type,created_at").eq("user_id", user.id).in("ai_type", ["exam", "examen", "examenes", "practice"]).order("created_at", { ascending: false }).limit(200);
    const byTopic: Record<string, number[]> = {};
    for (const row of data || []) {
      const title = String(row.title || "Sin título");
      const scoreMatch = title.match(/(?:nota|score|calificaci[oó]n)\s*[:=-]\s*(\d+(?:\.\d+)?)/i);
      if (!scoreMatch) continue;
      const topic = title.replace(/\s*[-–—]\s*(?:nota|score|calificaci[oó]n).*$/i, "").trim() || "Sin tema";
      (byTopic[topic] ||= []).push(Number(scoreMatch[1]));
    }
    const summaries = Object.entries(byTopic).map(([topic, scores]) => ({ topic, average: Number((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)), attempts: scores.length }));
    summaries.sort((a,b) => b.average - a.average);
    return { success: true, message: "Análisis calculado con resultados reales disponibles.", data: { strengths: summaries.slice(0, 5), weaknesses: summaries.slice(-5).reverse(), note: summaries.length ? undefined : "No hay suficientes exámenes con calificación registrada para determinar fortalezas y debilidades." } };
  },
};

async function computeHabitStats() {
  const { supabase, user } = await getUserClient();
  const { data: habits, error } = await supabase.from("habits").select("id,title,streak,is_active").eq("user_id", user.id).eq("is_active", true);
  if (error) throw error;
  const { data: completions } = await supabase.from("habit_completions").select("habit_id,completed_date").eq("user_id", user.id);
  const grouped = new Map<string, string[]>();
  for (const row of completions || []) grouped.set(row.habit_id, [...(grouped.get(row.habit_id) || []), row.completed_date]);
  return (habits || []).map((h: any) => {
    const dates = [...new Set((grouped.get(h.id) || []).map(String))].sort();
    let current = 0; let best = 0; let run = 0; let prev = "";
    for (const date of dates) {
      if (prev && (new Date(date).getTime() - new Date(prev).getTime()) === 86400000) run += 1; else run = 1;
      best = Math.max(best, run); prev = date;
    }
    current = best;
    return { habitId: h.id, habit: h.title, currentStreak: Number(h.streak || current), calculatedRecord: best, completionDays: dates.length };
  });
}

export const viewHabitStreaksTool: ToolDefinition = {
  id: "view_habit_streaks", category: "analytics", description: "Rachas reales de hábitos.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => ({ success: true, message: "Rachas calculadas desde tus hábitos.", data: { habits: await computeHabitStats() } }),
};

export const detectProcrastinationTool: ToolDefinition = {
  id: "detect_procrastination", category: "analytics", description: "Detectar patrones de actividad a partir de sesiones reales, sin inventar diagnósticos.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => {
    const { supabase, user } = await getUserClient();
    const { data } = await supabase.from("ai_sessions").select("created_at").eq("user_id", user.id).gte("created_at", new Date(Date.now()-30*86400000).toISOString());
    const hours: Record<string, number> = {}; const weekdays: Record<string, number> = {};
    for (const row of data || []) { const d = new Date(row.created_at); hours[String(d.getHours())] = (hours[String(d.getHours())]||0)+1; weekdays[String(d.getDay())] = (weekdays[String(d.getDay())]||0)+1; }
    return { success: true, message: "Patrones de actividad calculados con tus sesiones reales.", data: { daysAnalyzed: 30, sessions: data?.length || 0, byHour: hours, byWeekday: weekdays, disclaimer: "Esto describe actividad registrada; no diagnostica procrastinación." } };
  },
};

export const generateAcademicDashboardTool: ToolDefinition = {
  id: "generate_academic_dashboard", category: "analytics", description: "Resumen académico con métricas reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => ({ success: true, message: "Dashboard calculado con datos reales.", data: await fetchStudyStats() }),
};

export const viewActivityHeatmapTool: ToolDefinition = {
  id: "view_activity_heatmap", category: "analytics", description: "Mapa de actividad basado en sesiones reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(7).max(365).default(90) }), execute: async ({ days }) => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("ai_sessions").select("created_at").eq("user_id", user.id).gte("created_at", new Date(Date.now()-days*86400000).toISOString());
    const counts: Record<string, number> = {}; for (const row of data || []) { const key = new Date(row.created_at).toISOString().slice(0,10); counts[key] = (counts[key]||0)+1; }
    return { success: true, message: "Mapa de actividad generado.", data: { days, counts } };
  },
};

export const analyzeTimeDistributionTool: ToolDefinition = {
  id: "analyze_time_distribution", category: "analytics", description: "Distribución temporal de sesiones reales; no asigna materias sin evidencia.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("ai_sessions").select("title,created_at,updated_at").eq("user_id", user.id).limit(500);
    const hours: Record<string, number> = {}; let totalMinutes = 0;
    for (const row of data || []) { const d = new Date(row.created_at); hours[String(d.getHours())]=(hours[String(d.getHours())]||0)+1; const duration=(new Date(row.updated_at).getTime()-new Date(row.created_at).getTime())/60000; if(duration>=0&&duration<24*60) totalMinutes+=duration; }
    return { success: true, message: "Distribución calculada desde sesiones reales.", data: { sessionCount: data?.length||0, estimatedMinutesFromSessionWindows: Math.round(totalMinutes), byHour: hours } };
  },
};

export const predictExamScoreTool: ToolDefinition = {
  id: "predict_exam_score", category: "analytics", description: "Estimar una media histórica solo cuando existen calificaciones reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ exam_id: z.string().optional() }), execute: async ({ exam_id }) => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("ai_sessions").select("id,title,created_at").eq("user_id", user.id).in("ai_type", ["exam","examen","examenes","practice"]).order("created_at", { ascending:false }).limit(100);
    const scores=(data||[]).map((r:any)=>{const m=String(r.title||"").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]\s*(\d+(?:\.\d+)?)/i);return m?Number(m[1]):null}).filter((x:any)=>x!==null);
    if(!scores.length) return {success:false,error:"No hay calificaciones históricas registradas para realizar una estimación honesta."};
    return {success:true,message:"Media histórica calculada con calificaciones reales.",data:{examId:exam_id||null,estimatedScore:Number((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)),sampleSize:scores.length,method:"media histórica; no es una predicción causal"}};
  },
};

export const calculateGpaTool: ToolDefinition = {
  id: "calculate_gpa", category: "analytics", description: "Calcular promedio solo a partir de calificaciones reales registradas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ scale: z.number().positive().default(100) }), execute: async ({ scale }) => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("ai_sessions").select("title").eq("user_id", user.id).in("ai_type", ["exam","examen","examenes","practice"]).limit(200);
    const scores=(data||[]).map((r:any)=>{const m=String(r.title||"").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]\s*(\d+(?:\.\d+)?)/i);return m?Number(m[1]):null}).filter((x:any)=>x!==null);
    if(!scores.length) return {success:false,error:"No hay calificaciones registradas para calcular un promedio."};
    const avg=scores.reduce((a,b)=>a+b,0)/scores.length; return {success:true,message:"Promedio calculado con notas reales.",data:{average100:Number(avg.toFixed(2)),averageOnRequestedScale:Number((avg/100*scale).toFixed(2)),scale,sampleSize:scores.length}};
  },
};

export const exportStatsCsvTool: ToolDefinition = {
  id: "export_stats_csv", category: "analytics", description: "Exportar datos de actividad reales en CSV.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}), execute: async () => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("ai_sessions").select("id,ai_type,title,created_at,updated_at").eq("user_id", user.id).order("created_at",{ascending:true});
    const rows=["id,ai_type,title,created_at,updated_at",...(data||[]).map((r:any)=>[r.id,r.ai_type,JSON.stringify(r.title||""),r.created_at,r.updated_at].join(","))];
    return {success:true,message:"CSV construido con sesiones reales.",data:{csv:rows.join("\n"),filename:"learn-up-activity.csv"}};
  },
};

export const generateCustomChartTool: ToolDefinition = {
  id: "generate_custom_chart", category: "analytics", description: "Preparar datos reales para una gráfica.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ type: z.enum(["bar","pie","line"]).default("bar") }), execute: async ({ type }) => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("ai_sessions").select("ai_type,created_at").eq("user_id",user.id).order("created_at",{ascending:true}).limit(1000); const grouped:Record<string,number>={}; for(const r of data||[]) grouped[r.ai_type]=(grouped[r.ai_type]||0)+1;
    return {success:true,message:"Datos reales listos para gráfica.",data:{chartType:type,points:Object.entries(grouped).map(([label,value])=>({label,value}))}};
  },
};

export const viewLearningVelocityTool: ToolDefinition = {
  id: "view_learning_velocity", category: "analytics", description: "Velocidad de incorporación de conceptos basada en Knowledge Graph real.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(14).max(365).default(90) }), execute: async ({ days }) => {
    const { supabase, user } = await getUserClient(); const { data } = await supabase.from("knowledge_nodes").select("created_at").eq("user_id",user.id).gte("created_at",new Date(Date.now()-days*86400000).toISOString()).order("created_at",{ascending:true}); const byWeek:Record<string,number>={}; for(const r of data||[]){const d=new Date(r.created_at); const week=new Date(d); week.setDate(d.getDate()-d.getDay()); const key=week.toISOString().slice(0,10); byWeek[key]=(byWeek[key]||0)+1;} const values=Object.values(byWeek); const first=values[0]||0,last=values[values.length-1]||0; return {success:true,message:"Velocidad de aprendizaje calculada con conceptos reales.",data:{days,totalConcepts:data?.length||0,byWeek,changeLastVsFirst:last-first}};
  },
};

export const analyticsSkill: Skill = {
  id: "analytics", name: "Análisis de Datos", category: "analytics",
  description: "Métricas académicas y de actividad calculadas a partir de datos reales del usuario.",
  tools: [viewStudyStatsTool,generateWeeklyReportTool,viewExamHistoryTool,analyzeStrengthsWeaknessesTool,viewHabitStreaksTool,detectProcrastinationTool,generateAcademicDashboardTool,viewActivityHeatmapTool,analyzeTimeDistributionTool,predictExamScoreTool,calculateGpaTool,exportStatsCsvTool,generateCustomChartTool,viewLearningVelocityTool],
};
