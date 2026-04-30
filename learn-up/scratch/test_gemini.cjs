const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.AI_API_KEY;

async function list() {
  if (!apiKey) {
    console.error("AI_API_KEY environment variable not set.");
    process.exit(1);
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // Note: listModels is on the client in some versions, or requires a different approach
    // In @google/generative-ai, listModels is not a direct method on GoogleGenerativeAI in all versions.
    // Actually, it usually requires the 'v1' or 'v1beta' endpoint.
    
    // Let's try to just generate a simple response with gemini-1.5-flash and gemini-2.0-flash to see which works.
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-2.0-flash-exp"];
    
    for (const modelName of modelsToTry) {
      console.log(`Trying model: ${modelName}...`);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you there?");
        console.log(`✅ Success with ${modelName}: ${result.response.text().substring(0, 50)}...`);
      } catch (err) {
        console.error(`❌ Failed with ${modelName}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

list();
