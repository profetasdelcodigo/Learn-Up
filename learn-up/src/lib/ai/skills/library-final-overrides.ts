import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { uploadLibraryFile } from "@/actions/library";
import { createClient } from "@/utils/supabase/server";
import { getAICompletion, AI_MODELS } from "@/lib/ai";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

const uploadLibraryFileExecutable: ToolDefinition = {
  id: "upload_library_file", category: "library",
  description: "Sube un archivo desde una URL HTTPS a la Biblioteca y lo registra para revisión docente.",
  risk: "write", requiresConfirmation: true, supportsAutopilot: false,
  schema: z.object({
    file_url: z.string().url(), title: z.string().min(1).max(200), subject: z.string().max(120).optional(),
    description: z.string().max(1000).optional(), reviewer_username: z.string().min(2),
  }),
  execute: async ({ file_url, title, subject, description, reviewer_username }) => {
    const response = await fetch(file_url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo descargar el archivo (${response.status}).`);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("El archivo excede 25 MB.");
    const pathname = new URL(file_url).pathname;
    const filename = pathname.split("/").pop() || "material.bin";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: contentType }), filename);
    form.append("title", title);
    form.append("subject", subject || "");
    form.append("description", description || "");
    form.append("reviewer_username", reviewer_username);
    const result = await uploadLibraryFile(form);
    if (!result.success) return { success: false, error: result.error || "No se pudo registrar el material." };
    return { success: true, message: "Material subido y enviado al flujo real de revisión.", data: { title, sourceUrl: file_url, reviewer_username } };
  },
};

const downloadAsPdfExecutable: ToolDefinition = {
  id: "download_as_pdf", category: "library",
  description: "Devuelve una URL real descargable cuando el documento ya está publicado como PDF o una instrucción verificable para el navegador.",
  risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ document_id: z.string(), mode: z.enum(["direct", "print"]).default("direct") }),
  execute: async ({ document_id, mode }) => {
    const { supabase } = await getUser();
    const { data, error } = await supabase.from("ai_documents").select("id,title,source_url,mime_type").eq("id", document_id).single();
    if (error || !data) return { success: false, error: "Documento no encontrado." };
    if (mode === "direct" && /pdf/i.test(String(data.mime_type || "")) && data.source_url) {
      return { success: true, message: "PDF listo para descargar.", data: { downloadUrl: data.source_url, title: data.title, mode: "direct" } };
    }
    return { success: true, message: "El documento puede exportarse sin alterar el original usando la impresión del navegador.", data: { documentId: document_id, title: data.title, sourceUrl: data.source_url, mode: "print", action: "open_source_and_print_to_pdf" } };
  },
};

const translateDocumentExecutable: ToolDefinition = {
  id: "translate_document", category: "library",
  description: "Traduce el contenido indexado de un documento usando el modelo gratuito vigente y conserva su trazabilidad.",
  risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ document_id: z.string(), target_language: z.string().min(2).max(40) }),
  execute: async ({ document_id, target_language }) => {
    const { supabase } = await getUser();
    const { data: chunks, error } = await supabase.from("ai_document_chunks").select("content,chunk_index").eq("document_id", document_id).order("chunk_index", { ascending: true });
    if (error) throw error;
    const content = (chunks || []).map((row: any) => String(row.content || "")).join("\n\n");
    if (!content.trim()) return { success: false, error: "El documento no tiene contenido indexado." };
    const result = await getAICompletion([{ role: "user", content: `Traduce fielmente el siguiente documento al ${target_language}. Conserva títulos, listas, tablas sencillas y el significado. No inventes información.\n\n${content}` }], AI_MODELS.geminiFast.id);
    const translated = String(result?.choices?.[0]?.message?.content || "").trim();
    if (!translated) return { success: false, error: "No se pudo producir una traducción." };
    return { success: true, message: `Documento traducido al ${target_language}.`, data: { documentId: document_id, targetLanguage: target_language, content: translated, model: result?._learnUp?.model } };
  },
};

export function withFinalLibraryOverrides(skill: Skill): Skill {
  if (skill.id !== "library") return skill;
  const overrides: Record<string, ToolDefinition> = {
    upload_library_file: uploadLibraryFileExecutable,
    download_as_pdf: downloadAsPdfExecutable,
    translate_document: translateDocumentExecutable,
  };
  const tools = skill.tools.map((tool) => overrides[tool.id] || tool);
  for (const tool of Object.values(overrides)) if (!tools.some((candidate) => candidate.id === tool.id)) tools.push(tool);
  return { ...skill, tools };
}
