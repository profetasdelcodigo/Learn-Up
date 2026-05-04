import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const provider = process.env.AI_PROVIDER || "gemini";

if (!geminiApiKey && provider === "gemini") {
  console.error("AI Configuration Error: Missing AI_API_KEY or GEMINI_API_KEY");
}

// ── Gemini Client ─────────────────────────────────────────────────────────────
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// ── Groq Client ─────────────────────────────────────────────────────────────
export const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

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
              if (part.type === "image_url") {
                const res = await fetch(part.image_url.url);
                const buf = await res.arrayBuffer();
                return {
                  inlineData: {
                    data: Buffer.from(buf).toString("base64"),
                    mimeType: res.headers.get("content-type") || "image/jpeg",
                  },
                };
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
        maxOutputTokens: 2000,
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

// ── Unified Completion ────────────────────────────────────────────────────────
export const getAICompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = "gemini-3-flash-preview",
  jsonMode: boolean = false,
) => {
  if (provider === "ollama") {
    return await getOllamaCompletion(messages, model, jsonMode);
  }

  if (provider === "groq") {
    const simpleMessages = messages.map(m => ({
      role: m.role,
      content: Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '').join('\n') : m.content
    }));
    return await getGroqCompletion(simpleMessages, "llama-3.3-70b-versatile", jsonMode);
  }

  // Default to Gemini with Groq fallback
  try {
    return await getGeminiCompletion(messages, model, jsonMode);
  } catch (error: any) {
    console.warn("Gemini API Error, falling back to Groq...", error?.message || error);
    try {
      const simpleMessages = messages.map(m => ({
        role: m.role,
        content: Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '').join('\n') : m.content
      }));
      return await getGroqCompletion(simpleMessages, "llama-3.3-70b-versatile", jsonMode);
    } catch (groqError) {
      console.error("Both Gemini and Groq failed.");
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
      max_tokens: 2000,
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
