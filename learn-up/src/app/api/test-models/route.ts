import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const maxDuration = 30;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function jsonFetch(url: string, init: RequestInit, timeout = 8000) {
  const response = await withTimeout(fetch(url, { ...init, cache: "no-store" }), timeout);
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
    throw new Error(`${response.status}: ${message}`);
  }
  return data;
}

async function probe(name: string, provider: string, fn: () => Promise<unknown>) {
  const started = Date.now();
  try {
    const data = await fn();
    return { name, provider, ok: true, latencyMs: Date.now() - started, data };
  } catch (error: any) {
    return { name, provider, ok: false, latencyMs: Date.now() - started, error: error?.message || String(error) };
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const prompt = "Responde únicamente con OK.";
    const results = await Promise.all([
      probe("Groq GPT OSS 20B", "groq", async () => {
        const payload = await jsonFetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY || ""}`, "content-type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }], max_tokens: 8, temperature: 0 }),
        });
        return payload?.choices?.[0]?.message?.content || null;
      }),
      probe("Groq GPT OSS 120B", "groq", async () => {
        const payload = await jsonFetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY || ""}`, "content-type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: prompt }], max_tokens: 8, temperature: 0 }),
        });
        return payload?.choices?.[0]?.message?.content || null;
      }),
      probe("OpenRouter Free Router", "openrouter", async () => {
        const payload = await jsonFetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`, "content-type": "application/json" },
          body: JSON.stringify({ model: "openrouter/free", messages: [{ role: "user", content: prompt }], max_tokens: 8, temperature: 0 }),
        });
        return { model: payload?.model, content: payload?.choices?.[0]?.message?.content || null };
      }),
      probe("Gemini 3.8 Flash", "gemini", async () => {
        const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "";
        const payload = await jsonFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
        });
        return payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || null;
      }),
      probe("NVIDIA Nemotron 3 Super 120B", "nvidia", async () => {
        const payload = await jsonFetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY || ""}`, "content-type": "application/json" },
          body: JSON.stringify({ model: "nvidia/nemotron-3-super-120b-a12b", messages: [{ role: "user", content: prompt }], max_tokens: 8, temperature: 1, top_p: 0.95 }),
        });
        return payload?.choices?.[0]?.message?.content || null;
      }),
    ]);

    const healthy = results.filter((result) => result.ok).length;
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      healthy,
      total: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[test-models]", error);
    return NextResponse.json({ error: error?.message || "Model health check failed" }, { status: 500 });
  }
}
