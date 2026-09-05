import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { browseWebPage } from "@/lib/browser-act";
import { searchTavily } from "@/lib/web-search";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

async function geminiVision(imageUrl: string, prompt: string) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY.");
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await response.arrayBuffer());
  const api = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }] }], generationConfig: { responseMimeType: "text/plain" } }),
  });
  if (!api.ok) throw new Error(`Gemini Vision ${api.status}: ${await api.text()}`);
  const data = await api.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini Vision no devolvió contenido.");
  return text;
}

async function generateWithEvidence(prompt: string) {
  const { getAICompletion } = await import("@/lib/ai");
  const response = await getAICompletion([{ role: "user", content: prompt }], "gemini-3.8-flash");
  const content = response?.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("El modelo no devolvió contenido.");
  return content;
}

async function browseMany(urls: string[]) {
  const unique = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))];
  const results = await Promise.allSettled(unique.map((url) => browseWebPage(url)));
  return results.map((item, index) => item.status === "fulfilled" && item.value?.success
    ? { url: unique[index], title: item.value.title || unique[index], content: String(item.value.content || "").slice(0, 8000) }
    : null).filter(Boolean) as { url: string; title: string; content: string }[];
}

export const createPollToolReal: ToolDefinition = {
  id: "create_poll", category: "chat", description: "Crear una encuesta real en un grupo con opciones almacenadas en el mensaje.", risk: "write", requiresConfirmation: true, supportsAutopilot: true,
  schema: z.object({ room_id: z.string().uuid(), question: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(10) }),
  execute: async ({ room_id, question, options }) => {
    const { supabase, user } = await currentUser();
    const { data: room, error: roomError } = await supabase.from("chat_rooms").select("id,participants").eq("id", room_id).single();
    if (roomError) throw roomError;
    if (!room) throw new Error("Sala no encontrada.");
    const participants = Array.isArray(room.participants) ? room.participants : [];
    if (!participants.includes(user.id)) throw new Error("No perteneces a esta sala.");
    const metadata = { type: "poll", question, options, votes: {}, created_by: user.id };
    const { data, error } = await supabase.from("chat_messages").insert({ room_id, user_id: user.id, content: question, metadata }).select("id,room_id,user_id,content,metadata,created_at").single();
    if (error) throw error;
    return { success: true, message: "Encuesta creada y guardada en el chat.", data: { message: data } };
  },
};

export const createDocumentCollectionToolReal: ToolDefinition = {
  id: "create_document_collection", category: "library", description: "Crear una colección temática real y asociar documentos del usuario.", risk: "write", requiresConfirmation: true, supportsAutopilot: true,
  schema: z.object({ name: z.string().min(1).max(120), document_ids: z.array(z.string().uuid()).default([]) }),
  execute: async ({ name, document_ids }) => {
    const { supabase, user } = await currentUser();
    const { data: collection, error } = await supabase.from("document_collections").insert({ user_id: user.id, name }).select("id,name,created_at").single();
    if (error) throw error;
    if (document_ids.length) {
      const { data: docs, error: docsError } = await supabase.from("ai_documents").select("id").eq("user_id", user.id).in("id", document_ids);
      if (docsError) throw docsError;
      const validIds = (docs || []).map((doc: any) => doc.id);
      if (validIds.length) {
        const { error: itemError } = await supabase.from("document_collection_items").insert(validIds.map((documentId: string) => ({ collection_id: collection.id, document_id: documentId })));
        if (itemError) throw itemError;
      }
    }
    return { success: true, message: `Colección '${name}' creada.`, data: { collection_id: collection.id, document_count: document_ids.length } };
  },
};

export const extractTextFromImageToolReal: ToolDefinition = {
  id: "extract_text_from_image", category: "library", description: "Extraer texto real de una imagen mediante Gemini Vision.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url() }),
  execute: async ({ image_url }) => ({ success: true, message: "Texto extraído mediante Gemini Vision.", data: { text: await geminiVision(image_url, "Extrae el texto visible de esta imagen con la mayor fidelidad posible. No inventes palabras.") , source: { url: image_url }, provider: "gemini-3.8-flash" } }),
};

export const analyzeSourceCredibilityToolReal: ToolDefinition = {
  id: "analyze_source_credibility", category: "library", description: "Analizar credibilidad usando contenido web recuperado y criterios explícitos.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    const page = await browseWebPage(url);
    if (!page.success) return { success: false, error: String(page.content) };
    const analysis = await generateWithEvidence(["Analiza exclusivamente la evidencia recuperada.", `URL: ${url}`, `Título: ${page.title || ""}`, `Contenido:\n${String(page.content || "").slice(0,12000)}`, "Evalúa autoría, fecha, institución, evidencia, posibles sesgos y limitaciones. No inventes datos ausentes."].join("\n"));
    return { success: true, message: "Credibilidad analizada con contenido web real.", data: { url, title: page.title || url, analysis, sources: [{ url, title: page.title || url }] } };
  },
};

export const compareMultipleSourcesToolReal: ToolDefinition = {
  id: "compare_multiple_sources", category: "research", description: "Abrir varias fuentes reales y compararlas usando la evidencia recuperada.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ urls: z.array(z.string().url()).min(2).max(12), topic: z.string().optional() }),
  execute: async ({ urls, topic }) => {
    const evidence = await browseMany(urls);
    if (!evidence.length) return { success: false, error: "No se pudo extraer contenido verificable de las URLs proporcionadas.", data: { requested: urls } };
    const comparison = await generateWithEvidence(`Compara estas fuentes exclusivamente con la evidencia incluida. No inventes datos ni cites páginas que no aparezcan aquí. Tema: ${topic || "comparación de fuentes"}. Señala coincidencias, diferencias, limitaciones y qué fuente respalda cada afirmación.\n\nEVIDENCIA:\n${JSON.stringify(evidence)}`);
    return { success: true, message: `Comparación realizada con ${evidence.length} fuentes extraídas.`, data: { comparison, sources: evidence.map((x) => ({ title: x.title, url: x.url })), evidenceCount: evidence.length } };
  },
};

export const deepResearchToolReal: ToolDefinition = {
  id: "deep_research", category: "research", description: "Investigación iterativa multi-fuente con búsquedas y extracción reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ topic: z.string().min(1), depth: z.enum(["basic","moderate","deep"]).default("moderate") }),
  execute: async ({ topic, depth }) => {
    const rounds = depth === "deep" ? 2 : 1;
    const gathered: { title: string; url: string; content: string }[] = [];
    for (let round = 0; round < rounds; round += 1) {
      const query = round === 0 ? topic : `${topic} perspectivas evidencia fuentes académicas críticas`;
      const results = await searchTavily(query, depth === "deep" ? 8 : 6);
      const urls = (results || []).map((r:any) => r?.url).filter(Boolean);
      const evidence = await browseMany(urls);
      gathered.push(...evidence);
    }
    const unique = [...new Map(gathered.map((x) => [x.url, x])).values()];
    if (!unique.length) return { success:false,error:"La investigación no obtuvo evidencia web verificable." };
    const content = await generateWithEvidence(`Realiza una investigación sobre "${topic}" usando exclusivamente la evidencia recuperada. No inventes cifras, autores ni fuentes. Indica incertidumbres.\n\nEVIDENCIA:\n${JSON.stringify(unique)}`);
    return { success:true,message:`Investigación completada con ${unique.length} fuentes extraídas.`,data:{content,sources:unique.map((x)=>({title:x.title,url:x.url})),evidenceCount:unique.length,rounds,provider:"tavily+browse_web+gemini-3.8-flash"} };
  },
};

export const findSimilarPapersToolReal: ToolDefinition = {
  id:"find_similar_papers",category:"research",description:"Buscar papers relacionados mediante Semantic Scholar y devolver resultados verificables.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({paper_id:z.string().min(1),limit:z.number().int().min(1).max(10).default(5)}),
  execute:async({paper_id,limit})=>{const url=`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(paper_id)}&limit=${limit}&fields=title,authors,year,url,abstract`;const res=await fetch(url);if(!res.ok)throw new Error(`Semantic Scholar ${res.status}: ${await res.text()}`);const json=await res.json();const papers=json.data||[];return{success:true,message:`Se encontraron ${papers.length} papers relacionados mediante búsqueda semántica.`,data:{papers,sources:[{title:"Semantic Scholar API",url}]}};},
};

export const generateLiteratureReviewToolReal: ToolDefinition = {
  id:"generate_literature_review",category:"research",description:"Generar revisión bibliográfica usando papers recuperados realmente.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({topic:z.string().min(1),limit:z.number().int().min(3).max(12).default(8)}),
  execute:async({topic,limit})=>{const apiUrl=`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=${limit}&fields=title,authors,year,url,abstract`;const res=await fetch(apiUrl);if(!res.ok)throw new Error(`Semantic Scholar ${res.status}: ${await res.text()}`);const json=await res.json();const papers=(json.data||[]).filter((p:any)=>p?.title);if(!papers.length)return{success:false,error:"No se encontraron papers verificables para la revisión."};const evidence=await browseMany(papers.map((p:any)=>p.url).filter(Boolean));const promptEvidence={papers:evidence.length?evidence:papers.map((p:any)=>({title:p.title,url:p.url||apiUrl,content:p.abstract||""}))};const review=await generateWithEvidence(`Escribe una revisión bibliográfica sobre "${topic}" exclusivamente a partir de los papers y abstracts proporcionados. No inventes autores, cifras o estudios. Señala qué afirmaciones provienen de qué fuente.\n\n${JSON.stringify(promptEvidence)}`);return{success:true,message:`Revisión generada con ${papers.length} papers recuperados.`,data:{review,sources:[{title:"Semantic Scholar API",url:apiUrl},...evidence.map((x)=>({title:x.title,url:x.url}))],paperCount:papers.length}};},
};

export const searchYoutubeTranscriptsToolReal: ToolDefinition = {
  id:"search_youtube_transcripts",category:"research",description:"Extraer la transcripción real de un video de YouTube.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({video_url:z.string().url()}),
  execute:async({video_url})=>{if(!/youtube\.com|youtu\.be/i.test(video_url))return{success:false,error:"La URL no parece pertenecer a YouTube."};const{YoutubeTranscript}=await import("youtube-transcript");const transcript=await YoutubeTranscript.fetchTranscript(video_url);const text=transcript.map((part:any)=>part.text).join(" ").trim();if(!text)return{success:false,error:"YouTube no devolvió transcripción para este video."};return{success:true,message:"Transcripción de YouTube recuperada.",data:{transcript:text,source:{url:video_url},provider:"youtube-transcript"}};},
};

export function withRealSkillOverrides(skill: Skill): Skill {
  if (skill.id === "chat") return { ...skill, tools: skill.tools.map((tool) => tool.id === "create_poll" ? createPollToolReal : tool) };
  if (skill.id === "library") return { ...skill, tools: skill.tools.map((tool) => { if(tool.id === "create_document_collection") return createDocumentCollectionToolReal; if(tool.id === "extract_text_from_image") return extractTextFromImageToolReal; if(tool.id === "analyze_source_credibility") return analyzeSourceCredibilityToolReal; return tool; }) };
  if (skill.id === "research") return { ...skill, tools: skill.tools.map((tool) => { if(tool.id === "compare_multiple_sources") return compareMultipleSourcesToolReal; if(tool.id === "deep_research") return deepResearchToolReal; if(tool.id === "find_similar_papers") return findSimilarPapersToolReal; if(tool.id === "generate_literature_review") return generateLiteratureReviewToolReal; if(tool.id === "search_youtube_transcripts") return searchYoutubeTranscriptsToolReal; return tool; }) };
  return skill;
}
