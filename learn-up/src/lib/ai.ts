import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { AI_FALLBACK_CHAIN, AI_MODELS, AI_REASONING_CHAIN, PROVIDER_LABELS, providerOfModel, findAIModel } from "@/lib/ai/model-catalog";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const nvidiaApiKey = process.env.NVIDIA_API_KEY;

export { AI_MODELS };
export const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
export const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const MAX_REMOTE_MEDIA_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = Number(process.env.AI_TEXT_TIMEOUT_MS || 15000);
const MULTIMODAL_TIMEOUT_MS = Number(process.env.AI_MULTIMODAL_TIMEOUT_MS || 30000);
const CONFIGURED_MAX_OUTPUT = Number(process.env.AI_MAX_OUTPUT_TOKENS || 0);
const PROVIDER_RETRIES = Math.max(0, Number(process.env.AI_PROVIDER_RETRIES || 2));
const RETRY_BASE_MS = Math.max(100, Number(process.env.AI_RETRY_BASE_MS || 750));
const MAX_PROVIDER_ATTEMPTS = Math.max(1, Number(process.env.AI_MAX_PROVIDER_ATTEMPTS || 8));

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms alcanzado.`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }).catch((error) => { clearTimeout(timer); reject(error); });
  });
}

function trimMessages(messages: any[]) { return messages; }
function toTextOnlyMessages(messages: any[]) { return trimMessages(messages).map((m) => ({ role: m.role, content: Array.isArray(m.content) ? m.content.filter((part: any) => part?.type === "text").map((part: any) => part.text || "").join("\n") : m.content })); }

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

const MODEL_ALIASES: Record<string, string> = {
  "openrouter/free": AI_MODELS.openRouterFree.id,
  "openrouter/openrouter/free": AI_MODELS.openRouterFree.id,
  "openrouter/openai/gpt-oss-120b:free": AI_MODELS.nexProFree.id,
  "openrouter/openai/gpt-oss-20b:free": AI_MODELS.nexMiniFree.id,
  "openai/gpt-oss-120b:free": AI_MODELS.nexProFree.id,
  "openai/gpt-oss-20b:free": AI_MODELS.nexMiniFree.id,
  "gemini-3.5-flash": AI_MODELS.geminiLegacy.id,
  "gemini-3.6-flash": AI_MODELS.geminiBalanced.id,
  "gemini-3.7-flash": AI_MODELS.geminiAgentic.id,
  "gemini-3.8-flash": AI_MODELS.geminiFast.id,
  "groq/llama-3.3-70b-versatile": AI_MODELS.groqFast.id,
  "llama-3.3-70b-versatile": AI_MODELS.groqFast.id,
  "nvidia/nemotron-3-ultra-550b-a55b": AI_MODELS.nvidiaSuper.id,
  "openrouter/nvidia/nemotron-3-ultra-550b-a55b": AI_MODELS.nvidiaSuper.id,
};

function coerceModelId(model: unknown): string {
  if (typeof model === "string") return model.trim();
  if (Array.isArray(model)) {
    for (const item of model) {
      const value = coerceModelId(item);
      if (value) return value;
    }
    return "";
  }
  if (model && typeof model === "object") {
    const candidate = model as Record<string, unknown>;
    for (const key of ["id", "model", "modelId", "value"]) {
      const value = coerceModelId(candidate[key]);
      if (value) return value;
    }
  }
  return "";
}

function normalizeModel(model: unknown): string {
  const extracted = coerceModelId(model);
  const raw = (extracted || AI_MODELS.openRouterFree.id).replace(/::autopilot$/i, "").trim();
  if (MODEL_ALIASES[raw]) return MODEL_ALIASES[raw];
  const catalog = findAIModel(raw);
  if (catalog) return catalog.id;
  // Bloqueo de seguridad: cualquier ID desconocido/antiguo/de pago termina en un modelo gratuito.
  return AI_MODELS.openRouterFree.id;
}

function providerOf(model: unknown) { return providerOfModel(normalizeModel(model)); }
function openRouterModelId(model: string) { return model.replace(/^openrouter\//, ""); }
function groqModelId(model: string) { return model.replace(/^groq\//, ""); }
function geminiModelId(model: string) { return model.replace(/^gemini\//, ""); }
function nvidiaModelId(model: string) { return model.replace(/^nvidia\//, ""); }

function maxOutputTokensForModel(model: string): number {
  const catalogModel = findAIModel(model);
  const providerMax = catalogModel?.maxOutputTokens || 65_536;
  return CONFIGURED_MAX_OUTPUT > 0 ? Math.min(CONFIGURED_MAX_OUTPUT, providerMax) : providerMax;
}

async function openRouterCompletion(messages: any[], model: string, jsonMode = false) {
  if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY no configurada.");
  const request = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterApiKey}`, "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://learn-up-qmgx.onrender.com", "X-Title": "Learn Up" },
    body: JSON.stringify({ model: openRouterModelId(model), messages: trimMessages(messages), max_tokens: maxOutputTokensForModel(model), temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }),
  });
  const body = await request.text();
  if (!request.ok) throw new Error(`OpenRouter ${request.status}: ${body}`);
  const data = JSON.parse(body);
  if (!data?.choices?.[0]?.message) throw new Error("OpenRouter devolvió una respuesta sin mensaje.");
  return data;
}

async function groqCompletion(messages: any[], model: string, jsonMode = false) {
  if (!groqApiKey) throw new Error("GROQ_API_KEY no configurada.");
  const request = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` }, body: JSON.stringify({ model: groqModelId(model), messages: toTextOnlyMessages(messages), max_completion_tokens: maxOutputTokensForModel(model), temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }) });
  const body = await request.text();
  if (!request.ok) throw new Error(`Groq ${request.status}: ${body}`);
  return JSON.parse(body);
}

async function nvidiaCompletion(messages: any[], model: string, jsonMode = false) {
  if (!nvidiaApiKey) throw new Error("NVIDIA_API_KEY no configurada.");
  const request = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${nvidiaApiKey}` }, body: JSON.stringify({ model: nvidiaModelId(model), messages: toTextOnlyMessages(messages), max_tokens: maxOutputTokensForModel(model), temperature: 1.0, top_p: 0.95, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }) });
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
  if (mimeType === "application/pdf" || urlLower.endsWith(".pdf")) { const mod = (await import("pdf-parse")) as any; const parser = mod.default || mod; const parsed = await parser(buffer); return parsed.text || ""; }
  if (/\.(docx|doc|pptx|xlsx|odt|odp|ods|rtf)$/i.test(urlLower)) { const { parseOffice } = await import("officeparser"); const parsed = await parseOffice(buffer, { ignoreNotes: false }); return typeof parsed === "string" ? parsed : ""; }
  throw new Error("Tipo de archivo no soportado para extracción de texto.");
}

async function geminiCompletion(messages: any[], model: string, jsonMode = false) {
  if (!geminiApiKey || !genAI) throw new Error("GEMINI_API_KEY no configurada.");
  const cleaned = trimMessages(messages);
  const system = cleaned.find((m) => m.role === "system");
  const other = cleaned.filter((m) => m.role !== "system");
  const generative = genAI.getGenerativeModel({ model: geminiModelId(model), systemInstruction: typeof system?.content === "string" ? system.content : undefined });
  const contents = await Promise.all(other.map(async (message) => {
    const parts = Array.isArray(message.content) ? await Promise.all(message.content.map(async (part: any) => {
      if (part?.type === "text") return { text: String(part.text || "") };
      if (part?.type === "image_url" || part?.type === "file_url") {
        const url = part.type === "image_url" ? part.image_url?.url : part.file_url?.url;
        if (!url) return { text: "" };
        const { buffer, mimeType, urlLower } = await fetchRemoteMediaBuffer(url);
        if (mimeType.startsWith("image/") || mimeType === "application/pdf" || /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(urlLower)) return { inlineData: { data: buffer.toString("base64"), mimeType: mimeType === "application/octet-stream" ? "image/jpeg" : mimeType } };
        return { text: `[Contenido del archivo adjunto]\n${await extractDocumentText(buffer, urlLower, mimeType)}` };
      }
      return { text: "" };
    })) : [{ text: String(message.content || "") }];
    return { role: message.role === "assistant" ? "model" : "user", parts };
  }));
  const generationConfig: any = { maxOutputTokens: maxOutputTokensForModel(model) };
  if (jsonMode) generationConfig.responseMimeType = "application/json";
  const result = await withTimeout(generative.generateContent({ contents, generationConfig }), MULTIMODAL_TIMEOUT_MS);
  return { choices: [{ message: { content: result.response.text() } }] };
}

function providerAvailable(_provider: ReturnType<typeof providerOf>) { return Boolean(openRouterApiKey); }
function isRetryableProviderError(error: any) { const message = String(error?.message || error || "").toLowerCase(); return /timeout|429|rate.?limit|temporar|overload|capacity|503|502|500|unavailable|network|fetch failed|abort|resource.?exhausted|server.?error|internal|model.?not.?found|no endpoints available|does not exist|not available for free|404/.test(message); }
function retryAfterMs(error: any) { const message = String(error?.message || error || ""); const match = message.match(/retry-after[^\d]*(\d+(?:\.\d+)?)/i) || message.match(/retry in[^\d]*(\d+(?:\.\d+)?)s/i); if (!match) return 0; return Math.min(10000, Math.max(250, Number(match[1]) * (message.match(/retry in/i) ? 1000 : 1))); }

async function callWithProviderRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let retry = 0; retry <= PROVIDER_RETRIES; retry += 1) {
    try { return await operation(); } catch (error) { lastError = error; if (!isRetryableProviderError(error) || retry >= PROVIDER_RETRIES) throw error; const providerHint = retryAfterMs(error); await sleep(providerHint || Math.min(8000, RETRY_BASE_MS * 2 ** retry)); }
  }
  throw lastError;
}

async function completionForModel(messages: any[], model: string, jsonMode: boolean) { return openRouterCompletion(messages, model, jsonMode); }

export async function getAICompletion(messages: any[], modelName: unknown = AI_MODELS.groqFast.id, jsonMode = false) {
  const requested = normalizeModel(modelName);
  const candidates = [...new Set([requested, ...AI_FALLBACK_CHAIN])].slice(0, 8);
  let lastError: any;
  let attempts = 0;
  for (const candidate of candidates) {
    if (!providerAvailable(providerOf(candidate))) continue;
    if (attempts >= MAX_PROVIDER_ATTEMPTS) break;
    attempts += 1;
    try {
      const result = await callWithProviderRetry(() => completionForModel(messages, candidate, jsonMode));
      return Object.assign(result, { _learnUp: { requestedModel: requested, model: candidate, provider: "openrouter", providerChanged: candidate !== requested, providerLabel: PROVIDER_LABELS.openrouter } });
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("No hay modelos gratuitos de OpenRouter disponibles en este momento.");
}

export async function getNvidiaNIMCompletion(messages: any[], modelName: unknown = AI_MODELS.nvidiaSuper.id, jsonMode = false) { return getAICompletion(messages, modelName, jsonMode); }
export const getGroqCompletion = async (messages: any[], modelName: unknown = AI_MODELS.groqFast.id, jsonMode = false) => getAICompletion(messages, modelName, jsonMode);
export const getGeminiCompletion = async (messages: any[], modelName: unknown = AI_MODELS.geminiFast.id, jsonMode = false) => getAICompletion(messages, modelName, jsonMode);

export async function getAIEmbedding(text: string): Promise<number[]> {
  if (!genAI) throw new Error("Gemini AI no está configurado para embeddings.");
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001" });
  const result = await callWithProviderRetry(() => withTimeout(model.embedContent({ content: { role: "user", parts: [{ text }] } } as any), TIMEOUT_MS));
  return result.embedding.values;
}

export const fetchRemoteMediaBufferForAI = fetchRemoteMediaBuffer;
export const extractDocumentTextForAI = extractDocumentText;
export { fetchRemoteMediaBuffer, extractDocumentText };