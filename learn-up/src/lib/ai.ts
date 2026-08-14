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

    // Mapping for 2026 available models to real-world stable endpoints
    let actualModel = modelName;
    if (modelName.includes("antigravity") || modelName.includes("pro") || modelName.includes("robotics")) {
      actualModel = "gemini-1.5-pro";
    } else if (modelName.includes("flash") || modelName.includes("gemma")) {
      actualModel = "gemini-1.5-flash";
    } else if (modelName.includes("llama")) {
      actualModel = "gemini-1.5-flash"; // Fallback for some reason
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

// ── Helper to manage context window ─────────────────────────────────────────────
const trimMessages = (messages: any[], limit: number = 10) => {
  const systemMsg = messages.find(m => m.role === "system");
  const userMessages = messages.filter(m => m.role !== "system");
  const trimmed = userMessages.slice(-limit);
  return systemMsg ? [systemMsg, ...trimmed] : trimmed;
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
    const extraParams: any = {};
    if (modelName.includes("nemotron-3-ultra")) {
      extraParams.reasoning_budget = 4096;
      extraParams.chat_template_kwargs = { enable_thinking: true };
    } else if (modelName.includes("deepseek-v4")) {
      extraParams.chat_template_kwargs = { thinking: true, reasoning_effort: "high" };
    }

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: toTextOnlyMessages(trimMessages(messages, 15)),
        max_tokens: 4096,
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

// ── OpenRouter Implementation (Modelos Gratuitos) ────────────────────────────
const getOpenRouterCompletion = async (
  messages: any[],
  modelName: string,
  jsonMode: boolean = false
) => {
  const apiKey = openRouterApiKey;
  if (!apiKey) throw new Error("⚠️ Falta OPENROUTER_API_KEY en las variables de entorno.");

  // Asegurar que modelos gratuitos usen el sufijo :free obligatorio
  let finalModel = modelName;
  const freeModels: Record<string, string> = {
    "deepseek/deepseek-r1": "deepseek/deepseek-r1:free",
    "meta-llama/llama-3.3-70b-instruct": "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-3-coder-flash": "qwen/qwen-3-coder-flash:free",
    "microsoft/phi-4-mini": "microsoft/phi-4-mini:free",
    "google/gemini-2.5-flash": "google/gemini-2.5-flash:free",
  };
  if (freeModels[finalModel]) {
    finalModel = freeModels[finalModel];
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        // OBLIGATORIOS para evitar errores 403/400 en OpenRouter
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://learn-up-qmgx.onrender.com",
        "X-Title": "Learn Up",
      },
      body: JSON.stringify({
        model: finalModel,
        messages: toTextOnlyMessages(trimMessages(messages, 15)),
        max_tokens: 1500,
        temperature: 0.7,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errorData}`);
    }

    const data = await response.json();

    // Verificación estructural robusta
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      // Limpiar etiquetas <think> de modelos de razonamiento como DeepSeek R1
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
    console.log("[AI Debug] Intentando OpenRouter (Gratis)...");
    const orModel = model === "gemini-2.0-flash" ? "deepseek/deepseek-r1:free" : model;
    return await getOpenRouterCompletion(messages, orModel, jsonMode);
  };

  const tryNvidia = async () => {
    console.log("[AI Debug] Intentando Nvidia NIM (GLM-5.2)...");
    return await getNvidiaNIMCompletion(messages, "z-ai/glm-5.2", jsonMode);
  };

  const tryGroq = async () => {
    console.log("[AI Debug] Intentando Groq (El Cerebro)...");
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
    try {
      return await getOpenRouterCompletion(messages, specificModel, jsonMode);
    } catch (e: any) {
      throw new Error(`OpenRouter (${specificModel}) falló: ${e.message}`);
    }
  }

  if (model.startsWith("nvidia/")) {
    const specificModel = model.replace("nvidia/", "");
    console.log(`[AI Debug] Enrutamiento explícito a Nvidia NIM: ${specificModel}`);
    try {
      return await getNvidiaNIMCompletion(messages, specificModel, jsonMode);
    } catch (e: any) {
      throw new Error(`Nvidia NIM (${specificModel}) falló: ${e.message}`);
    }
  }
  
  if (model.startsWith("groq/")) {
    const specificModel = model.replace("groq/", "");
    console.log(`[AI Debug] Enrutamiento explícito a Groq: ${specificModel}`);
    try {
      return await getGroqCompletion(toTextOnlyMessages(messages), specificModel, jsonMode);
    } catch (e: any) {
      throw new Error(`Groq (${specificModel}) falló: ${e.message}`);
    }
  }

  if (model.startsWith("gemini/")) {
    const specificModel = model.replace("gemini/", "");
    console.log(`[AI Debug] Enrutamiento explícito a Gemini: ${specificModel}`);
    try {
      return await getGeminiCompletion(messages, specificModel, jsonMode);
    } catch (e: any) {
      throw new Error(`Gemini (${specificModel}) falló: ${e.message}`);
    }
  }

  // 2. Si el usuario fuerza un proveedor via .env (Fallback Legacy sin reintento)
  if (provider === "openrouter") {
    return await tryOpenRouter();
  }
  if (provider === "groq") {
    return await tryGroq();
  }
  if (provider === "gemini") {
    return await tryGemini();
  }

  // 3. Fallback inteligente (Si el .env no fuerza nada, prioriza el mejor disponible gratis)
  try {
    return await tryOpenRouter();
  } catch (errorOR: any) {
    console.log("[AI Debug] Falló OpenRouter:", errorOR.message);
    try {
      return await tryNvidia();
    } catch (errorNV: any) {
      console.log("[AI Debug] Falló Nvidia NIM:", errorNV.message);
      try {
        return await tryGroq();
      } catch (errorGroq: any) {
        console.log("[AI Debug] Falló Groq:", errorGroq.message);
        return await tryGemini();
      }
    }
  }
};

// ── Groq Implementation (con Reintentos Exponenciales) ────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getGroqCompletion = async (
  messages: any[],
  modelName: string = "llama-3.3-70b-versatile",
  jsonMode: boolean = false,
  retries: number = 3
) => {
  if (!groq) throw new Error("Groq is not configured. Missing GROQ_API_KEY.");

  for (let i = 0; i < retries; i++) {
    try {
      const isCompound = modelName === "groq/compound";
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

      const response = await groq.chat.completions.create({
        messages: trimMessages(messages, 10),
        model: modelName,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        temperature: 1,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: false,
        ...extraOptions
      } as any);

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
      console.error(`[Groq] Error en intento ${i + 1}/${retries} con modelo ${modelName}:`, error.message);

      // Si es error 429 (Rate Limit) y quedan reintentos, esperar con backoff exponencial
      if (error.status === 429 && i < retries - 1) {
        const tiempoEspera = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.warn(`[Groq] Límite alcanzado. Esperando ${tiempoEspera}ms para reintentar...`);
        await delay(tiempoEspera);
      } else {
        throw error;
      }
    }
  }

  throw new Error("No se pudo obtener respuesta de Groq tras múltiples intentos.");
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
