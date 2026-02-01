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
  model: string = "llama-3.3-70b-versatile",
  jsonMode: boolean = false,
) => {
  return groq.chat.completions.create({
    messages: messages,
    model: model,
    response_format: jsonMode ? { type: "json_object" } : undefined,
  });
};
