import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const provider = process.env.AI_PROVIDER || "openrouter";
const MAX_REMOTE_MEDIA_BYTES = 25 * 1024 * 1024;
const REMOTE_MEDIA_TIMEOUT_MS = 15_000;

if (!openRouterApiKey && provider === "openrouter") {
  console.warn("AI Configuration Warning: Missing OPENROUTER_API_KEY, falling back to gemini.");
}

// ── Gemini Client ─────────────────────────────────────────────────────────────
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// ── Groq Client ─────────────────────────────────────────────────────────────
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

// ── Ollama Implementation ────────────────────────────────────────────────────
const getOllamaCompletion = async (
  messages: any[],
  model: string = "qwen2.5-coder",
  jsonMode: boolean = false,
) => {
  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
        format: jsonMode ? "json" : undefined,
      }),
    });

    const data = await response.json();
    return {
      choices: [
        {
          message: {
            content: data.message?.content || "",
          },
        },
      ],
    };
  } catch (error) {
    console.error("Ollama API Error:", error);
    throw error;
  }
};

// ── Gemini Implementation ────────────────────────────────────────────────────
const getGeminiCompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  modelName: string,
  jsonMode: boolean = false,
) => {
  if (!genAI) throw new Error("Gemini AI not initialized");

  try {
    const systemMessage = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    // Mapping for 2026 available models
    let actualModel = modelName;
    if (modelName.includes("llama") || modelName.includes("flash")) {
      actualModel = "gemini-2.0-flash";
    }

    const model = genAI.getGenerativeModel({
      model: actualModel,
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

                // Determine mime type from headers or extension
                let mimeType = fetchedMimeType;
                if (urlLower.endsWith(".pdf")) mimeType = "application/pdf";
                
                const isImage = mimeType.startsWith("image/") || urlLower.match(/\\.(jpg|jpeg|png|webp|heic)$/i);
                // Si es imagen, lo mandamos directo en inlineData
                if (isImage) {
                  return {
                    inlineData: {
                      data: buffer.toString("base64"),
                      mimeType: mimeType === "application/octet-stream" ? "image/jpeg" : mimeType,
                    },
                  };
                }

                // Para documentos, extraemos el texto plano localmente.
                try {
                  const extractedText = await extractDocumentText(
                    buffer,
                    urlLower,
                    mimeType,
                  );
                  return { text: `[Contenido del Documento Adjunto]:\\n${extractedText}` };
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

    const result = await model.generateContent({
      contents,
      generationConfig: {
        responseMimeType: jsonMode ? "application/json" : "text/plain",
        temperature: 0.8,
        maxOutputTokens: 8192,
      },
    });

    return {
      choices: [
        {
          message: {
            content: result.response.text(),
          },
        },
      ],
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// ── Nvidia NIM Implementation ──────────────────────────────────────────────────
export const getNvidiaNIMCompletion = async (
  messages: any[],
  modelName: string = "meta/llama-3.1-405b-instruct",
  jsonMode: boolean = false
) => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("⚠️ Falta NVIDIA_API_KEY en las variables de entorno para usar los modelos de NVIDIA NIM.");

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: toTextOnlyMessages(messages),
        max_tokens: 4096,
        temperature: 0.7,
        response_format: jsonMode ? { type: "json_object" } : undefined,
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

// ── OpenRouter Implementation ────────────────────────────────────────────────
const getOpenRouterCompletion = async (
  messages: any[],
  modelName: string,
  jsonMode: boolean = false
) => {
  const apiKey = openRouterApiKey;
  if (!apiKey) throw new Error("⚠️ Falta OPENROUTER_API_KEY en las variables de entorno.");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://learnup.edu",
        "X-Title": "Learn Up",
      },
      body: JSON.stringify({
        model: modelName,
        messages: toTextOnlyMessages(messages),
        max_tokens: 2048,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API Error: ${response.status} ${await response.text()}`);
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
    console.error("OpenRouter API Error:", error);
    throw error;
  }
};

export const getAICompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = "gemini-2.0-flash",
  jsonMode: boolean = false,
) => {
  console.log(`[AI Debug] Provider preferido: ${provider}`);
  const hasRemoteMedia = messageHasRemoteMedia(messages);

  // Si hay multimedia y no hay Gemini, error.
  if (hasRemoteMedia && !genAI) {
    throw new Error("Se intentó adjuntar un archivo pero Gemini no está configurado.");
  }

  // Si hay multimedia, obligatoriamente usamos Gemini
  if (hasRemoteMedia) {
    console.log("[AI Debug] Solicitud con multimedia, forzando uso de Gemini...");
    return await getGeminiCompletion(messages, model, jsonMode);
  }

  // Lógica de Fallback Multi-Provider para texto
  const tryOpenRouter = async () => {
    console.log("[AI Debug] Intentando OpenRouter (Auto-Router)...");
    // Por defecto OpenRouter usará Llama 3.3 70B como router rápido si no se especifica
    const orModel = model === "gemini-2.0-flash" ? "meta-llama/llama-3.3-70b-instruct" : model;
    return await getOpenRouterCompletion(messages, orModel, jsonMode);
  };

  const tryNvidia = async () => {
    console.log("[AI Debug] Intentando Nvidia NIM...");
    return await getNvidiaNIMCompletion(messages, "meta/llama-3.1-405b-instruct", jsonMode);
  };

  const tryGroq = async () => {
    console.log("[AI Debug] Intentando Groq...");
    return await getGroqCompletion(toTextOnlyMessages(messages), "llama-3.3-70b-versatile", jsonMode);
  };

  const tryGemini = async () => {
    console.log("[AI Debug] Intentando Gemini Flash...");
    return await getGeminiCompletion(messages, model, jsonMode);
  };

  // 1. Enrutamiento Explícito (Seleccionado por el usuario en la UI)
  if (model.startsWith("openrouter/")) {
    const specificModel = model.replace("openrouter/", "");
    console.log(`[AI Debug] Enrutamiento explícito a OpenRouter: ${specificModel}`);
    return await getOpenRouterCompletion(messages, specificModel, jsonMode);
  }

  if (model.startsWith("nvidia/")) {
    const specificModel = model.replace("nvidia/", "");
    console.log(`[AI Debug] Enrutamiento explícito a Nvidia NIM: ${specificModel}`);
    return await getNvidiaNIMCompletion(messages, specificModel, jsonMode);
  }
  
  if (model.startsWith("groq/")) {
    const specificModel = model.replace("groq/", "");
    console.log(`[AI Debug] Enrutamiento explícito a Groq: ${specificModel}`);
    return await getGroqCompletion(toTextOnlyMessages(messages), specificModel, jsonMode);
  }

  if (model.startsWith("gemini/")) {
    const specificModel = model.replace("gemini/", "");
    console.log(`[AI Debug] Enrutamiento explícito a Gemini: ${specificModel}`);
    return await getGeminiCompletion(messages, specificModel, jsonMode);
  }

  // 2. Si el usuario fuerza un proveedor via .env (Fallback Legacy)
  if (provider === "openrouter") {
    try { return await tryOpenRouter(); } catch (e) { console.warn("OpenRouter falló, fallback a Nvidia..."); return await tryNvidia(); }
  }
  if (provider === "groq") {
    try { return await tryGroq(); } catch (e) { console.warn("Groq falló, fallback a Gemini..."); return await tryGemini(); }
  }
  if (provider === "gemini") {
    try { return await tryGemini(); } catch (e) { console.warn("Gemini falló, fallback a Groq..."); return await tryGroq(); }
  }

  // 3. Comportamiento por defecto (Inteligente y robusto)
  try {
    if (openRouterApiKey) {
      return await tryOpenRouter();
    }
    if (process.env.NVIDIA_API_KEY) {
      return await tryNvidia();
    }
    return await tryGroq();
  } catch (error: any) {
    console.warn("[AI Debug] Provider primario falló:", error?.message);
    
    // Fallback secundario y finales
    try {
      if (process.env.NVIDIA_API_KEY) {
        return await tryNvidia();
      }
      return await tryGemini(); 
    } catch (fallbackError) {
      console.error("[AI Debug] Fallback secundario falló.");
      try {
        return await tryGemini();
      } catch (lastError) {
        console.error("[AI Debug] Todos los proveedores fallaron.");
        throw lastError;
      }
    }
  }
};

// ── Groq Implementation ───────────────────────────────────────────────────────
export const getGroqCompletion = async (
  messages: any[],
  modelName: string = "llama-3.3-70b-versatile",
  jsonMode: boolean = false
) => {
  if (!groq) throw new Error("Groq is not configured. Missing GROQ_API_KEY.");
  try {
    const response = await groq.chat.completions.create({
      messages,
      model: modelName,
      response_format: jsonMode ? { type: "json_object" } : undefined,
      temperature: 0.8,
      max_tokens: 1024,
    });
    return {
      choices: [
        {
          message: {
            content: response.choices[0]?.message?.content || "",
          },
        },
      ],
    };
  } catch (error) {
    console.error("Groq API Error:", error);
    throw error;
  }
};

// ── Embedding ─────────────────────────────────────────────────────────────────
export const getAIEmbedding = async (text: string): Promise<number[]> => {
  if (!genAI) throw new Error("Gemini AI not initialized for embeddings");
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    throw error;
  }
};
