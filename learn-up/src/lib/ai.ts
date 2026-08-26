import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { withRetryAndCircuitBreaker, CircuitBreakerOpenError } from "./retry";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const provider = process.env.AI_PROVIDER || "openrouter";
const MAX_REMOTE_MEDIA_BYTES = 25 * 1024 * 1024;
const REMOTE_MEDIA_TIMEOUT_MS = 15_000;
const AI_TEXT_TIMEOUT_MS = Number(process.env.AI_TEXT_TIMEOUT_MS || 18000);
const AI_MULTIMODAL_TIMEOUT_MS = 60000; // Un minuto entero para procesamiento multimodal

export const AI_MODELS = {
  groqFast: "openai/gpt-oss-20b",
  openRouterFast: "meta-llama/llama-3.1-8b-instruct:free",
  geminiFast: process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash",
  geminiMultimodal: process.env.GEMINI_MULTIMODAL_MODEL || "gemini-3.7-flash",
  nvidiaReasoning: "nvidia/nemotron-3-ultra-550b-a55b",
} as const;

if (!openRouterApiKey && provider === "openrouter") {
  console.warn("AI Configuration Warning: Missing OPENROUTER_API_KEY, falling back to gemini.");
}

// 🧠 Gemini Client 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// 🧠 Groq Client 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

function isAllowedRemoteMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;

    const configuredSupabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;

    return (
      url.hostname === configuredSupabaseHost ||
      url.hostname.endsWith(".supabase.co") ||
      url.hostname.endsWith(".supabase.in")
    );
  } catch {
    return false;
  }
}

export async function fetchRemoteMediaBuffer(rawUrl: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  urlLower: string;
}> {
  if (!isAllowedRemoteMediaUrl(rawUrl)) {
    throw new Error("URL de archivo no permitida para procesamiento de IA.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_MEDIA_TIMEOUT_MS);

  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`No se pudo descargar el archivo (${res.status}).`);
    }

    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > MAX_REMOTE_MEDIA_BYTES) {
      throw new Error("El archivo adjunto excede el limite permitido.");
    }

    if (!res.body) {
      throw new Error("La respuesta del archivo no tiene cuerpo.");
    }

    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REMOTE_MEDIA_BYTES) {
        throw new Error("El archivo adjunto excede el limite permitido.");
      }
      chunks.push(Buffer.from(value));
    }

    return {
      buffer: Buffer.concat(chunks),
      mimeType: res.headers.get("content-type") || "application/octet-stream",
      urlLower: rawUrl.split('?')[0].toLowerCase(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function messageHasRemoteMedia(messages: { content: string | any[] }[]): boolean {
  return messages.some((message) =>
    Array.isArray(message.content)
      ? message.content.some(
          (part) => part?.type === "image_url" || part?.type === "file_url",
        )
      : false,
  );
}

function toTextOnlyMessages(
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
) {
  return messages.map((message) => ({
    role: message.role,
    content: Array.isArray(message.content)
      ? message.content
          .map((part) => (part?.type === "text" ? part.text : ""))
          .filter(Boolean)
          .join("\n")
      : message.content,
  }));
}

export async function extractDocumentText(
  buffer: Buffer,
  urlLower: string,
  mimeType: string,
): Promise<string> {
  if (urlLower.endsWith(".pdf") || mimeType === "application/pdf") {
    const pdfParseModule = (await import("pdf-parse")) as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }

  if (urlLower.match(/\.(docx|doc|pptx|xlsx|odt|odp|ods|rtf)$/)) {
    const { parseOffice } = await import("officeparser");
    try {
      const textResult = await parseOffice(buffer, {
        ignoreNotes: false,
      });
      return typeof textResult === "string" ? textResult : "";
    } catch (error) {
      console.error("[Ingestion] Error en officeparser:", error);
      throw new Error("El archivo Office parece estar dañado o tiene un formato no compatible.");
    }
  }

  if (
    mimeType.startsWith("text/") ||
    urlLower.match(/\.(txt|md|csv|json|xml|html|css|js|ts|py|java|c|cpp)$/)
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error("Tipo de documento no soportado para extraccion.");
}

// 🧠 Helper to manage context window 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
const MAX_HISTORY = 12;
const MAX_CONTEXT_CHARS = 12000;

const trimMessages = (messages: any[], limit: number = MAX_HISTORY) => {
  const systemMsg = messages.find(m => m.role === "system");
  const userMessages = messages.filter(m => m.role !== "system");
  const trimmed = userMessages.slice(-limit);
  
  // Truncate message contents to prevent Payload Too Large errors
  const processed = trimmed.map(m => {
    if (typeof m.content === 'string' && m.content.length > MAX_CONTEXT_CHARS) {
      return { ...m, content: m.content.substring(0, MAX_CONTEXT_CHARS) + "\n...[Contenido Truncado]..." };
    }
    return m;
  });

  return systemMsg ? [systemMsg, ...processed] : processed;
};

// 🧠 fetchWithTimeout 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = AI_TEXT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// 🧠 Promise Timeout helper for SDKs 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export function withTimeout<T>(promise: Promise<T>, ms: number = AI_TEXT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout de ${ms}ms alcanzado.`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((reason) => {
        clearTimeout(timer);
        reject(reason);
      });
  });
}

// 🧠 Nvidia NIM Implementation 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export const getNvidiaNIMCompletion = async (
  messages: any[],
  modelName: string = AI_MODELS.nvidiaReasoning,
  jsonMode: boolean = false
) => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("⚠️ Falta NVIDIA_API_KEY en las variables de entorno.");

  try {
    const finalModel = modelName.replace(/^nvidia\//, "");
    // Ensure we don't duplicate nvidia/ if it's not present or incorrectly present
    const requestModel = finalModel.startsWith("nvidia/") ? finalModel : `nvidia/${finalModel}`;
    
    // Solo si el usuario explícitamente pide razonamiento u otro parámetro
    const extraParams: any = {};
    if (finalModel.includes("nemotron-3-ultra") && messages.some(m => m.role === "system" && m.content.includes("RAZONAMIENTO_ACTIVADO"))) {
      extraParams.reasoning_budget = 4096;
      extraParams.chat_template_kwargs = { enable_thinking: true };
    }

    const response = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: requestModel,
        messages: toTextOnlyMessages(trimMessages(messages, MAX_HISTORY)),
        max_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 2048),
        temperature: 0.7,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        ...extraParams
      }),
    });

    if (!response.ok) {
      throw new Error(`Nvidia API Error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return {
      choices: [
        {
          message: {
            content: data.choices[0]?.message?.content || "",
          },
        },
      ],
    };
  } catch (error) {
    console.error("Nvidia NIM Error:", error);
    throw error;
  }
};

// 🧠 OpenRouter Implementation (Modelos Gratuitos) 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
const getOpenRouterCompletion = async (
  messages: any[],
  modelName: string,
  jsonMode: boolean = false
) => {
  const apiKey = openRouterApiKey;
  if (!apiKey) throw new Error("⚠️ Falta OPENROUTER_API_KEY en las variables de entorno.");

  let finalModel = modelName.replace(/^openrouter\//, "");
  
  // Mapeo seguro de fallbacks
  const freeModels: Record<string, string> = {
    "deepseek/deepseek-r1": "deepseek/deepseek-r1:free",
    "openai/gpt-oss-20b": "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct": "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-3-coder-flash": "qwen/qwen-3-coder-flash:free",
    "google/gemini-2.5-flash": "google/gemini-3.6-flash",
    "google/gemini-2.0-flash": "google/gemini-3.6-flash",
    "gemini-2.0-flash": "google/gemini-3.6-flash",
    "google/gemini-1.5-flash": "google/gemini-3.6-flash",
  };
  
  if (freeModels[finalModel]) {
    finalModel = freeModels[finalModel];
  }

  try {
    const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://learn-up-qmgx.onrender.com",
        "X-Title": "Learn Up",
      },
      body: JSON.stringify({
        model: finalModel,
        messages: toTextOnlyMessages(trimMessages(messages, MAX_HISTORY)),
        max_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 2048),
        temperature: 0.7,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errorData}`);
    }

    const data = await response.json();

    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      let content = data.choices[0].message.content || "";
      if (!jsonMode) {
        content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      }
      return {
        choices: [{ message: { content } }],
      };
    } else {
      throw new Error("La estructura de respuesta de OpenRouter no es la esperada.");
    }
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    throw error;
  }
};

// 🧠 Groq Implementation 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export const getGroqCompletion = async (
  messages: any[],
  modelName: string = AI_MODELS.groqFast,
  jsonMode: boolean = false
) => {
  if (!groq) throw new Error("Groq is not configured. Missing GROQ_API_KEY.");

  let finalModel = modelName.replace(/^groq\//, "");
  // Reemplazar modelo deprecado por el OSS estable de 20b
  if (finalModel === "llama-3.3-70b-versatile") {
    finalModel = AI_MODELS.groqFast;
  }

  try {
    const isCompound = finalModel === "groq/compound" || finalModel === "compound";
    const extraOptions = isCompound ? {
      compound_custom: {
        tools: {
          enabled_tools: [
            "web_search",
            "code_interpreter",
            "visit_website"
          ]
        }
      }
    } : {};

    const promise = groq.chat.completions.create({
      messages: trimMessages(messages, MAX_HISTORY),
      model: finalModel,
      response_format: jsonMode ? { type: "json_object" } : undefined,
      temperature: 1,
      max_completion_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 2048),
      top_p: 1,
      stream: false,
      ...extraOptions
    } as any);

    const response: any = await withTimeout(promise, AI_TEXT_TIMEOUT_MS);

    return {
      choices: [
        {
          message: {
            content: response.choices[0]?.message?.content || "",
          },
        },
      ],
    };
  } catch (error: any) {
    console.error(`[Groq] Error con modelo ${finalModel}:`, error.message);
    throw error;
  }
};

// 🧠 Gemini Implementation 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
const getGeminiCompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  modelName: string,
  jsonMode: boolean = false,
  isMultimodal: boolean = false
) => {
  if (!genAI) throw new Error("Gemini AI not initialized");

  try {
    const systemMessage = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    // Limpiamos el prefijo (gemini/), pero no hacemos mapeos agresivos
    const finalModel = modelName.replace(/^gemini\//, "");

    const model = genAI.getGenerativeModel({
      model: finalModel,
      systemInstruction: systemMessage?.content as string,
    });

    const contents = await Promise.all(
      otherMessages.map(async (m) => {
        if (Array.isArray(m.content)) {
          const parts = await Promise.all(
            m.content.map(async (part) => {
              if (part.type === "text") return { text: part.text };
              if (part.type === "image_url" || part.type === "file_url") {
                const url = part.type === "image_url" ? part.image_url.url : part.file_url.url;
                const { buffer, urlLower, mimeType: fetchedMimeType } =
                  await fetchRemoteMediaBuffer(url);

                let mimeType = fetchedMimeType;
                if (urlLower.endsWith(".pdf")) mimeType = "application/pdf";
                
                const isImage = mimeType.startsWith("image/") || urlLower.match(/\.(jpg|jpeg|png|webp|heic)$/i);
                
                console.log(`[Gemini Multimedia] Archivo detectado. mimeType=${mimeType}, bytes=${buffer.length}, model=${finalModel}`);

                if (isImage || mimeType === "application/pdf") {
                  return {
                    inlineData: {
                      data: buffer.toString("base64"),
                      mimeType: mimeType === "application/octet-stream" ? "image/jpeg" : mimeType,
                    },
                  };
                }

                // Extracción local de DOCX/PPTX (cuando Gemini no lo soporta nativamente en inlineData)
                try {
                  console.log(`[Gemini Multimedia] Parseando documento localmente para: ${mimeType}`);
                  const extractedText = await extractDocumentText(
                    buffer,
                    urlLower,
                    mimeType,
                  );
                  return { text: `[Contenido del Documento Adjunto]:\n${extractedText}` };
                } catch (parseError) {
                  console.error("Error parsing document:", parseError);
                  return { text: "[No se pudo extraer el texto del documento]" };
                }
              }
              return { text: "" };
            }),
          );
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts,
          };
        }
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content as string }],
        };
      }),
    );

    const maxRetries = 2; // 3 intentos en total
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        if (isMultimodal && attempt > 0) {
          console.log(`[Gemini Multimedia] intento ${attempt + 1}/${maxRetries + 1}`);
        }

        const promise = model.generateContent({
          contents,
          generationConfig: {
            responseMimeType: jsonMode ? "application/json" : "text/plain",
            temperature: 0.8,
            maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 2048),
          },
        });

        // Timeout dedicado para multimedia
        const timeout = isMultimodal ? AI_MULTIMODAL_TIMEOUT_MS : AI_TEXT_TIMEOUT_MS;
        const result = await withTimeout(promise, timeout);

        if (isMultimodal && attempt > 0) {
          console.log(`[Gemini Multimedia] éxito en intento ${attempt + 1}`);
        }

        return {
          choices: [
            {
              message: {
                content: result.response.text(),
              },
            },
          ],
        };
      } catch (error: any) {
        const errorMsg = error?.message || "";
        const isRetryableError = 
          errorMsg.includes("503") || 
          errorMsg.includes("429") || 
          errorMsg.includes("500") || 
          errorMsg.includes("502") || 
          errorMsg.includes("504");
          
        if (isRetryableError && attempt < maxRetries) {
          attempt++;
          // Base backoff: 1000ms para intento 1, 2000ms para intento 2, más un jitter de hasta 500ms
          const backoff = (attempt * 1000) + Math.random() * 500;
          console.log(`[Gemini Multimedia] ${errorMsg.substring(0, 100)}... recibido, reintentando en ${Math.round(backoff)}ms`);
          await new Promise((res) => setTimeout(res, backoff));
        } else {
          if (attempt >= maxRetries && isMultimodal) {
            console.log(`[Gemini Multimedia] todos los intentos agotados`);
          }
          console.error("Gemini API Error:", error);
          throw error;
        }
      }
    }
    
    throw new Error("Fallo inesperado en getGeminiCompletion");
  } catch (error) {
    console.error("Gemini API Error (outer):", error);
    throw error;
  }
};

// 🧠 Main AI Router 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export const getAICompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = AI_MODELS.groqFast,
  jsonMode: boolean = false,
) => {
  const hasRemoteMedia = messageHasRemoteMedia(messages);

  if (hasRemoteMedia && !genAI) {
    throw new Error("Se intentó adjuntar un archivo pero Gemini no está configurado.");
  }

  // 1. MULTIMEDIA PIPELINE (Estricto)
  if (hasRemoteMedia) {
    console.log(`[AI Debug] Solicitud con multimedia detectada. Forzando Gemini Multimodal. Ignorando modelo de texto: ${model}`);
    try {
      return await getGeminiCompletion(messages, AI_MODELS.geminiMultimodal, jsonMode, true);
    } catch (e: any) {
      console.error("[AI Debug] Fallo crítico en pipeline multimedia:", e);
      throw new Error(`Error específico de procesamiento multimedia: ${e.message}`);
    }
  }

  // 2. TEXT-ONLY PIPELINE
  const errors: string[] = [];
  
  const providers = [
    {
      name: "User Selected",
      run: async () => {
        // Validación Estricta de Proveedor
        if (model.startsWith("nvidia/")) return await getNvidiaNIMCompletion(messages, model, jsonMode);
        if (model.startsWith("openrouter/")) return await getOpenRouterCompletion(messages, model, jsonMode);
        if (model.startsWith("groq/")) return await getGroqCompletion(toTextOnlyMessages(messages), model, jsonMode);
        if (model.startsWith("gemini/")) return await getGeminiCompletion(messages, model, jsonMode, false);
        
        throw new Error(`Proveedor no reconocido o formato de modelo inválido: ${model}`);
      }
    },
    {
      name: "Gemini Fast (Primary Fallback)",
      run: async () => await getGeminiCompletion(messages, AI_MODELS.geminiFast, jsonMode, false)
    },
    {
      name: "Groq Fast (Secondary Fallback)",
      run: async () => await getGroqCompletion(toTextOnlyMessages(messages), AI_MODELS.groqFast, jsonMode)
    },
    {
      name: "OpenRouter Fast (Tertiary Fallback)",
      run: async () => await getOpenRouterCompletion(messages, AI_MODELS.openRouterFast, jsonMode)
    },
    {
      name: "Nvidia (Final Fallback)",
      run: async () => await getNvidiaNIMCompletion(messages, AI_MODELS.nvidiaReasoning, jsonMode)
    }
  ];

  for (const provider of providers) {
    try {
      console.log(`[AI Debug] Intentando proveedor: ${provider.name}`);
      return await withRetryAndCircuitBreaker(provider.name, provider.run, { maxRetries: 1 });
    } catch (e: any) {
      if (e instanceof CircuitBreakerOpenError) {
        console.log(`[AI Debug] Proveedor ${provider.name} saltado (Circuit Breaker Open)`);
      } else {
        console.log(`[AI Debug] Proveedor ${provider.name} falló: ${e.message}`);
        errors.push(`[${provider.name}] ${e.message}`);
      }
    }
  }

  throw new Error(`Todos los proveedores de IA fallaron. Errores:\n${errors.join('\n')}`);
};

// 🧠 Embedding 🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠
export const getAIEmbedding = async (text: string): Promise<number[]> => {
  if (!genAI) throw new Error("Gemini AI not initialized for embeddings");
  try {
    const promise = genAI.getGenerativeModel({ model: "gemini-embedding-2" }).embedContent({
      content: { role: "user", parts: [{ text }] },
      outputDimensionality: 768
    } as any);
    const result = await withTimeout(promise);
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    throw error;
  }
};
