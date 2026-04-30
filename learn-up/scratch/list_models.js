import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.AI_API_KEY;

async function list() {
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const models = await genAI.listModels();
    console.log("Available models:");
    models.models.forEach(m => console.log(`- ${m.name}`));
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

list();
