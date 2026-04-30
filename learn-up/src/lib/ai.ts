import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY;
const provider = process.env.AI_PROVIDER || "groq";

if (!apiKey) {
  console.error("AI Configuration Error: Missing AI_API_KEY or GROQ_API_KEY");
}

// ── Groq Client ───────────────────────────────────────────────────────────────
export const groq = new Groq({
  apiKey: apiKey || "dummy_key",
});

// ── Gemini Client ─────────────────────────────────────────────────────────────
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ── Unified Completion ────────────────────────────────────────────────────────
export const getAICompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = "llama-3.3-70b-versatile",
  jsonMode: boolean = false,
) => {
  if (provider === "gemini") {
    return await getGeminiCompletion(messages, model, jsonMode);
  } else {
    return await getGroqCompletion(messages, model, jsonMode);
  }
};

// ── Compatibility Alias ───────────────────────────────────────────────────────
export const getGroqCompletion = async (
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = "llama-3.3-70b-versatile",
  jsonMode: boolean = false,
) => {
  try {
    let finalMessages = [...messages];
    // Workaround for system role in vision models
    if (
      model.includes("vision") ||
      model.includes("pixtral") ||
      model.includes("llama-4")
    ) {
      const systemMsg = finalMessages.find((m) => m.role === "system");
      finalMessages = finalMessages.filter((m) => m.role !== "system");

      if (systemMsg) {
        const firstUserIndex = finalMessages.findIndex((m) => m.role === "user");
        if (firstUserIndex !== -1) {
          const originalContent = finalMessages[firstUserIndex].content;
          if (Array.isArray(originalContent)) {
            const textItem = originalContent.find((c) => c.type === "text");
            if (textItem) {
              textItem.text = `[SYSTEM INSTRUCTIONS]:\n${systemMsg.content}\n\n[USER]:\n${textItem.text}`;
            }
          } else {
            finalMessages[firstUserIndex].content = `[SYSTEM INSTRUCTIONS]:\n${systemMsg.content}\n\n[USER]:\n${originalContent}`;
          }
        }
      }
    }

    const completion = await groq.chat.completions.create({
      messages: finalMessages as any,
      model: model,
      temperature: 0.8,
      max_tokens: 2000,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });

    return {
      choices: [
        {
          message: {
            content: completion.choices[0]?.message?.content,
          },
        },
      ],
    };
  } catch (error) {
    console.error("Groq API Error:", error);
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

    // Mapping for common model aliases
    const actualModel = modelName.includes("llama")
      ? "gemini-1.5-flash"
      : modelName;

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
                // Fetch image and convert to inlineData
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
          parts: [{ text: m.content }],
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
