import { Groq } from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY is not configured");
}

export const groq = new Groq({
  apiKey: apiKey,
});

export const getGroqCompletion = async (
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model: string = "llama3-70b-8192", // Switched to stable model ID
  jsonMode: boolean = false,
) => {
  try {
    return await groq.chat.completions.create({
      messages: messages,
      model: model,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
  } catch (error) {
    console.error("Groq API Error:", error);
    throw error;
  }
};
