import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.AI_API_KEY;
const provider = process.env.AI_PROVIDER || "gemini";

if (!apiKey && provider === "gemini") {
  console.error("AI Configuration Error: Missing AI_API_KEY");
}

// ── Gemini Client ─────────────────────────────────────────────────────────────
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

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
  return await getGeminiCompletion(messages, model, jsonMode);
};

// ── Groq Placeholder (Deprecated) ─────────────────────────────────────────────
export const getGroqCompletion = async () => {
  throw new Error("Groq is restricted and no longer in use. Please use Gemini.");
};

// Export dummy groq object to prevent import errors in untracked files
export const groq = null as any;
