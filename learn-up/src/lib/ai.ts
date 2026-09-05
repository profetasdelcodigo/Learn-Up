import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const nvidiaApiKey = process.env.NVIDIA_API_KEY;

export const AI_MODELS = {
  openRouterFree: "openrouter/free",
  openRouterFast: "openrouter/openai/gpt-oss-20b:free",
  openRouterReasoning: "openrouter/openai/gpt-oss-120b:free",
  groqFast: "groq/openai/gpt-oss-20b",
  groqReasoning: "groq/openai/gpt-oss-120b",
  geminiFast: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
  geminiMultimodal: process.env.GEMINI_MULTIMODAL_MODEL || "gemini-3.8-flash",
  nvidiaReasoning: process.env.NVIDIA_REASONING_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
} as const;

export const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
export const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const MAX_HISTORY = 12;
const MAX_CONTEXT_CHARS = 12000;
const MAX_REMOTE_MEDIA_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = Number(process.env.AI_TEXT_TIMEOUT_MS || 30000);
const MULTIMODAL_TIMEOUT_MS = Number(process.env.AI_MULTIMODAL_TIMEOUT_MS || 60000);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms alcanzado.`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }).catch((error) => { clearTimeout(timer); reject(error); });
  });
}

function trimMessages(messages: any[]) {
  const system = messages.find((m) => m.role === "system");
  const rest = messages
    .filter((m) => m.role !== "system")
    .slice(-MAX_HISTORY)
    .map((m) => {
      if (typeof m.content === "string" && m.content.length > MAX_CONTEXT_CHARS) {
        return { ...m, content: `${m.content.slice(0, MAX_CONTEXT_CHARS)}\n...[Contenido truncado por límite de contexto]...` };
      }
      return m;
    });
  return system ? [system, ...rest] : rest;
}

function toTextOnlyMessages(messages: any[]) {
  return trimMessages(messages).map((m) => ({
    role: m.role,
    content: Array.isArray(m.content)
      ? m.content.filter((part: any) => part?.type === "text").map((part: any) => part.text || "").join("\n")
      : m.content,
  }));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeModel(model: string): string {
  const raw = String(model || AI_MODELS.openRouterFree).replace(/::autopilot$/i, "").trim();
  if (!raw || raw === "openrouter/openrouter/free" || raw === "openrouter/free") return AI_MODELS.openRouterFree;
  if (raw.startsWith("openrouter/") || raw.startsWith("groq/") || raw.startsWith("gemini/") || raw.startsWith("nvidia/")) return raw;
  return `openrouter/${raw}`;
}

function providerOf(model: string): "openrouter" | "groq" | "gemini" | "nvidia" {
  if (model.startsWith("groq/")) return "groq";
  if (model.startsWith("gemini/")) return "gemini";
  if (model.startsWith("nvidia/")) return "nvidia";
  return "openrouter";
}

function openRouterModelId(model: string) { return model.replace(/^openrouter\//, ""); }
function groqModelId(model: string) { return model.replace(/^groq\//, ""); }
function geminiModelId(model: string) { return model.replace(/^gemini\//, ""); }
function nvidiaModelId(model: string) { return model.replace(/^nvidia\//, ""); }

async function openRouterCompletion(messages: any[], model: string, jsonMode = false) {
  if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY no configurada.");
  const request = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterApiKey}`, "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://learn-up-qmgx.onrender.com", "X-Title": "Learn Up" },
    body: JSON.stringify({ model: openRouterModelId(model), messages: trimMessages(messages), max_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 4096), temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }),
  });
  const body = await request.text();
  if (!request.ok) throw new Error(`OpenRouter ${request.status}: ${body}`);
  const data = JSON.parse(body);
  if (!data?.choices?.[0]?.message) throw new Error("OpenRouter devolvió una respuesta sin mensaje.");
  return data;
}

async function groqCompletion(messages: any[], model: string, jsonMode = false) {
  if (!groqApiKey) throw new Error("GROQ_API_KEY no configurada.");
  const request = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify({ model: groqModelId(model), messages: toTextOnlyMessages(messages), max_completion_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 4096), temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }),
  });
  const body = await request.text();
  if (!request.ok) throw new Error(`Groq ${request.status}: ${body}`);
  return JSON.parse(body);
}

async function nvidiaCompletion(messages: any[], model: string, jsonMode = false) {
  if (!nvidiaApiKey) throw new Error("NVIDIA_API_KEY no configurada.");
  const request = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${nvidiaApiKey}` },
    body: JSON.stringify({ model: nvidiaModelId(model), messages: toTextOnlyMessages(messages), max_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 4096), temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }),
  });
  const body = await request.text();
  if (!request.ok) throw new Error(`NVIDIA ${request.status}: ${body}`);
  return JSON.parse(body);
}

async function fetchRemoteMediaBuffer(rawUrl: string): Promise<{ buffer: Buffer; mimeType: string; urlLower: string }> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Solo se permiten archivos HTTPS para análisis multimodal.");
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  if (configured && url.hostname !== configured && !url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".supabase.in")) throw new Error("La URL del archivo no pertenece a un almacenamiento permitido.");
  const response = await fetchWithTimeout(rawUrl, { cache: "no-store" }, MULTIMODAL_TIMEOUT_MS);
  if (!response.ok) throw new Error(`No se pudo descargar el archivo (${response.status}).`);
  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_REMOTE_MEDIA_BYTES) throw new Error("El archivo adjunto excede 25 MB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_MEDIA_BYTES) throw new Error("El archivo adjunto excede 25 MB.");
  return { buffer, mimeType: response.headers.get("content-type") || "application/octet-stream", urlLower: rawUrl.split("?")[0].toLowerCase() };
}

async function extractDocumentText(buffer: Buffer, urlLower: string, mimeType: string): Promise<string> {
  if (mimeType.startsWith("text/") || /\.(txt|md|csv|json|xml|html|css|js|ts|py|java|c|cpp)$/i.test(urlLower)) return buffer.toString("utf-8");
  if (mimeType === "application/pdf" || urlLower.endsWith(".pdf")) {
    const mod = (await import("pdf-parse")) as any;
    const parser = mod.default || mod;
    const parsed = await parser(buffer);
    return parsed.text || "";
  }
  if (/\.(docx|doc|pptx|xlsx|odt|odp|ods|rtf)$/i.test(urlLower)) {
    const { parseOffice } = await import("officeparser");
    const parsed = await parseOffice(buffer, { ignoreNotes: false });
    return typeof parsed === "string" ? parsed : "";
  }
  throw new Error("Tipo de archivo no soportado para extracción de texto.");
}

async function geminiCompletion(messages: any[], model: string, jsonMode = false) {
  if (!geminiApiKey || !genAI) throw new Error("GEMINI_API_KEY no configurada.");
  const modelId = geminiModelId(model);
  const system = trimMessages(messages).find((m) => m.role === "system");
  const other = trimMessages(messages).filter((m) => m.role !== "system");
  const generative = genAI.getGenerativeModel({ model: modelId, systemInstruction: typeof system?.content === "string" ? system.content : undefined });
  const contents = await Promise.all(other.map(async (message) => {
    const parts = Array.isArray(message.content)
      ? await Promise.all(message.content.map(async (part: any) => {
          if (part?.type === "text") return { text: String(part.text || "") };
          if (part?.type === "image_url" || part?.type === "file_url") {
            const url = part.type === "image_url" ? part.image_url?.url : part.file_url?.url;
            if (!url) return { text: "" };
            const { buffer, mimeType, urlLower } = await fetchRemoteMediaBuffer(url);
            if (mimeType.startsWith("image/") || mimeType === "application/pdf" || /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(urlLower)) return { inlineData: { data: buffer.toString("base64"), mimeType: mimeType === "application/octet-stream" ? "image/jpeg" : mimeType } };
            const text = await extractDocumentText(buffer, urlLower, mimeType);
            return { text: `[Contenido del archivo adjunto]\n${text}` };
          }
          return { text: "" };
        }))
      : [{ text: String(message.content || "") }];
    return { role: message.role === "assistant" ? "model" : "user", parts };
  }));
  const result = await withTimeout(generative.generateContent({ contents, generationConfig: { responseMimeType: jsonMode ? "application/json" : "text/plain", temperature: 0.7, maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 4096) } }), MULTIMODAL_TIMEOUT_MS);
  return { choices: [{ message: { content: result.response.text() } }] };
}

export async function getAICompletion(messages: any[], modelName: string = AI_MODELS.openRouterFree, jsonMode = false) {
  const model = normalizeModel(modelName);
  const provider = providerOf(model);
  if (provider === "openrouter") return openRouterCompletion(messages, model, jsonMode);
  if (provider === "groq") return groqCompletion(messages, model, jsonMode);
  if (provider === "gemini") return geminiCompletion(messages, model, jsonMode);
  return nvidiaCompletion(messages, model, jsonMode);
}

export async function getNvidiaNIMCompletion(messages: any[], modelName: string = AI_MODELS.nvidiaReasoning, jsonMode = false) {
  return nvidiaCompletion(messages, normalizeModel(modelName), jsonMode);
}

export const getGroqCompletion = async (messages: any[], modelName: string = AI_MODELS.groqFast, jsonMode = false) => groqCompletion(messages, normalizeModel(modelName), jsonMode);
export const getGeminiCompletion = async (messages: any[], modelName: string = AI_MODELS.geminiFast, jsonMode = false) => geminiCompletion(messages, normalizeModel(modelName), jsonMode);

export async function getAIEmbedding(text: string): Promise<number[]> {
  if (!genAI) throw new Error("Gemini AI no está configurado para embeddings.");
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await withTimeout(model.embedContent({ content: { role: "user", parts: [{ text }] } } as any), TIMEOUT_MS);
  return result.embedding.values;
}

export const fetchRemoteMediaBufferForAI = fetchRemoteMediaBuffer;
export const extractDocumentTextForAI = extractDocumentText;
// Backward-compatible exports for existing callers/tests.
export { fetchRemoteMediaBuffer, extractDocumentText };
