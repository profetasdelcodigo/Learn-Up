import { Groq } from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;

if (!apiKey) {
  console.error("AI Configuration Error: Misisng GROQ_API_KEY or AI_API_KEY");
  // Don't throw immediately to avoid crashing build time if env not set yet?
  // But for runtime it's fatal.
}

export const groq = new Groq({
  apiKey: apiKey || "dummy_key_to_prevent_crash", // Prevent instantiation error if missing
});

export const getGroqCompletion = async (
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model: string = "llama-3.3-70b-versatile", // Switched to stable model ID
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
