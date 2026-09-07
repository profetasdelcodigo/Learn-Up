import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { generateFalImage, generateFalVideo } from "@/lib/fal";
import { AI_MODELS } from "@/lib/ai";

async function fetchBinary(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error("La URL multimedia no es válida.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo descargar el recurso multimedia (${response.status}).`);
  const mime = response.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mime };
}

const GEMINI_VISION_MODEL = AI_MODELS.geminiAgentic.id.replace(/^gemini\//, "");

async function geminiVision(url: string, prompt: string) {
  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY/AI_API_KEY no configurada para visión.");
  const { buffer, mime } = await fetchBinary(url);
  if (!mime.startsWith("image/")) throw new Error(`El recurso no es una imagen (${mime}).`);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent`;
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: buffer.toString("base64") } }] }], generationConfig: { responseMimeType: "text/plain" } }) });
  if (!response.ok) throw new Error(`Gemini Vision ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini Vision no devolvió contenido.");
  return text;
}

export const analyzeImageReal: ToolDefinition = {
  id: "analyze_image", category: "multimedia", description: "Analiza una imagen real mediante Gemini Vision.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url(), question: z.string().optional() }),
  execute: async ({ image_url, question }) => ({ success: true, message: "Imagen analizada con Gemini Vision.", data: { analysis: await geminiVision(image_url, question || "Describe con detalle lo que aparece en la imagen, distinguiendo texto visible, objetos, estructura y cualquier incertidumbre."), sources: [{ title: "Imagen analizada", url: image_url }], provider: GEMINI_VISION_MODEL } }),
};

export const describeMathImageReal: ToolDefinition = {
  id: "describe_math_image", category: "multimedia", description: "Extrae y explica un problema matemático visible en una imagen mediante Gemini Vision.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url(), problem_description: z.string().optional() }),
  execute: async ({ image_url, problem_description }) => ({ success: true, message: "Problema matemático extraído de la imagen.", data: { solution_context: await geminiVision(image_url, `Extrae exactamente el problema matemático visible y resuélvelo paso a paso. ${problem_description || "No hay contexto adicional."} No inventes símbolos que no sean visibles.`), sources: [{ title: "Imagen matemática", url: image_url }], provider: GEMINI_VISION_MODEL } }),
};

export const extractColorsReal: ToolDefinition = {
  id: "extract_colors_from_image", category: "multimedia", description: "Identifica colores dominantes de una imagen real mediante visión.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url() }),
  execute: async ({ image_url }) => ({ success: true, message: "Colores extraídos de la imagen.", data: { colors: await geminiVision(image_url, "Identifica hasta 8 colores dominantes. Devuelve para cada uno nombre descriptivo y HEX aproximado. No inventes elementos ausentes."), sources: [{ title: "Imagen analizada", url: image_url }], provider: GEMINI_VISION_MODEL } }),
};

export const textToSpeechReal: ToolDefinition = {
  id: "text_to_speech", category: "multimedia", description: "Genera audio MP3 real con la API de OpenAI si OPENAI_API_KEY está configurada.", risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ text: z.string().min(1).max(10000), voice: z.string().optional().default("alloy"), model: z.string().optional().default("gpt-4o-mini-tts") }),
  execute: async ({ text, voice, model }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { success: false, error: "OPENAI_API_KEY no está configurada; no se fingirá generación TTS." };
    const response = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model, voice, input: text, response_format: "mp3" }) });
    if (!response.ok) throw new Error(`OpenAI TTS ${response.status}: ${await response.text()}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return { success: true, message: "Audio MP3 generado por OpenAI.", data: { base64: buffer.toString("base64"), mimeType: "audio/mpeg", provider: "openai" } };
  },
};

export const transcribeAudioReal: ToolDefinition = {
  id: "transcribe_audio", category: "multimedia", description: "Transcribe audio real mediante Groq Whisper si GROQ_API_KEY está configurada.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ audio_url: z.string().url() }),
  execute: async ({ audio_url }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { success: false, error: "GROQ_API_KEY no está configurada; no se fingirá una transcripción." };
    const { buffer, mime } = await fetchBinary(audio_url);
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mime }), "audio.bin");
    form.append("model", process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo");
    form.append("response_format", "json");
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!response.ok) throw new Error(`Groq transcription ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    const text = String(payload?.text || "").trim();
    if (!text) return { success: false, error: "El proveedor no devolvió una transcripción." };
    return { success: true, message: "Transcripción real recuperada con Groq Whisper.", data: { transcript: text, source: { url: audio_url }, provider: "groq" } };
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

const overrides: Record<string, ToolDefinition> = { analyze_image: analyzeImageReal, describe_math_image: describeMathImageReal, extract_colors_from_image: extractColorsReal, text_to_speech: textToSpeechReal, transcribe_audio: transcribeAudioReal, generate_image: generateImageReal, generate_video: generateVideoReal };

export function withRealMultimediaOverrides(skill: Skill): Skill {
  return { ...skill, tools: skill.tools.map((tool) => overrides[tool.id] || tool) };
}
