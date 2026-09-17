"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createServerNotification } from "@/utils/server-notifications";
import { indexAiDocumentFromUrl } from "./ai-tutor";

const LIBRARY_BUCKET = "library";
const MAX_LIBRARY_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_LIBRARY_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "ppt", "pptx", "mp4", "webm", "mov", "m4v", "png", "jpg", "jpeg", "gif", "webp", "svg"]);

function getLibraryObjectPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const marker = `/storage/v1/object/public/${LIBRARY_BUCKET}/`;
  const index = fileUrl.indexOf(marker);
  if (index === -1) return null;
  const path = fileUrl.slice(index + marker.length);
  try { return decodeURIComponent(path); } catch { return path; }
}

async function removeLibraryObject(supabase: Awaited<ReturnType<typeof createClient>>, fileUrl: string | null | undefined) {
  const objectPath = getLibraryObjectPath(fileUrl);
  if (!objectPath) return;
  const admin = createAdminClient();
  const storageClient = admin || supabase;
  const { error } = await storageClient.storage.from(LIBRARY_BUCKET).remove([objectPath]);
  if (error) console.error("[library] Storage cleanup failed:", error);
}

export async function uploadLibraryFile(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const admin = createAdminClient();
    if (!admin) {
      console.error("[uploadLibraryFile] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return { success: false, error: "La Biblioteca no está configurada correctamente en el servidor" };
    }

    const file = formData.get("file") as File | null;
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const reviewerUsername = String(formData.get("reviewer_username") || "").trim().replace(/^@/, "");

    if (!file || !title) return { success: false, error: "Archivo y título son requeridos" };
    if (!reviewerUsername) return { success: false, error: "Debes seleccionar un docente revisor" };

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_LIBRARY_EXTENSIONS.has(extension)) return { success: false, error: "Tipo de archivo no permitido en la Biblioteca" };
    if (file.size <= 0) return { success: false, error: "El archivo está vacío" };
    if (file.size > MAX_LIBRARY_FILE_BYTES) return { success: false, error: "El archivo supera el límite de 50 MB" };

    // Reviewer lookup is done with the server-only admin client so this flow
    // does not depend on client RLS configuration.
    const { data: reviewer, error: reviewerError } = await admin
      .from("profiles")
      .select("id, full_name, username, role")
      .eq("username", reviewerUsername)
      .in("role", ["docente", "admin"])
      .maybeSingle();

    if (reviewerError) {
      console.error("[uploadLibraryFile] Reviewer lookup failed:", reviewerError);
      return { success: false, error: `No se pudo comprobar el docente revisor: ${reviewerError.message}` };
    }
    if (!reviewer) return { success: false, error: `No se encontró un docente con el usuario @${reviewerUsername}` };

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const objectPath = `${user.id}/${Date.now()}-${safeName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Use the server-only admin client for Storage. The user has already been
    // authenticated above, so this bypasses fragile Storage RLS without exposing
    // the service role key to the browser.
    const { error: uploadError } = await admin.storage.from(LIBRARY_BUCKET).upload(objectPath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      console.error("[uploadLibraryFile] Storage upload failed:", uploadError);
      return { success: false, error: `No se pudo subir el archivo a la Biblioteca: ${uploadError.message}` };
    }

    const { data: publicData } = admin.storage.from(LIBRARY_BUCKET).getPublicUrl(objectPath);
    const publicUrl = publicData.publicUrl;

    let fileType = "document";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) fileType = "image";
    else if (["mp4", "webm", "mov", "m4v"].includes(extension)) fileType = "video";
    else if (extension === "pdf") fileType = "pdf";

    const { data: submitterProfile } = await admin
      .from("profiles")
      .select("role, full_name, username")
      .eq("id", user.id)
      .maybeSingle();

    const isTeacher = ["docente", "admin"].includes(submitterProfile?.role || "");
    const reviewerId = isTeacher ? user.id : reviewer.id;

    // Persist the metadata with the same server-only transaction boundary. This
    // prevents a valid Storage upload from being rejected by client RLS.
    const { data: newItem, error: dbError } = await admin.from("library_items").insert({
      title,
      description,
      subject,
      file_url: publicUrl,
      file_type: fileType,
      user_id: user.id,
      reviewer_id: reviewerId,
      is_approved: isTeacher,
    }).select("id").single();

    if (dbError) {
      console.error("[uploadLibraryFile] Database insert failed:", dbError);
      await admin.storage.from(LIBRARY_BUCKET).remove([objectPath]).catch(() => undefined);
      return { success: false, error: `No se pudo registrar el material en la Biblioteca: ${dbError.message}` };
    }

    if (!isTeacher) {
      const submitterName = submitterProfile?.full_name || submitterProfile?.username || user.email || "Un estudiante";
      try {
        await createServerNotification({
          user_id: reviewer.id,
          sender_id: user.id,
          type: "library_review",
          title: "Material para revisar",
          message: `${submitterName} te envió "${title}" para revisión en la Biblioteca.`,
          link: `/library?review=${newItem.id}`,
          is_read: false,
        });
      } catch (notificationError) {
        console.error("[uploadLibraryFile] Review notification failed after successful upload:", notificationError);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("[uploadLibraryFile] Unexpected error:", error);
    return { success: false, error: error?.message || "Error inesperado al subir el material" };
  }
}

export async function approveLibraryItem(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const { data: item, error } = await supabase.from("library_items").update({ is_approved: true }).eq("id", itemId).eq("reviewer_id", user.id).select("title, user_id").single();
    if (error || !item) return { success: false, error: error?.message || "No se pudo aprobar" };
    try {
      await createServerNotification({ user_id: item.user_id, sender_id: user.id, type: "library_approved", title: "Material aprobado ✅", message: `Tu material "${item.title}" fue aprobado y publicado en la Biblioteca.`, link: "/library", is_read: false });
    } catch (notificationError) { console.error("[approveLibraryItem] Notification failed:", notificationError); }
    return { success: true };
  } catch (error: any) { return { success: false, error: error?.message || "Error inesperado" }; }
}

export async function rejectLibraryItem(itemId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const { data: item, error } = await supabase.from("library_items").delete().eq("id", itemId).eq("reviewer_id", user.id).select("title, user_id, file_url").single();
    if (error || !item) return { success: false, error: error?.message || "No se pudo rechazar" };
    await removeLibraryObject(supabase, item.file_url);
    try {
      await createServerNotification({ user_id: item.user_id, sender_id: user.id, type: "library_rejected", title: "Material rechazado ❌", message: `Tu material "${item.title}" fue rechazado.${reason ? ` Motivo: ${reason}` : ""}`, link: "/library", is_read: false });
    } catch (notificationError) { console.error("[rejectLibraryItem] Notification failed:", notificationError); }
    return { success: true };
  } catch (error: any) { return { success: false, error: error?.message || "Error inesperado" }; }
}

export async function deleteOwnLibraryItem(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const { data: item, error } = await supabase.from("library_items").delete().eq("id", itemId).eq("user_id", user.id).select("title, file_url").single();
    if (error || !item) return { success: false, error: error?.message || "No se pudo eliminar el material" };
    await removeLibraryObject(supabase, item.file_url);
    return { success: true };
  } catch (error: any) { return { success: false, error: error?.message || "Error inesperado" }; }
}

export async function adminDeleteLibraryItem(itemId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!["admin", "docente"].includes(profile?.role || "")) return { success: false, error: "No tienes permisos de administrador" };
    const { data: item, error } = await supabase.from("library_items").delete().eq("id", itemId).select("title, user_id, file_url").single();
    if (error || !item) return { success: false, error: error?.message || "No se pudo eliminar" };
    await removeLibraryObject(supabase, item.file_url);
    try {
      await createServerNotification({ user_id: item.user_id, sender_id: user.id, type: "library_rejected", title: "Material eliminado por moderación", message: `Tu material "${item.title}" fue retirado por un moderador. Motivo: ${reason}`, link: "/library", is_read: false });
    } catch (notificationError) { console.error("[adminDeleteLibraryItem] Notification failed:", notificationError); }
    return { success: true };
  } catch (error: any) { return { success: false, error: error?.message || "Error inesperado" }; }
}

export async function searchLibrary(query: string, filters?: { subject?: string; level?: string }) {
  try {
    const supabase = await createClient();
    let queryBuilder = supabase.from("library_items").select("*, profiles:user_id(full_name, username, avatar_url)").eq("is_approved", true).order("created_at", { ascending: false }).limit(50);
    const cleanQuery = String(query || "").trim();
    if (cleanQuery) queryBuilder = queryBuilder.or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`);
    if (filters?.subject?.trim()) queryBuilder = queryBuilder.eq("subject", filters.subject.trim());
    const { data, error } = await queryBuilder;
    if (error) { console.error("[searchLibrary] Error:", error); return []; }
    return data || [];
  } catch (error) { console.error("[searchLibrary] Unexpected error:", error); return []; }
}

export async function getUserIndexedDocuments() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: accidental } = await supabase.from("ai_documents").select("id, source_url").eq("user_id", user.id).ilike("source_url", "%/storage/v1/object/public/library/%");
    if (accidental?.length) await supabase.from("ai_documents").delete().eq("user_id", user.id).in("id", accidental.map((doc: any) => doc.id));
    const { data, error } = await supabase.from("ai_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error("[getUserIndexedDocuments] Error:", error); return []; }
    return data || [];
  } catch (error) { console.error("[getUserIndexedDocuments] Unexpected error:", error); return []; }
}

export async function deleteAiDocument(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const { error } = await supabase.from("ai_documents").delete().eq("id", id).eq("user_id", user.id);
    if (error) return { success: false, error: error.message || "Error al eliminar el documento" };
    return { success: true };
  } catch (error: any) { return { success: false, error: error?.message || "Error inesperado" }; }
}

export async function uploadAndIndexAiDocument(formData: FormData, sessionId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const file = formData.get("file") as File | null;
    const title = String(formData.get("title") || "").trim();
    if (!file || !title) return { success: false, error: "Archivo y título son requeridos" };
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(-120);
    const objectPath = `${user.id}/${Date.now()}_${safeName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("documents").upload(objectPath, fileBuffer, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) {
      console.error("[uploadAndIndexAiDocument] Storage upload failed:", uploadError);
      return { success: false, error: `No se pudo subir el documento de Rincón IA: ${uploadError.message}` };
    }
    const { data: publicData } = supabase.storage.from("documents").getPublicUrl(objectPath);
    const indexResult = await indexAiDocumentFromUrl({ title, url: publicData.publicUrl, mimeType: file.type || undefined, sessionId: sessionId || null });
    if (!indexResult.success) return { success: true, error: `Archivo subido a Rincón IA, pero la indexación quedó pendiente: ${indexResult.error || "error de indexación"}` };
    return { success: true };
  } catch (error: any) {
    console.error("[uploadAndIndexAiDocument] Unexpected error:", error);
    return { success: false, error: error?.message || "Error inesperado" };
  }
}
