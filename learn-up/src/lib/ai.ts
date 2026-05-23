import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const provider = process.env.AI_PROVIDER || "gemini";
const MAX_REMOTE_MEDIA_BYTES = 25 * 1024 * 1024;
const REMOTE_MEDIA_TIMEOUT_MS = 15_000;

if (!geminiApiKey && provider === "gemini") {
  console.error("AI Configuration Error: Missing AI_API_KEY or GEMINI_API_KEY");
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

async function fetchRemoteMediaBuffer(rawUrl: string): Promise<{
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
      urlLower: rawUrl.toLowerCase(),
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

async function extractDocumentText(
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

  if (urlLower.endsWith(".docx") || urlLower.endsWith(".doc")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  const officeMatch = urlLower.match(/\.(pptx|xlsx|odt|odp|ods|rtf)$/);
  if (officeMatch) {
    const { OfficeParser } = await import("officeparser");
    const ast = await OfficeParser.parseOffice(buffer, {
      fileType: officeMatch[1],
      ignoreNotes: false,
    } as any);
    const textResult = await ast.to("text");
    return typeof textResult.value === "string" ? textResult.value : "";
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
      actualModel = "gemini-3-flash-preview";
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

export const getAICompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = "gemini-3-flash-preview",
  jsonMode: boolean = false,
) => {
  console.log(`[AI Debug] Provider actual: ${provider}`);
  const hasRemoteMedia = messageHasRemoteMedia(messages);
  
  // 1. Si el proveedor es Groq, usamos Groq directamente
  if (provider === "groq") {
    if (hasRemoteMedia) {
      if (genAI) {
        console.warn("[AI Debug] Groq no soporta adjuntos; usando Gemini para media.");
        return await getGeminiCompletion(messages, model, jsonMode);
      }
      throw new Error("Groq no soporta adjuntos y Gemini no esta configurado.");
    }

    console.log("[AI Debug] Usando Groq como proveedor principal...");
    return await getGroqCompletion(
      toTextOnlyMessages(messages),
      "llama-3.3-70b-versatile",
      jsonMode,
    );
  }

  // 2. Si el proveedor es Gemini, intentamos Gemini con fallback a Groq
  try {
    console.log("[AI Debug] Intentando usar Gemini...");
    return await getGeminiCompletion(messages, model, jsonMode);
  } catch (error: any) {
    console.warn("[AI Debug] Gemini falló, intentando fallback a Groq...", error?.message || error);
    if (hasRemoteMedia) {
      throw new Error(
        "No se pudo procesar el archivo adjunto con Gemini. Groq no se usa como fallback para adjuntos porque perderia el contenido del archivo.",
      );
    }

    try {
      return await getGroqCompletion(
        toTextOnlyMessages(messages),
        "llama-3.3-70b-versatile",
        jsonMode,
      );
    } catch (groqError) {
      console.error("[AI Debug] Ambos proveedores fallaron.");
      throw groqError;
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
      max_tokens: 8192,
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
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    throw error;
  }
};
