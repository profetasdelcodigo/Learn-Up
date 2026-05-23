import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key found in env." },
        { status: 500 },
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!data.models) {
      return NextResponse.json(
        { error: "Could not fetch models" },
        { status: 500 },
      );
    }

    const allModels = data.models.map((model: any) =>
      model.name.replace("models/", ""),
    );

    return NextResponse.json({
      total: allModels.length,
      models: allModels,
      recommended: allModels.filter(
        (model: string) =>
          model.includes("gemini-3") || model.includes("gemini-2.5"),
      ),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
