import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { generateFalImage, generateFalVideo } from "@/lib/fal";
import { searchTavily } from "@/lib/web-search";
import { createClient } from "@/utils/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

async function aiText(prompt: string) {
  const { getAICompletion } = await import("@/lib/ai");
  const result = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
  return result?.choices?.[0]?.message?.content || "";
}

async function publicUpload(data: ArrayBuffer, mime: string, prefix: string, extension: string) {
  const { supabase, user } = await requireUser();
  const path = `${user.id}/ai/${prefix}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("ai_media").upload(path, data, { contentType: mime, upsert: false });
  if (error) throw error;
  const { data: publicData } = supabase.storage.from("ai_media").getPublicUrl(path);
  return publicData.publicUrl;
}

async function callGeminiVision(url: string, prompt: string, mimeFallback = "image/jpeg") {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY para análisis multimodal.");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar el recurso (${response.status}).`);
  const mime = response.headers.get("content-type") || mimeFallback;
  const bytes = Buffer.from(await response.arrayBuffer());
  const api = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime,data:bytes.toString("base64")}}]}]})});
  if (!api.ok) throw new Error(`Gemini multimodal ${api.status}: ${await api.text()}`);
  const data = await api.json();
  return data.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("\n") || "";
}

export const generateImageTool: ToolDefinition = {
  id:"generate_image",category:"multimedia",description:"Generar una imagen real con Fal.ai.",risk:"write",requiresConfirmation:true,supportsAutopilot:false,
  schema:z.object({prompt:z.string().min(1),purpose:z.string().optional()}),execute:async({prompt})=>{const url=await generateFalImage(prompt);return{success:true,message:"Imagen generada con Fal.ai.",data:{url,provider:"fal.ai"}};}
};

export const searchImageTool: ToolDefinition = {
  id:"search_image",category:"multimedia",description:"Buscar imágenes reales en Unsplash.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({query:z.string().min(1),orientation:z.enum(["landscape","portrait","squarish"]).optional()}),execute:async({query,orientation})=>{const key=process.env.UNSPLASH_ACCESS_KEY;if(!key)return{success:false,error:"Falta UNSPLASH_ACCESS_KEY."};const p=new URLSearchParams({query,per_page:"8"});if(orientation)p.set("orientation",orientation);const r=await fetch(`https://api.unsplash.com/search/photos?${p}`,{headers:{Authorization:`Client-ID ${key}`}});if(!r.ok)return{success:false,error:`Unsplash ${r.status}`};const d=await r.json();const photos=(d.results||[]).map((x:any)=>({url:x.urls?.regular,thumb:x.urls?.small,alt:x.alt_description,author:x.user?.name,authorUrl:x.user?.links?.html,sourceUrl:x.links?.html}));return{success:true,message:`Encontré ${photos.length} imágenes reales.`,data:{photos,sources:photos.map((p:any)=>({title:p.author||"Unsplash",url:p.sourceUrl||p.url}))}};}
};

export const generateVideoTool: ToolDefinition = {
  id:"generate_video",category:"multimedia",description:"Generar vídeo real con Fal.ai.",risk:"write",requiresConfirmation:true,supportsAutopilot:false,
  schema:z.object({prompt:z.string().min(1),purpose:z.string().optional()}),execute:async({prompt})=>{const url=await generateFalVideo(prompt);return{success:true,message:"Vídeo generado con Fal.ai.",data:{url,provider:"fal.ai"}};}
};

export const analyzeImageTool: ToolDefinition = {
  id:"analyze_image",category:"multimedia",description:"Analizar una imagen real con Gemini Vision, incluyendo OCR y preguntas sobre la imagen.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({image_url:z.string().url(),question:z.string().optional().default("Describe y analiza la imagen con detalle; extrae texto si lo contiene.")}),execute:async({image_url,question})=>{const text=await callGeminiVision(image_url,question);return{success:true,message:"Imagen analizada con Gemini Vision.",data:{text,source:{url:image_url}}};}
};

export const generateMermaidDiagramTool: ToolDefinition = {
  id:"generate_mermaid_diagram",category:"multimedia",description:"Generar un diagrama Mermaid renderizable.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({type:z.string().default("flowchart"),description:z.string().min(1)}),execute:async({type,description})=>{const content=await aiText(`Genera un diagrama Mermaid ${type} para: ${description}. Devuelve solamente sintaxis Mermaid válida, sin cercas de código.`);return{success:true,message:"Diagrama Mermaid generado.",data:{mermaid:content}};}
};

export const generatePodcastScriptTool: ToolDefinition = {
  id:"generate_podcast_script",category:"multimedia",description:"Crear guion de podcast educativo.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({topic:z.string().min(1)}),execute:async({topic})=>{const content=await aiText(`Crea un guion de podcast educativo sobre ${topic} en diálogo entre dos voces. No inventes fuentes ni datos: limita las afirmaciones a conocimiento general verificable y señala qué debe verificarse.`);return{success:true,message:"Guion de podcast generado.",data:{content}};}
};

export const describeMathImageTool: ToolDefinition = {
  id:"describe_math_image",category:"multimedia",description:"Leer y resolver una imagen matemática con Gemini Vision.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({image_url:z.string().url(),problem_description:z.string().optional()}),execute:async({image_url,problem_description})=>{const content=await callGeminiVision(image_url,`Extrae exactamente el problema matemático de la imagen y resuélvelo paso a paso. Contexto adicional: ${problem_description||"ninguno"}.`);return{success:true,message:"Problema matemático extraído y resuelto con Gemini Vision.",data:{content,source:{url:image_url}}};}
};

export const textToSpeechTool: ToolDefinition = {
  id:"text_to_speech",category:"multimedia",description:"Convertir texto a audio mediante OpenAI TTS y guardar el resultado en Supabase Storage.",risk:"write",requiresConfirmation:true,supportsAutopilot:false,
  schema:z.object({text:z.string().min(1),voice:z.string().default("alloy"),model:z.string().default("tts-1")}),execute:async({text,voice,model})=>{const key=process.env.OPENAI_API_KEY;if(!key)return{success:false,error:"Falta OPENAI_API_KEY para TTS."};const r=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{Authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({model,input:text,voice,response_format:"mp3"})});if(!r.ok)return{success:false,error:`OpenAI TTS ${r.status}: ${await r.text()}`};const url=await publicUpload(await r.arrayBuffer(),"audio/mpeg","tts","mp3");return{success:true,message:"Audio TTS generado y guardado.",data:{url,provider:"openai"}};}
};

export const transcribeAudioTool: ToolDefinition = {
  id:"transcribe_audio",category:"multimedia",description:"Transcribir audio real mediante OpenAI Whisper.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({audio_url:z.string().url()}),execute:async({audio_url})=>{const key=process.env.OPENAI_API_KEY;if(!key)return{success:false,error:"Falta OPENAI_API_KEY para STT."};const audio=await fetch(audio_url);if(!audio.ok)return{success:false,error:`No se pudo descargar el audio (${audio.status}).`};const form=new FormData();form.append("file",new Blob([await audio.arrayBuffer()],{type:audio.headers.get("content-type")||"audio/mpeg"}),"audio.mp3");form.append("model","whisper-1");form.append("response_format","verbose_json");form.append("timestamp_granularities[]","segment");const r=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${key}`},body:form});if(!r.ok)return{success:false,error:`OpenAI STT ${r.status}: ${await r.text()}`};const d=await r.json();return{success:true,message:"Audio transcrito con Whisper.",data:{text:d.text,segments:d.segments||[],provider:"openai"}};}
};

export const generateInfographicLayoutTool: ToolDefinition = {
  id:"generate_infographic_layout",category:"multimedia",description:"Generar estructura de infografía.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({topic:z.string().min(1)}),execute:async({topic})=>{const content=await aiText(`Diseña una estructura de infografía educativa sobre ${topic}. Devuelve JSON válido con title, sections, key_statements y visual_suggestions. No inventes estadísticas: marca como "requiere fuente" cualquier cifra no proporcionada.`);return{success:true,message:"Estructura de infografía generada.",data:{content}};}
};

export const generateColorPaletteTool: ToolDefinition = {
  id:"generate_color_palette",category:"multimedia",description:"Generar una paleta para un contenido visual.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({theme:z.string().min(1)}),execute:async({theme})=>{const content=await aiText(`Genera una paleta de cinco colores para el tema ${theme}. Devuelve JSON con nombre y HEX de cada color.`);return{success:true,message:"Paleta generada.",data:{content}};}
};

export const extractColorsFromImageTool: ToolDefinition = {
  id:"extract_colors_from_image",category:"multimedia",description:"Extraer colores dominantes de una imagen usando análisis visual real.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({image_url:z.string().url()}),execute:async({image_url})=>{const content=await callGeminiVision(image_url,"Identifica aproximadamente los cinco colores dominantes de la imagen y entrega nombre, HEX aproximado y porcentaje estimado. Indica que son aproximaciones visuales.");return{success:true,message:"Colores extraídos por análisis visual.",data:{content,source:{url:image_url}}};}
};

export const resizeImageTool: ToolDefinition = { id:"resize_image",category:"multimedia",description:"Validar una operación de redimensionado; requiere un procesador de imágenes configurado.",risk:"write",requiresConfirmation:true,supportsAutopilot:false,schema:z.object({image_url:z.string().url(),width:z.number().int().positive().max(10000),height:z.number().int().positive().max(10000)}),execute:async()=>({success:false,error:"No hay un procesador de imágenes de redimensionado configurado en el backend. No se simula la operación."}) };

export const compressImageTool: ToolDefinition = { id:"compress_image",category:"multimedia",description:"Validar una operación de compresión; requiere un procesador de imágenes configurado.",risk:"write",requiresConfirmation:true,supportsAutopilot:false,schema:z.object({image_url:z.string().url(),quality:z.number().int().min(1).max(100).default(80)}),execute:async()=>({success:false,error:"No hay un procesador de imágenes de compresión configurado en el backend. No se simula la operación."}) };

export const generateQrCodeTool: ToolDefinition = { id:"generate_qr_code",category:"multimedia",description:"Generar un QR mediante un servicio externo real.",risk:"write",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({url:z.string().url()}),execute:async({url})=>({success:true,message:"Código QR generado.",data:{url:`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,target:url,provider:"qrserver"}})};

export const multimediaSkill: Skill = { id:"multimedia",name:"Multimedia",category:"multimedia",description:"Imagen, vídeo, audio, OCR, diagramas y generación multimedia con proveedores reales.",tools:[generateImageTool,searchImageTool,generateVideoTool,analyzeImageTool,generateMermaidDiagramTool,generatePodcastScriptTool,describeMathImageTool,textToSpeechTool,transcribeAudioTool,generateInfographicLayoutTool,generateColorPaletteTool,extractColorsFromImageTool,resizeImageTool,compressImageTool,generateQrCodeTool] };
