import { AI_MODELS } from "./model-catalog";

const ACCOUNT_ID = () => process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = () => process.env.CLOUDFLARE_API_TOKEN;

function assertCloudflare() {
  if (!ACCOUNT_ID() || !TOKEN()) throw new Error("Cloudflare Workers AI no está configurado (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN).");
}

async function run(model: string, input: unknown, headers?: HeadersInit) {
  assertCloudflare();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID()}/ai/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify({ model, input }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare AI ${response.status}: ${payload?.errors?.[0]?.message || "request failed"}`);
  }
  return payload?.result;
}

export async function generateCloudflareImage(prompt: string, options: { width?: number; height?: number; quality?: "fast" | "quality" } = {}) {
  const model = options.quality === "quality" ? AI_MODELS.cloudflareFluxKlein9b.id.replace("cloudflare/", "") : AI_MODELS.cloudflareFluxKlein4b.id.replace("cloudflare/", "");
  const result = await run(model, { prompt, width: options.width || 1024, height: options.height || 768 });
  const base64 = typeof result?.image === "string" ? result.image : typeof result === "string" ? result : null;
  if (!base64) throw new Error("Cloudflare no devolvió una imagen.");
  return { url: `data:image/png;base64,${base64}`, provider: "cloudflare", model, mediaType: "image/png" };
}

export async function generateCloudflareVideo(prompt: string, options: { duration?: number; ratio?: string; resolution?: "720P" | "1080P" } = {}) {
  const result = await run("alibaba/hh1.1-t2v", {
    prompt,
    duration: Math.min(15, Math.max(3, options.duration || 5)),
    ratio: options.ratio || "16:9",
    resolution: options.resolution || "720P",
  });
  const url = typeof result?.video === "string" ? result.video : null;
  if (!url) throw new Error("Cloudflare no devolvió un video.");
  return { url, provider: "cloudflare", model: "alibaba/hh1.1-t2v", mediaType: "video/mp4" };
}

export async function generateCloudflareImageToVideo(image: string, prompt?: string, options: { duration?: number; ratio?: string; resolution?: "720P" | "1080P" } = {}) {
  const result = await run("alibaba/hh1.1-i2v", {
    image,
    prompt: prompt || "Movimiento suave y natural de la escena.",
    duration: Math.min(15, Math.max(3, options.duration || 5)),
    ratio: options.ratio || "16:9",
    resolution: options.resolution || "720P",
  });
  const url = typeof result?.video === "string" ? result.video : null;
  if (!url) throw new Error("Cloudflare no devolvió un video.");
  return { url, provider: "cloudflare", model: "alibaba/hh1.1-i2v", mediaType: "video/mp4" };
}

export async function cloudflareVision(imageUrl: string, prompt: string) {
  const result = await run("@cf/moondream/moondream3.1-9B-A2B", { image: imageUrl, prompt });
  const text = typeof result?.response === "string" ? result.response : typeof result?.description === "string" ? result.description : String(result || "");
  if (!text.trim()) throw new Error("Cloudflare Vision no devolvió análisis.");
  return { text: text.trim(), provider: "cloudflare", model: "@cf/moondream/moondream3.1-9B-A2B" };
}

export async function cloudflareTts(text: string, lang = "es") {
  const result = await run("@cf/myshell-ai/melotts", { prompt: text, lang });
  const base64 = typeof result?.audio === "string" ? result.audio : typeof result === "string" ? result : null;
  if (!base64) throw new Error("Cloudflare TTS no devolvió audio.");
  return { url: `data:audio/mpeg;base64,${base64}`, provider: "cloudflare", model: "@cf/myshell-ai/melotts", mediaType: "audio/mpeg" };
}

export async function cloudflareStt(audioBase64OrData: string) {
  const result = await run("@cf/openai/whisper", audioBase64OrData);
  const text = typeof result?.text === "string" ? result.text : String(result || "");
  if (!text.trim()) throw new Error("Cloudflare Whisper no devolvió una transcripción.");
  return { text: text.trim(), provider: "cloudflare", model: "@cf/openai/whisper" };
}
