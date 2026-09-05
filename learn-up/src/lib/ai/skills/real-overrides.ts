import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { browseWebPage } from "@/lib/browser-act";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

async function geminiVision(imageUrl: string, prompt: string) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY.");

  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await response.arrayBuffer());

  const api = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } },
        ],
      }],
      generationConfig: { responseMimeType: "text/plain" },
    }),
  });

  if (!api.ok) throw new Error(`Gemini Vision ${api.status}: ${await api.text()}`);
  const data = await api.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini Vision no devolvió contenido.");
  return text;
}

export const createPollToolReal: ToolDefinition = {
  id: "create_poll",
  category: "chat",
  description: "Crear una encuesta real en un grupo con opciones almacenadas en el mensaje.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: true,
  schema: z.object({
    room_id: z.string().uuid(),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(10),
  }),
  execute: async ({ room_id, question, options }) => {
    const { supabase, user } = await currentUser();
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .select("id,participants")
      .eq("id", room_id)
      .single();
    if (roomError) throw roomError;
    if (!room) throw new Error("Sala no encontrada.");
    const participants = Array.isArray(room.participants) ? room.participants : [];
    if (!participants.includes(user.id)) throw new Error("No perteneces a esta sala.");

    const metadata = { type: "poll", question, options, votes: {}, created_by: user.id };
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ room_id, user_id: user.id, content: question, metadata })
      .select("id,room_id,user_id,content,metadata,created_at")
      .single();
    if (error) throw error;
    return { success: true, message: "Encuesta creada y guardada en el chat.", data: { message: data } };
  },
};

export const createDocumentCollectionToolReal: ToolDefinition = {
  id: "create_document_collection",
  category: "library",
  description: "Crear una colección temática real y asociar documentos del usuario.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: true,
  schema: z.object({
    name: z.string().min(1).max(120),
    document_ids: z.array(z.string().uuid()).default([]),
  }),
  execute: async ({ name, document_ids }) => {
    const { supabase, user } = await currentUser();
    const { data: collection, error } = await supabase
      .from("document_collections")
      .insert({ user_id: user.id, name })
      .select("id,name,created_at")
      .single();
    if (error) throw error;

    if (document_ids.length) {
      const { data: docs, error: docsError } = await supabase
        .from("ai_documents")
        .select("id")
        .eq("user_id", user.id)
        .in("id", document_ids);
      if (docsError) throw docsError;
      const validIds = (docs || []).map((doc: any) => doc.id);
      if (validIds.length) {
        const { error: itemError } = await supabase
          .from("document_collection_items")
          .insert(validIds.map((documentId: string) => ({ collection_id: collection.id, document_id: documentId })));
        if (itemError) throw itemError;
      }
    }

    return {
      success: true,
      message: `Colección '${name}' creada.`,
      data: { collection_id: collection.id, document_count: document_ids.length },
    };
  },
};

export const extractTextFromImageToolReal: ToolDefinition = {
  id: "extract_text_from_image",
  category: "library",
  description: "Extraer texto real de una imagen mediante Gemini Vision.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ image_url: z.string().url() }),
  execute: async ({ image_url }) => {
    const text = await geminiVision(
      image_url,
      "Extrae el texto visible de esta imagen con la mayor fidelidad posible. No inventes palabras. Si no hay texto, dilo explícitamente.",
    );
    return {
      success: true,
      message: "Texto extraído mediante Gemini Vision.",
      data: {
        text,
        source: { url: image_url },
        provider: "gemini-3.8-flash",
      },
    };
  },
};

export const analyzeSourceCredibilityToolReal: ToolDefinition = {
  id: "analyze_source_credibility",
  category: "library",
  description: "Analizar credibilidad usando contenido web recuperado y criterios explícitos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    const page = await browseWebPage(url);
    if (!page.success) return { success: false, error: String(page.content) };

    const { getAICompletion } = await import("@/lib/ai");
    const prompt = [
      "Analiza la credibilidad de esta fuente basándote exclusivamente en el contenido recuperado.",
      "Evalúa autoría identificable, fecha, institución, evidencia, lenguaje/sesgo y limitaciones.",
      "No inventes datos ausentes.",
      `URL: ${url}`,
      `Título: ${page.title || ""}`,
      `Contenido:\n${String(page.content || "").slice(0, 12000)}`,
    ].join("\n");
    const completion = await getAICompletion([{ role: "user", content: prompt }], "gemini-3.8-flash");
    const analysis = completion?.choices?.[0]?.message?.content || "";
    if (!analysis.trim()) return { success: false, error: "No se pudo analizar la credibilidad con la evidencia recuperada." };

    return {
      success: true,
      message: "Credibilidad analizada con contenido web real.",
      data: {
        url,
        title: page.title || url,
        analysis,
        sources: [{ url, title: page.title || url }],
      },
    };
  },
};

export function withRealSkillOverrides(skill: Skill): Skill {
  if (skill.id === "chat") {
    return {
      ...skill,
      tools: skill.tools.map((tool) => tool.id === "create_poll" ? createPollToolReal : tool),
    };
  }

  if (skill.id === "library") {
    return {
      ...skill,
      tools: skill.tools
        .filter((tool) => tool.id !== "query_repositories")
        .map((tool) => {
          if (tool.id === "create_document_collection") return createDocumentCollectionToolReal;
          if (tool.id === "extract_text_from_image") return extractTextFromImageToolReal;
          if (tool.id === "analyze_source_credibility") return analyzeSourceCredibilityToolReal;
          return tool;
        }),
    };
  }

  return skill;
}
