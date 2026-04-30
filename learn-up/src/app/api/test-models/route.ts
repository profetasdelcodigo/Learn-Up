import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key found in env." },
        { status: 500 },
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.models) {
      return NextResponse.json({ error: "Could not fetch models", detail: data }, { status: 500 });
    }

    const allModels = data.models.map((m: any) => m.name.replace('models/', ''));

    return NextResponse.json({
      total: allModels.length,
      models: allModels,
      recommended: allModels.filter((m: string) => m.includes("gemini-3") || m.includes("gemini-2.5")),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
