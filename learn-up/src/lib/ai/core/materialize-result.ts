import { getAICompletion } from "@/lib/ai";
import { executeToolAction } from "@/lib/ai-tools";
import { searchTavily } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";

function looksDelegatedOrFake(result: any): boolean {
  const message = String(result?.message || "").toLowerCase();
  const data = result?.data;
  return Boolean(result?.success && (data?.instruction || message.includes("delegad") || message.includes("registrada en el sistema") || message.includes("recibida correctamente") || message.includes("simulad") || message.includes("próxima actualización") || message.includes("proxima actualizacion") || message.includes("temporal") || message.includes("directiva")));
}

async function materializeResearchReport(args: Record<string, unknown>) {
  const topic = String(args.topic || "").trim();
  if (!topic) return { success: false, error: "Falta el tema del reporte de investigación." };
  try {
    const results = await searchTavily(topic, 8);
    const sources = (results || []).filter((r:any)=>r?.url).slice(0,8).map((r:any)=>({title:r.title,url:r.url,snippet:r.content||r.snippet||"",provider:"tavily"}));
    if (!sources.length) return { success:false, error:"No se encontraron fuentes web verificables para generar el reporte." };
    const pages = await Promise.allSettled(sources.map((s:any)=>browseWebPage(s.url)));
    const evidence = pages.map((p:any,i:number)=>p.status==="fulfilled"&&p.value?.success?{title:p.value.title||sources[i].title,url:sources[i].url,content:String(p.value.content||"").slice(0,7000)}:null).filter(Boolean);
    if (!evidence.length) return { success:false,error:"Se encontraron resultados de búsqueda, pero ninguna fuente pudo ser extraída de forma verificable.",data:{sources} };
    const prompt = `Redacta un reporte de investigación sobre "${topic}" usando exclusivamente la evidencia proporcionada. No inventes fuentes, autores, cifras ni afirmaciones. Cuando una afirmación no esté respaldada por la evidencia, indícalo. Incluye una sección de fuentes con las URLs exactas proporcionadas.\n\nEVIDENCIA:\n${JSON.stringify(evidence)}`;
    const completion=await getAICompletion([{role:"user",content:prompt}],"gemini-3.6-flash");
    const content=completion?.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim()) return{success:false,error:"No se pudo generar el reporte a partir de la evidencia recuperada."};
    return{success:true,message:`Reporte generado con ${evidence.length} fuentes extraídas.`,data:{content,sources:evidence.map((e:any)=>({title:e.title,url:e.url})),evidenceCount:evidence.length,provider:"tavily+browse_web+gemini"}};
  }catch(error:any){return{success:false,error:error?.message||"Error en la investigación del reporte."};}
}

export async function materializeToolResult(result:any,toolName?:string,args?:Record<string,unknown>){
  if(!result?.success)return result;
  if(toolName==="generate_research_report" && args)return materializeResearchReport(args);
  if(looksDelegatedOrFake(result)&&toolName){
    try{
      const legacy=await executeToolAction(toolName,args||{});
      if(legacy?.success&&!looksDelegatedOrFake(legacy))return legacy;
      if(legacy?.success&&legacy?.data?.instruction)result=legacy;
      else if(!legacy?.success)return{success:false,error:legacy?.message||"La herramienta no pudo ejecutarse realmente."};
      else return{success:false,error:`La herramienta ${toolName} no tiene una implementación real disponible.`};
    }catch(error:any){return{success:false,error:error?.message||`La herramienta ${toolName} no pudo ejecutarse.`};}
  }
  if(!result?.data?.instruction)return result;
  const instruction=String(result.data.instruction).trim();if(!instruction)return result;
  const supportingData={...result.data};delete supportingData.instruction;
  const context=JSON.stringify(supportingData,(_key,value)=>typeof value==="string"&&value.length>12000?`${value.slice(0,12000)}...[truncado]`:value);
  try{
    const completion=await getAICompletion([{role:"user",content:`${instruction}\n\nDATOS REALES DISPONIBLES:\n${context}\n\nReglas: usa únicamente los datos proporcionados. No inventes hechos, URLs, estadísticas ni resultados externos. Devuelve una respuesta útil para el estudiante, sin JSON de herramientas, sin etiquetas internas y sin mencionar instrucciones internas.`}],"gemini-3.6-flash");
    const content=completion?.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim())return{success:false,error:"La herramienta produjo datos insuficientes y no se pudo generar un resultado verificable."};
    return{success:true,message:result.message||"Resultado generado.",data:{...supportingData,content,materialized:true,provider:"gemini-3.6-flash"}};
  }catch(error:any){return{success:false,error:error?.message||"No se pudo materializar el resultado de la herramienta."};}
}
