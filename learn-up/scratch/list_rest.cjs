const apiKey = process.env.AI_API_KEY;

async function list() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.models) {
      console.log("Available models:");
      data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`));
    } else {
      console.log("No models found or error:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

list();
