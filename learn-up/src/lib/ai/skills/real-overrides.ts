import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

export const createPollToolReal: ToolDefinition = {
  id: "create_poll",
  category: "chat",
  description: "Crear una encuesta real en un grupo con opciones almacenadas en el mensaje.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ room_id: z.string().uuid(), question: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(10) }),
  execute: async ({ room_id, question, options }) => {
    const { supabase, user } = await currentUser();
    const { data: room } = await supabase.from("chat_rooms").select("id,participants,admins,type").eq("id", room_id).single();
    if (!room) throw new Error("Sala no encontrada");
    const participants = Array.isArray(room.participants) ? room.participants : [];
    if (!participants.includes(user.id)) throw new Error("No perteneces a esta sala");
    const metadata = { type: "poll", question, options, votes: {}, created_by: user.id };
    const { data, error } = await supabase.from("chat_messages").insert({ room_id, user_id: user.id, content: question, metadata }).select("id,room_id,user_id,content,metadata,created_at").single();
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
  supportsAutopilot: false,
  schema: z.object({ name: z.string().min(1).max(120), document_ids: z.array(z.string().uuid()).default([]) }),
  execute: async ({ name, document_ids }) => {
    const { supabase, user } = await currentUser();
    const { data: collection, error } = await supabase.from("document_collections").insert({ user_id: user.id, name }).select("id,name,created_at").single();
    if (error) throw error;
    if (document_ids.length) {
      const { data: docs, error: docError } = await supabase.from("ai_documents").select("id").eq("user_id", user.id).in("id", document_ids);
      if (docError) throw docError;
      const validIds = (docs || []).map((d: any) => d.id);
      if (validIds.length) {
        const { error: itemError } = await supabase.from("document_collection_items").insert(validIds.map((document_id: string) => ({ collection_id: collection.id, document_id })));
        if (itemError) throw itemError;
      }
    }
    return { success: true, message: `Colección '${name}' creada.`, data: { collection_id: collection.id, document_count: document_ids.length } };
  },
};

export function withRealSkillOverrides(skill: Skill): Skill {
  if (skill.id === "chat") {
    return { ...skill, tools: skill.tools.map((tool) => tool.id === "create_poll" ? createPollToolReal : tool) };
  }
  if (skill.id === "library") {
    return { ...skill, tools: skill.tools.filter((tool) => tool.id !== "query_repositories").map((tool) => tool.id === "create_document_collection" ? createDocumentCollectionToolReal : tool) };
  }
  return skill;
}
