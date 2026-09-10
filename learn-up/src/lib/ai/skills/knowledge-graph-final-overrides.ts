import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";
import { getAICompletion, getAIEmbedding, AI_MODELS } from "@/lib/ai";

const importConceptsPersistently: ToolDefinition = {
  id: "import_concepts_from_document", category: "knowledge_graph",
  description: "Extrae conceptos de un documento indexado y los guarda realmente en el grafo del usuario.",
  risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({ document_id: z.string().uuid(), max_concepts: z.number().int().min(1).max(30).default(10) }),
  execute: async ({ document_id, max_concepts }) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autorizado");
    const { data: document, error: docError } = await supabase.from("ai_documents").select("id,title").eq("id", document_id).eq("user_id", user.id).single();
    if (docError || !document) return { success: false, error: "Documento no encontrado o no pertenece al usuario." };
    const { data: chunks, error: chunkError } = await supabase.from("ai_document_chunks").select("content,chunk_index").eq("document_id", document_id).order("chunk_index", { ascending: true });
    if (chunkError) throw chunkError;
    const source = (chunks || []).map((row: any) => String(row.content || "")).join("\n\n").trim();
    if (!source) return { success: false, error: "El documento no tiene contenido indexado." };
    const prompt = `Extrae hasta ${max_concepts} conceptos importantes del documento. Devuelve SOLO JSON válido como un array de objetos con title, description y subject. No inventes conceptos que no estén respaldados por el texto.\n\nDOCUMENTO: ${document.title}\n${source}`;
    const completion = await getAICompletion([{ role: "user", content: prompt }], AI_MODELS.openRouterResearch.id, true);
    const raw = String(completion?.choices?.[0]?.message?.content || "[]");
    let items: any[] = [];
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.concepts) ? parsed.concepts : [];
    } catch {
      const block = raw.match(/\[[\s\S]*\]/)?.[0];
      if (block) {
        try { const parsed = JSON.parse(block); items = Array.isArray(parsed) ? parsed : []; } catch { items = []; }
      }
    }
    items = items.filter((item) => item && typeof item.title === "string" && item.title.trim()).slice(0, max_concepts);
    if (!items.length) return { success: false, error: "El modelo no devolvió conceptos estructurados válidos." };
    const saved: any[] = [];
    for (const item of items) {
      const title = item.title.trim();
      const description = typeof item.description === "string" ? item.description.trim() : "";
      const subject = typeof item.subject === "string" && item.subject.trim() ? item.subject.trim() : document.title;
      const { data: existing } = await supabase.from("knowledge_nodes").select("id,title").eq("user_id", user.id).ilike("title", title).maybeSingle();
      if (existing) { saved.push({ ...existing, alreadyExisted: true }); continue; }
      const embedding = await getAIEmbedding(`Título: ${title}\nDescripción: ${description}`);
      const { data: node, error } = await supabase.from("knowledge_nodes").insert({ user_id: user.id, title, description, embedding: `[${embedding.join(",")}]`, source_type: subject }).select("id,title,description,source_type,created_at").single();
      if (error) throw error;
      saved.push(node);
    }
    return { success: true, message: `${saved.length} conceptos procesados y sincronizados con el grafo.`, data: { documentId: document_id, concepts: saved, model: completion?._learnUp?.model } };
  },
};

export function withFinalKnowledgeGraphOverrides(skill: Skill): Skill {
  if (skill.id !== "knowledge_graph") return skill;
  return { ...skill, tools: skill.tools.map((tool) => tool.id === importConceptsPersistently.id ? importConceptsPersistently : tool) };
}
