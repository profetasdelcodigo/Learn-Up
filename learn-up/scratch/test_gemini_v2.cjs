const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.AI_API_KEY;

async function testV1() {
  if (!apiKey) {
    console.error("AI_API_KEY environment variable not set.");
    process.exit(1);
  }
  
  // Try to explicitly use v1 if the SDK allows or just try standard model
  const genAI = new GoogleGenerativeAI(apiKey);
  
  console.log("Testing gemini-1.5-flash-latest...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent("Test");
    console.log("✅ gemini-1.5-flash-latest works!");
  } catch (err) {
    console.log("❌ gemini-1.5-flash-latest failed: " + err.message);
  }

  console.log("Testing gemini-1.5-pro...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent("Test");
    console.log("✅ gemini-1.5-pro works!");
  } catch (err) {
    console.log("❌ gemini-1.5-pro failed: " + err.message);
  }
}

testV1();
