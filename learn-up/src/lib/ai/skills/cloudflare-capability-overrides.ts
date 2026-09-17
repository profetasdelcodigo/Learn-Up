import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { cloudflareVision, cloudflareTts, cloudflareStt, generateCloudflareImage, generateCloudflareVideo } from "@/lib/ai/cloudflare-media";

async function uploadPublic(buffer: Buffer | ArrayBuffer, mime: string, extension: string, prefix: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado para guardar el resultado multimedia.");
  const path = `${user.id}/ai/cloudflare-${prefix}-${crypto.randomUUID()}.${extension}`;
  const body = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  const { error } = await supabase.storage.from("ai_media").upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return supabase.storage.from("ai_media").getPublicUrl(path).data.publicUrl;
}

async function uploadDataUrl(dataUrl: string, mime: string, extension: string, prefix: string) {
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) throw new Error("Resultado multimedia inválido.");
  return uploadPublic(Buffer.from(base64, "base64"), mime, extension, prefix);
}

function replaceTool(skill: Skill, id: string, execute: ToolDefinition["execute"]): Skill {
  return { ...skill, tools: skill.tools.map((tool) => tool.id === id ? { ...tool, execute } : tool) };
}

export function withCloudflareCapabilityRouting(skill: Skill): Skill {
  let next = skill;
  const original = new Map(next.tools.map((tool) => [tool.id, tool]));

  const override = (id: string, handler: ToolDefinition["execute"]) => {
    const base = original.get(id);
    if (!base?.execute) return;
    next = replaceTool(next, id, async (args: any, context: any) => {
      try {
        return await handler!(args, context);
      } catch (cloudflareError) {
        console.warn(`[Learn Up] Cloudflare capability fallback for ${id}:`, cloudflareError);
        return base.execute!(args, context);
      }
    });
  };

  override("generate_image", async ({ prompt, purpose }: any) => {
    const generated = await generateCloudflareImage(`${prompt}${purpose ? `\nPurpose: ${purpose}` : ""}`);
    const url = await uploadDataUrl(generated.url, generated.mediaType, "png", "image");
    return { success: true, message: `Imagen generada con Cloudflare Workers AI.\n\n![Imagen generada](${url})`, data: { url, media_url: url, media_type: "image", provider: generated.provider, model: generated.model } };
  });

  override("generate_thumbnail", async ({ topic, text }: any) => {
    const generated = await generateCloudflareImage(`Miniatura educativa moderna para: ${topic}. ${text ? `Texto visible: ${text}.` : "Sin texto superpuesto."} Composición 16:9.`, { width: 1280, height: 720, quality: "fast" });
    const url = await uploadDataUrl(generated.url, generated.mediaType, "png", "thumbnail");
    return { success: true, message: `Miniatura generada con Cloudflare Workers AI.\n\n![Miniatura](${url})`, data: { url, media_url: url, media_type: "image", provider: generated.provider, model: generated.model } };
  });

  override("generate_ai_profile_avatar", async ({ style, prompt }: any) => {
    const generated = await generateCloudflareImage(`Avatar de perfil ${style}. ${prompt}. Retrato cuadrado, limpio y apropiado para una plataforma educativa.`, { width: 768, height: 768 });
    const url = await uploadDataUrl(generated.url, generated.mediaType, "png", "avatar");
    return { success: true, message: `Avatar generado con Cloudflare Workers AI.\n\n![Avatar generado](${url})`, data: { url, media_url: url, media_type: "image", provider: generated.provider, model: generated.model } };
  });

  override("generate_video", async ({ prompt, purpose }: any) => {
    const generated = await generateCloudflareVideo(`${prompt}${purpose ? `\nPurpose: ${purpose}` : ""}`);
    return { success: true, message: `Vídeo generado con Cloudflare Workers AI.\n\n[▶️ Ver vídeo generado](${generated.url})`, data: { url: generated.url, media_url: generated.url, media_type: "video", provider: generated.provider, model: generated.model } };
  });

  override("search_image", async ({ query, orientation }: any) => {
    const result = await original.get("search_image")?.execute?.({ query, orientation }, undefined as any);
    if (!result?.success) return result;
    const photos = Array.isArray(result?.data?.photos) ? result.data.photos : [];
    const imageMarkdown = photos.slice(0, 6).map((photo: any, index: number) => {
      const url = typeof photo?.url === "string" ? photo.url : "";
      if (!url) return "";
      const alt = String(photo?.alt || `Imagen ${index + 1}`).replace(/[\[\]]/g, "");
      const source = typeof photo?.sourceUrl === "string" ? photo.sourceUrl : url;
      return `![${alt}](${url})\n[Ver en Unsplash](${source})`;
    }).filter(Boolean).join("\n\n");
    return {
      ...result,
      message: `Encontré ${photos.length} imágenes reales en Unsplash.${imageMarkdown ? `\n\n${imageMarkdown}` : ""}\n\nFuente: Unsplash`,
      data: {
        ...(result.data || {}),
        provider: "unsplash",
        source: "Unsplash",
        attribution: "Imágenes proporcionadas por Unsplash",
      },
    };
  });

  override("analyze_image", async ({ image_url, question }: any) => {
    const result = await cloudflareVision(image_url, question || "Describe con detalle la imagen, extrae texto visible y señala incertidumbres.");
    return { success: true, message: "Imagen analizada con Cloudflare Vision.", data: { analysis: result.text, content: result.text, source: { url: image_url }, provider: result.provider, model: result.model } };
  });

  override("describe_math_image", async ({ image_url, problem_description }: any) => {
    const result = await cloudflareVision(image_url, `Extrae exactamente el problema matemático visible y resuélvelo paso a paso. ${problem_description || "No hay contexto adicional."} No inventes símbolos que no sean visibles.`);
    return { success: true, message: "Problema matemático analizado con Cloudflare Vision.", data: { solution_context: result.text, content: result.text, source: { url: image_url }, provider: result.provider, model: result.model } };
  });

  override("extract_colors_from_image", async ({ image_url }: any) => {
    const result = await cloudflareVision(image_url, "Identifica hasta 8 colores dominantes. Devuelve nombre descriptivo y HEX aproximado para cada uno y aclara que son aproximaciones visuales.");
    return { success: true, message: "Colores extraídos con Cloudflare Vision.", data: { colors: result.text, content: result.text, source: { url: image_url }, provider: result.provider, model: result.model } };
  });

  override("text_to_speech", async ({ text }: any) => {
    const generated = await cloudflareTts(text, "es");
    const url = await uploadDataUrl(generated.url, generated.mediaType, "mp3", "tts");
    return { success: true, message: `Audio generado con Cloudflare MeloTTS.\n\n[🔊 Reproducir audio](${url})`, data: { url, media_url: url, media_type: "audio", provider: generated.provider, model: generated.model } };
  });

  override("transcribe_audio", async ({ audio_url }: any) => {
    const response = await fetch(audio_url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo descargar el audio (${response.status}).`);
    const mime = response.headers.get("content-type") || "audio/mpeg";
    const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    const result = await cloudflareStt(`data:${mime};base64,${base64}`);
    return { success: true, message: "Audio transcrito con Cloudflare Whisper.", data: { transcript: result.text, source: { url: audio_url }, provider: result.provider, model: result.model } };
  });

  return next;
}
