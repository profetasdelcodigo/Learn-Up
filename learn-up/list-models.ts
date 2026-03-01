import fs from "fs";

async function listModels() {
  try {
    const env = fs.readFileSync(".env.local", "utf8");
    const match = env.match(/GROQ_API_KEY=(.+)/);
    const apiKey = match ? match[1].trim() : process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("No API key found in .env");
      return;
    }

    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    console.log("AVAILABLE MODELS:");
    console.log(
      data.data
        .map((m: any) => m.id)
        .filter((id: string) => id.includes("vision") || id.includes("pixtral"))
        .join("\n"),
    );
  } catch (err) {
    console.error("ERROR:");
    console.error(err);
  }
}

listModels();
