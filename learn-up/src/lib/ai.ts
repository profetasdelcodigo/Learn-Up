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
  messages: {
    role: "system" | "user" | "assistant";
    content: string | any[];
  }[],
  model: string = "llama-3.3-70b-versatile",
  jsonMode: boolean = false,
) => {
  try {
    // WORKAROUND: Groq Vision models do not support the "system" role natively.
    // If we're using a vision model, we must merge the system prompt into the first user message.
    let finalMessages = [...messages];
    if (model.includes("vision")) {
      const systemMsg = finalMessages.find((m) => m.role === "system");
      finalMessages = finalMessages.filter((m) => m.role !== "system");

      if (systemMsg) {
        const firstUserIndex = finalMessages.findIndex(
          (m) => m.role === "user",
        );
        if (firstUserIndex !== -1) {
          const originalContent = finalMessages[firstUserIndex].content;
          if (Array.isArray(originalContent)) {
            // It's a vision payload [ {type: text, text: ...}, {type: image_url...} ]
            const textItem = originalContent.find((c) => c.type === "text");
            if (textItem) {
              textItem.text = `[SYSTEM INSTRUCTIONS]:\n${systemMsg.content}\n\n[USER]:\n${textItem.text}`;
            }
          } else {
            finalMessages[firstUserIndex].content =
              `[SYSTEM INSTRUCTIONS]:\n${systemMsg.content}\n\n[USER]:\n${originalContent}`;
          }
        } else {
          // If no user message exists (unlikely), create one
          finalMessages.unshift({
            role: "user",
            content: `[SYSTEM INSTRUCTIONS]:\n${systemMsg.content}`,
          });
        }
      }
    }

    return await groq.chat.completions.create({
      messages: finalMessages,
      model: model,
      temperature: 0.8,
      max_tokens: 2000,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
  } catch (error) {
    console.error("Groq API Error:", error);
    throw error;
  }
};
