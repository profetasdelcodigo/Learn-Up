import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { generateFalImage, generateFalVideo } from "@/lib/fal";
import { getAICompletion, AI_MODELS } from "@/lib/ai";
import { fetchTranscript } from "youtube-transcript";

async function fetchBinary(url: string) {
  if (!/^https:\/\//i.test(url)) throw new Error("La URL multimedia debe usar HTTPS.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo descargar el recurso multimedia (${response.status}).`);
  const mime = response.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 25 * 1024 * 1024) throw new Error("El recurso excede 25 MB.");
  return { buffer, mime };
}

const VISION_MODEL = AI_MODELS.geminiFast.id;

async function visionViaOpenRouter(url: string, prompt: string) {
  const { mime } = await fetchBinary(url);
  if (!mime.startsWith("image/")) throw new Error(`El recurso no es una imagen (${mime}).`);
  const result = await getAICompletion([{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url } }] }], VISION_MODEL);
  const text = String(result?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("El modelo de visión no devolvió contenido.");
  return text;
}

export const analyzeImageReal: ToolDefinition = {
  id: "analyze_image", category: "multimedia", description: "Analiza una imagen real con un modelo multimodal gratuito de OpenRouter.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url(), question: z.string().optional() }),
  execute: async ({ image_url, question }) => ({ success: true, message: "Imagen analizada.", data: { analysis: await visionViaOpenRouter(image_url, question || "Describe con detalle lo que aparece en la imagen, separando texto visible, objetos, estructura y cualquier incertidumbre."), sources: [{ title: "Imagen analizada", url: image_url }], provider: VISION_MODEL } }),
};

export const describeMathImageReal: ToolDefinition = {
  id: "describe_math_image", category: "multimedia", description: "Extrae y explica un problema matemático visible en una imagen.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url(), problem_description: z.string().optional() }),
  execute: async ({ image_url, problem_description }) => ({ success: true, message: "Problema matemático extraído de la imagen.", data: { solution_context: await visionViaOpenRouter(image_url, `Extrae exactamente el problema matemático visible y resuélvelo paso a paso. ${problem_description || "No hay contexto adicional."} No inventes símbolos que no sean visibles.`), sources: [{ title: "Imagen matemática", url: image_url }], provider: VISION_MODEL } }),
};

export const extractColorsReal: ToolDefinition = {
  id: "extract_colors_from_image", category: "multimedia", description: "Identifica colores dominantes de una imagen real mediante visión multimodal.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url() }),
  execute: async ({ image_url }) => ({ success: true, message: "Colores extraídos de la imagen.", data: { colors: await visionViaOpenRouter(image_url, "Identifica hasta 8 colores dominantes. Para cada uno entrega nombre descriptivo y HEX aproximado. Indica que son aproximaciones visuales."), sources: [{ title: "Imagen analizada", url: image_url }], provider: VISION_MODEL } }),
};

export const textToSpeechReal: ToolDefinition = {
  id: "text_to_speech", category: "multimedia", description: "Genera audio MP3 únicamente cuando un proveedor TTS configurado esté disponible.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ text: z.string().min(1).max(10000), voice: z.string().optional().default("alloy"), model: z.string().optional().default("tts-1") }),
  execute: async ({ text, voice, model }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { success: false, error: "No hay un proveedor TTS configurado. No se simula audio." };
    const response = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model, voice, input: text, response_format: "mp3" }) });
    if (!response.ok) throw new Error(`Proveedor TTS ${response.status}: ${await response.text()}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return { success: true, message: "Audio MP3 generado.", data: { base64: buffer.toString("base64"), mimeType: "audio/mpeg", provider: "configured_tts" } };
  },
};

export const transcribeAudioReal: ToolDefinition = {
  id: "transcribe_audio", category: "multimedia", description: "Transcribe audio cuando exista un proveedor STT configurado.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ audio_url: z.string().url() }),
  execute: async ({ audio_url }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { success: false, error: "No hay un proveedor STT configurado. No se simula una transcripción." };
    const { buffer, mime } = await fetchBinary(audio_url);
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mime }), "audio.bin");
    form.append("model", process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo");
    form.append("response_format", "json");
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!response.ok) throw new Error(`Proveedor STT ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    const text = String(payload?.text || "").trim();
    if (!text) return { success: false, error: "El proveedor no devolvió una transcripción." };
    return { success: true, message: "Transcripción recuperada.", data: { transcript: text, source: { url: audio_url }, provider: "configured_stt" } };
  },
};

export const generateImageReal: ToolDefinition = {
  id: "generate_image", category: "multimedia", description: "Genera una imagen real mediante Fal.ai.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ prompt: z.string().min(1), purpose: z.string().optional() }),
  execute: async ({ prompt }) => { const url = await generateFalImage(prompt); return { success: true, message: "Imagen generada con Fal.ai.", data: { url, provider: "fal.ai" } }; },
};

export const generateVideoReal: ToolDefinition = {
  id: "generate_video", category: "multimedia", description: "Genera un vídeo real mediante Fal.ai.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ prompt: z.string().min(1), purpose: z.string().optional() }),
  execute: async ({ prompt }) => { const url = await generateFalVideo(prompt); return { success: true, message: "Vídeo generado con Fal.ai.", data: { url, provider: "fal.ai" } }; },
};

function videoId(url: string) {
  const parsed = new URL(url);
  const id = parsed.searchParams.get("v") || (parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.pathname.match(/(?:shorts|embed)\/([^/?]+)/)?.[1]);
  if (!id) throw new Error("No se pudo identificar el video de YouTube.");
  return id;
}

export const searchYoutubeVideoReal: ToolDefinition = {
  id: "search_youtube_video", category: "multimedia", description: "Busca vídeos de YouTube con resultados web trazables.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(10).default(5) }),
  execute: async ({ query, limit }) => {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return { success: false, error: "TAVILY_API_KEY no configurada." };
    const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: key, query: `${query} site:youtube.com`, search_depth: "advanced", max_results: limit }) });
    if (!response.ok) throw new Error(`Tavily ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    return { success: true, message: `Encontré ${(payload.results || []).length} vídeos candidatos.`, data: { results: (payload.results || []).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content })) } };
  },
};

export const youtubeTranscriptReal: ToolDefinition = {
  id: "search_youtube_transcripts", category: "multimedia", description: "Obtiene la transcripción pública disponible de un vídeo de YouTube.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ url: z.string().url(), language: z.string().optional() }),
  execute: async ({ url, language }) => {
    const transcript = await fetchTranscript(videoId(url), language ? { lang: language } as any : undefined);
    const text = transcript.map((item: any) => item.text).join(" ");
    return { success: true, message: "Transcripción de YouTube recuperada.", data: { videoId: videoId(url), language: language || null, text, segments: transcript } };
  },
};

export const subtitleSrtReal: ToolDefinition = {
  id: "generate_srt", category: "multimedia", description: "Genera SRT a partir de segmentos con tiempos reales de una transcripción.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ url: z.string().url(), language: z.string().optional() }),
  execute: async ({ url, language }) => {
    const transcript = await fetchTranscript(videoId(url), language ? { lang: language } as any : undefined);
    const fmt = (seconds: number) => { const ms = Math.max(0, Math.round(seconds * 1000)); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000); const milli = ms % 1000; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(milli).padStart(3,"0")}`; };
    const srt = transcript.map((item: any, i: number) => `${i+1}\n${fmt(Number(item.offset || item.start || 0))} --> ${fmt(Number(item.offset || item.start || 0) + Number(item.duration || 0))}\n${String(item.text || "").trim()}\n`).join("\n");
    return { success: true, message: "Subtítulos SRT generados.", data: { srt, videoId: videoId(url), segments: transcript.length } };
  },
};

export const generateThumbnailReal: ToolDefinition = {
  id: "generate_thumbnail", category: "multimedia", description: "Genera una miniatura real con el generador de imagen configurado.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ topic: z.string().min(1), text: z.string().max(120).optional() }),
  execute: async ({ topic, text }) => { const url = await generateFalImage(`Miniatura educativa moderna para: ${topic}. ${text ? `Texto corto visible: ${text}.` : "Sin texto superpuesto."} Composición 16:9, alto contraste y legibilidad.`); return { success: true, message: "Miniatura generada.", data: { url, topic } }; },
};

export const scientificImageSearchReal: ToolDefinition = {
  id: "search_scientific_images", category: "multimedia", description: "Busca imágenes científicas en Wikimedia Commons mediante su API pública.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(12).default(8) }),
  execute: async ({ query, limit }) => {
    const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: String(limit), prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900", format: "json", origin: "*" });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
    if (!response.ok) throw new Error(`Wikimedia Commons ${response.status}.`);
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {}) as any[];
    return { success: true, message: `Encontré ${pages.length} imágenes.`, data: { images: pages.map((p: any) => ({ title: p.title, url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url, sourceUrl: p.imageinfo?.[0]?.descriptionurl, license: p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value || null })) } };
  },
};

export const aiProfileAvatarReal: ToolDefinition = {
  id: "generate_ai_profile_avatar", category: "multimedia", description: "Genera un avatar ilustrado mediante el generador real de imágenes.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ style: z.string().min(1).default("ilustración educativa"), prompt: z.string().min(1).max(500) }),
  execute: async ({ style, prompt }) => { const url = await generateFalImage(`Avatar de perfil ${style}. ${prompt}. Retrato cuadrado, limpio, apropiado para una plataforma educativa.`); return { success: true, message: "Avatar generado.", data: { url, style } }; },
};

export const resizeImageReal: ToolDefinition = {
  id: "resize_image", category: "multimedia", description: "Redimensiona una imagen usando un servicio de transformación HTTP real.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ image_url: z.string().url(), width: z.number().int().positive().max(10000), height: z.number().int().positive().max(10000) }),
  execute: async ({ image_url, width, height }) => ({ success: true, message: "URL de imagen redimensionada preparada.", data: { url: `https://images.weserv.nl/?url=${encodeURIComponent(image_url)}&w=${width}&h=${height}&fit=cover`, width, height, provider: "images.weserv.nl" } }),
};

export const compressImageReal: ToolDefinition = {
  id: "compress_image", category: "multimedia", description: "Entrega una URL real de transformación para reducir peso/calidad de una imagen.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ image_url: z.string().url(), quality: z.number().int().min(1).max(100).default(75) }),
  execute: async ({ image_url, quality }) => ({ success: true, message: "URL de imagen comprimida preparada.", data: { url: `https://images.weserv.nl/?url=${encodeURIComponent(image_url)}&q=${quality}`, quality, provider: "images.weserv.nl" } }),
};

const extras: ToolDefinition[] = [searchYoutubeVideoReal, youtubeTranscriptReal, subtitleSrtReal, generateThumbnailReal, scientificImageSearchReal, aiProfileAvatarReal, resizeImageReal, compressImageReal];
const overrides: Record<string, ToolDefinition> = { analyze_image: analyzeImageReal, describe_math_image: describeMathImageReal, extract_colors_from_image: extractColorsReal, text_to_speech: textToSpeechReal, transcribe_audio: transcribeAudioReal, generate_image: generateImageReal, generate_video: generateVideoReal, search_scientific_images: scientificImageSearchReal, generate_thumbnail: generateThumbnailReal, generate_srt: subtitleSrtReal, search_youtube_transcripts: youtubeTranscriptReal, search_youtube_video: searchYoutubeVideoReal, generate_ai_profile_avatar: aiProfileAvatarReal, resize_image: resizeImageReal, compress_image: compressImageReal };

export function withRealMultimediaOverrides(skill: Skill): Skill {
  const tools = skill.tools.map((tool) => overrides[tool.id] || tool);
  for (const tool of extras) if (!tools.some((candidate) => candidate.id === tool.id)) tools.push(tool);
  return { ...skill, tools };
}
