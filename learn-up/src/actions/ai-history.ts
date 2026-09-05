"use server";

import { createClient } from "@/utils/supabase/server";

const GENERIC_TITLES = new Set(["Nueva Sesión","Nueva Sesion","Profesor Mente","Profesor IA","Consejero IA","Consejero","Recetas IA","Examen IA","Jarvis","Chat","Untitled","undefined","null",""]);

function cleanTitleSource(content:string):string{return String(content||"").replace(/^\[Skills Activas:[^\]]*\]\s*/i,"").replace(/^\[Skill Activa:[^\]]*\]\s*/i,"").replace(/^\[TOOL_MODE:(?:manual|autopilot)\]\s*/i,"").replace(/\s+/g," ").trim();}
function buildSessionTitle(content:string):string{const source=cleanTitleSource(content);if(!source)return"Nueva Sesión";const sentence=source.split(/\n|[.!?]+\s/)[0]?.trim()||source;const withoutLead=sentence.replace(/^(hola|hey|oye|por favor|puedes|podrías|podrias|ayúdame|ayudame)\b[,:;\s-]*/i,"").trim();const title=(withoutLead||sentence).slice(0,72).trim();return title.length>72?`${title.slice(0,69).trimEnd()}…`:title;}
function isGenericTitle(title:string|null|undefined):boolean{return GENERIC_TITLES.has(String(title||"").trim());}

async function backfillGenericTitles(supabase:any,userId:string,sessions:any[]){
  const generic=sessions.filter(s=>isGenericTitle(s.title));
  if(!generic.length)return sessions;
  const results=await Promise.all(generic.map(async(session)=>{
    const {data:msg}=await supabase.from("ai_messages").select("content").eq("session_id",session.id).eq("role","user").order("created_at",{ascending:true}).limit(1).maybeSingle();
    const title=msg?.content?buildSessionTitle(msg.content):"";
    if(!title||isGenericTitle(title))return session;
    const {error}=await supabase.from("ai_sessions").update({title,updated_at:new Date().toISOString()}).eq("id",session.id).eq("user_id",userId);
    if(error){console.error("[getAiSessions] Error backfilling title:",error);return session;}
    return {...session,title};
  }));
  const map=new Map(results.map(s=>[s.id,s]));
  return sessions.map(s=>map.get(s.id)||s);
}

export async function getAiSessions(aiType:string){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return[];const{data,error}=await supabase.from("ai_sessions").select("*").eq("user_id",user.id).eq("ai_type",aiType).order("updated_at",{ascending:false});if(error){console.error(`[getAiSessions] Error fetching ${aiType} sessions:`,error);return[];}return backfillGenericTitles(supabase,user.id,data||[]);}

export async function getAiMessages(sessionId:string){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return[];const{data:session}=await supabase.from("ai_sessions").select("user_id").eq("id",sessionId).single();if(!session||session.user_id!==user.id)return[];const{data,error}=await supabase.from("ai_messages").select("*").eq("session_id",sessionId).order("created_at",{ascending:true});if(error){console.error("[getAiMessages] Error fetching messages:",error);return[];}return data||[];}

export async function createAiSession(aiType:string,title:string){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return{error:"Unauthorized"};const safeTitle=isGenericTitle(title)?"Nueva Sesión":title.trim().slice(0,120);const{data,error}=await supabase.from("ai_sessions").insert({user_id:user.id,ai_type:aiType,title:safeTitle||"Nueva Sesión"}).select().single();if(error)return{error:error.message};return{session:data};}

export async function addAiMessage(sessionId:string,role:"user"|"assistant",content:string,mediaUrl?:string,mediaType?:string,toolCalls?:any[],clientMessageId?:string){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return{error:"Unauthorized"};const{data:session}=await supabase.from("ai_sessions").select("user_id,title").eq("id",sessionId).single();if(!session||session.user_id!==user.id)return{error:"Unauthorized or session not found"};if(clientMessageId){const{data:existing}=await supabase.from("ai_messages").select("*").eq("session_id",sessionId).eq("client_message_id",clientMessageId).maybeSingle();if(existing)return{message:existing};}const payload:any={session_id:sessionId,role,content,media_url:mediaUrl||null,media_type:mediaType||null,client_message_id:clientMessageId||null};if(toolCalls&&toolCalls.length>0)payload.tool_calls=toolCalls;const{data,error}=await supabase.from("ai_messages").insert(payload).select().single();if(error){if(clientMessageId){const{data:existing}=await supabase.from("ai_messages").select("*").eq("session_id",sessionId).eq("client_message_id",clientMessageId).maybeSingle();if(existing)return{message:existing};}return{error:error.message};}if(role==="user"&&isGenericTitle(session.title)){const newTitle=buildSessionTitle(content);if(newTitle&&!isGenericTitle(newTitle)){const{error:titleError}=await supabase.from("ai_sessions").update({title:newTitle,updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);if(titleError)console.error("[addAiMessage] Error updating session title:",titleError);}}else{await supabase.from("ai_sessions").update({updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);}return{message:data};}

export async function deleteAiSession(sessionId:string){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return{error:"Unauthorized"};const{data:session}=await supabase.from("ai_sessions").select("user_id").eq("id",sessionId).single();if(!session||session.user_id!==user.id)return{error:"Unauthorized or session not found"};const{error}=await supabase.from("ai_sessions").delete().eq("id",sessionId);if(error)return{error:error.message};return{success:true};}
