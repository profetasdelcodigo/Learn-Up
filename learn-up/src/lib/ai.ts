import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.AI_API_KEY;

if (!apiKey) {
  throw new Error("AI_API_KEY is not configured");
}

export const genAI = new GoogleGenerativeAI(apiKey);

export const getModel = (modelName: string = "gemini-1.5-flash") => {
  return genAI.getGenerativeModel({ model: modelName });
};
