import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { getAICompletion, AI_MODELS } from "@/lib/ai";

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

async function scoreRows(supabase: any, userId: string) {
  const { data, error } = await supabase.from("ai_sessions").select("id,title,ai_type,created_at,updated_at").eq("user_id", userId).in("ai_type", ["exam", "examen", "examenes", "practice"]).order("created_at", { ascending: true }).limit(500);
  if (error) throw error;
  return (data || []).map((row: any) => {
    const match = String(row.title || "").match(/(?:nota|score|calificaci[oó]n)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i);
    return match ? { ...row, score: Number(match[1]) } : null;
  }).filter(Boolean) as Array<any>;
}

const comparePerformance: ToolDefinition = {
  id: "compare_performance_timeframe", category: "analytics", description: "Compara el rendimiento del usuario entre dos periodos usando calificaciones reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(14).max(365).default(60) }),
  execute: async ({ days }) => {
    const { supabase, user } = await auth(); const rows = await scoreRows(supabase, user.id); const cutoff = Date.now() - days * 86400000; const recent = rows.filter(r => new Date(r.created_at).getTime() >= cutoff); const old = rows.filter(r => new Date(r.created_at).getTime() < cutoff);
    const avg = (items: any[]) => items.length ? Number((items.reduce((a, b) => a + b.score, 0) / items.length).toFixed(2)) : null;
    return { success: true, message: "Rendimiento comparado con calificaciones reales.", data: { days, recent: { count: recent.length, average: avg(recent) }, previous: { count: old.length, average: avg(old) }, delta: recent.length && old.length ? Number((avg(recent)! - avg(old)!).toFixed(2)) : null } };
  },
};

const readiness: ToolDefinition = {
  id: "project_readiness_level", category: "analytics", description: "Estima preparación como media histórica, sin afirmar causalidad.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ target_score: z.number().min(0).max(100).default(70) }),
  execute: async ({ target_score }) => { const { supabase, user } = await auth(); const rows = await scoreRows(supabase, user.id); if (!rows.length) return { success: true, message: "No hay notas suficientes para estimar preparación.", data: { comparable: false, target_score, sample_size: 0 } }; const average = Number((rows.reduce((a,b)=>a+b.score,0)/rows.length).toFixed(2)); return { success: true, message: "Preparación estimada con historial real.", data: { comparable: true, average_score: average, target_score, gap_to_target: Number((target_score-average).toFixed(2)), sample_size: rows.length, method: "media histórica; no es una predicción causal" } }; },
};

const timeBySubject: ToolDefinition = {
  id: "view_time_spent_by_subject", category: "analytics", description: "Distribuye sesiones reales por superficie/materia disponible en ai_type.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => { const { supabase, user } = await auth(); const { data, error } = await supabase.from("ai_sessions").select("ai_type,created_at,updated_at,title").eq("user_id", user.id).limit(1000); if (error) throw error; const bySubject: Record<string, {sessions:number, estimated_minutes:number}> = {}; for (const row of data || []) { const key=String(row.ai_type||"sin_categoria"); const started=new Date(row.created_at).getTime(); const ended=new Date(row.updated_at).getTime(); const minutes=Number.isFinite(started)&&Number.isFinite(ended)&&ended>=started&&ended-started<24*60*60*1000?(ended-started)/60000:0; bySubject[key] ||= {sessions:0,estimated_minutes:0}; bySubject[key].sessions += 1; bySubject[key].estimated_minutes += minutes; } Object.values(bySubject).forEach(v=>v.estimated_minutes=Math.round(v.estimated_minutes)); return { success:true,message:"Distribución obtenida de sesiones reales.",data:{bySubject,limitation:"Los minutos son ventanas entre created_at y updated_at; no equivalen necesariamente a tiempo activo de estudio."} }; },
};

const anonymousBenchmark: ToolDefinition = {
  id: "anonymous_peer_benchmark", category: "analytics", description: "Compara de forma anónima cuando exista una fuente agregada segura; nunca expone perfiles individuales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ metric: z.enum(["sessions","concepts","habit_completions"]).default("sessions") }),
  execute: async ({ metric }) => { const { supabase, user } = await auth(); const ownTable = metric === "sessions" ? "ai_sessions" : metric === "concepts" ? "knowledge_nodes" : "habit_completions"; const { count, error } = await supabase.from(ownTable).select("id", {count:"exact", head:true}).eq("user_id", user.id); if (error) throw error; return { success:true,message:"Métrica propia recuperada; no se expusieron datos de otros estudiantes.",data:{metric,own_value:count||0,peer_benchmark:null,comparable:false,note:"No existe en el esquema actual una fuente agregada de cohortes anónimas con controles suficientes para publicarla sin riesgo de filtración."} }; },
};

const exportProgress: ToolDefinition = {
  id: "export_progress_data", category: "analytics", description: "Exporta un paquete JSON con progreso académico real del usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => { const { supabase, user } = await auth(); const [sessions, concepts, habits, completions] = await Promise.all([supabase.from("ai_sessions").select("id,title,ai_type,created_at,updated_at").eq("user_id",user.id).order("created_at",{ascending:true}).limit(2000),supabase.from("knowledge_nodes").select("id,title,description,confidence_level,created_at,last_reviewed_at").eq("user_id",user.id).limit(2000),supabase.from("habits").select("id,title,streak,is_active").eq("user_id",user.id).limit(500),supabase.from("habit_completions").select("habit_id,completed_date,created_at").eq("user_id",user.id).limit(5000)]); for(const x of [sessions,concepts,habits,completions]) if(x.error) throw x.error; return {success:true,message:"Progreso exportado en JSON.",data:{exportedAt:new Date().toISOString(),userId:user.id,sessions:sessions.data||[],concepts:concepts.data||[],habits:habits.data||[],habitCompletions:completions.data||[]}}; },
};

const studyQuality: ToolDefinition = {
  id: "analyze_study_quality", category: "analytics", description: "Evalúa señales observables de calidad de estudio sin diagnosticar al usuario.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ days: z.number().int().min(7).max(90).default(30) }),
  execute: async ({ days }) => { const { supabase, user } = await auth(); const since=new Date(Date.now()-days*86400000).toISOString(); const [{data:sessions,error:sErr},{data:messages,error:mErr},{data:completions,error:cErr}] = await Promise.all([supabase.from("ai_sessions").select("id,ai_type,created_at,updated_at").eq("user_id",user.id).gte("updated_at",since),supabase.from("ai_messages").select("id,session_id,role,created_at").eq("role","user").gte("created_at",since).limit(5000),supabase.from("habit_completions").select("id,completed_date").eq("user_id",user.id).gte("created_at",since).limit(5000)]); if(sErr||mErr||cErr) throw sErr||mErr||cErr; const sessionCount=sessions?.length||0; const userMessages=messages?.length||0; const avgMessagesPerSession=sessionCount?Number((userMessages/sessionCount).toFixed(2)):0; return {success:true,message:"Calidad de estudio analizada con señales observables.",data:{days,sessionCount,userMessages,habitCompletions:completions?.length||0,avgUserMessagesPerSession:avgMessagesPerSession,signals:{consistency:sessionCount>=days*0.5?"alta":sessionCount>=days*0.2?"media":"baja",engagement:userMessages>=sessionCount*3?"alto":userMessages>=sessionCount?"medio":"bajo"},note:"Estas señales describen actividad registrada y no sustituyen una evaluación pedagógica."}}; },
};

export function withFinalAnalyticsOverrides(skill: Skill): Skill {
  if (skill.id !== "analytics") return skill;
  const additions=[comparePerformance,readiness,timeBySubject,anonymousBenchmark,exportProgress,studyQuality];
  const tools=skill.tools.map(tool=>tool);
  for(const tool of additions) if(!tools.some(candidate=>candidate.id===tool.id)) tools.push(tool);
  return {...skill,tools};
}
