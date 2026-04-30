const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.AI_API_KEY;

async function testFinal() {
  if (!apiKey) {
    console.error("AI_API_KEY environment variable not set.");
    process.exit(1);
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-3-flash-preview";
  
  console.log(`Testing final model: ${modelName}...`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hola, ¿eres el Profesor Mente?");
    console.log(`✅ Success: ${result.response.text()}`);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
  }
}

testFinal();
