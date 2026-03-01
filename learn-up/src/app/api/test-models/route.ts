import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

export async function GET() {
  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key found in env." },
        { status: 500 },
      );
    }

    const groq = new Groq({ apiKey });
    const models = await groq.models.list();

    // Filter and sort for easier reading
    const allModels = models.data.map((m: any) => m.id).sort();

    return NextResponse.json({
      total: allModels.length,
      models: allModels,
      vision_candidates: allModels.filter(
        (m) =>
          m.includes("vision") ||
          m.includes("pixtral") ||
          m.includes("llama-4"),
      ),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
