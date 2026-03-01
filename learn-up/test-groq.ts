import { Groq } from "groq-sdk";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              },
            },
          ],
        },
      ],
    });
    console.log("SUCCESS:", res.choices[0].message.content);
  } catch (err: any) {
    console.error("FORMAT 1 ERROR:", err.message, err.error);
  }

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are a helpful assistant. What is this?",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              },
            },
          ],
        },
      ],
    });
    console.log("SUCCESS FORMAT 2:", res.choices[0].message.content);
  } catch (err: any) {
    console.error("FORMAT 2 ERROR:", err.message, err.error);
  }
}

main();
