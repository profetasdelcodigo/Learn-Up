"use server";

import { createClient } from "@/utils/supabase/server";

export async function uploadLibraryFile(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || "";
    const subject = (formData.get("subject") as string) || "";
    const reviewerUsername = formData.get("reviewer_username") as string;

    if (!file || !title) {
      return { success: false, error: "Archivo y título son requeridos" };
    }

    if (!reviewerUsername) {
      return { success: false, error: "Debes seleccionar un docente revisor" };
    }

    // Find reviewer by username
    const { data: reviewer } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("username", reviewerUsername.replace("@", ""))
      .in("role", ["docente", "admin"])
      .maybeSingle();

    if (!reviewer) {
      return {
        success: false,
        error:
          "No se encontró un docente con ese usuario (@" +
          reviewerUsername +
          ")",
      };
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("library")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: "Error al subir el archivo" };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("library").getPublicUrl(fileName);

    // Determine file type
    let fileType = "document";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt))
      fileType = "image";
    else if (["mp4", "webm", "mov"].includes(fileExt)) fileType = "video";
    else if (["pdf"].includes(fileExt)) fileType = "pdf";

    // Get submitter's profile
    const { data: submitterProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();

    // Save reference to database
    const { data: newItem, error: dbError } = await supabase
      .from("library_items")
      .insert({
        title,
        description,
        subject,
        file_url: publicUrl,
        file_type: fileType,
        user_id: user.id,
        reviewer_id: reviewer.id,
        is_approved: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return { success: false, error: "Error al guardar en la base de datos" };
    }

    // Notify reviewer
    const submitterName =
      submitterProfile?.full_name || submitterProfile?.username || user.email;
    await supabase.from("notifications").insert({
      user_id: reviewer.id,
      type: "library_review",
      title: "Material para revisar",
      message: `${submitterName} te envió "${title}" para revisión en la Biblioteca del Sabio.`,
      sender_id: user.id,
      link: `/library?review=${newItem.id}`,
      is_read: false,
    });

    return { success: true };
  } catch (error) {
    console.error("Error in uploadLibraryFile:", error);
    return { success: false, error: "Error inesperado" };
  }
}

export async function approveLibraryItem(
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: item, error } = await supabase
      .from("library_items")
      .update({ is_approved: true })
      .eq("id", itemId)
      .eq("reviewer_id", user.id)
      .select("title, user_id")
      .single();

    if (error || !item) return { success: false, error: "No se pudo aprobar" };

    // Notify submitter
    await supabase.from("notifications").insert({
      user_id: item.user_id,
      type: "library_approved",
      title: "Material aprobado ✅",
      message: `Tu material "${item.title}" fue aprobado y publicado en la Biblioteca del Sabio.`,
      sender_id: user.id,
      link: "/library",
      is_read: false,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: "Error inesperado" };
  }
}

export async function rejectLibraryItem(
  itemId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: item, error } = await supabase
      .from("library_items")
      .delete()
      .eq("id", itemId)
      .eq("reviewer_id", user.id)
      .select("title, user_id")
      .single();

    if (error || !item) return { success: false, error: "No se pudo rechazar" };

    // Notify submitter
    await supabase.from("notifications").insert({
      user_id: item.user_id,
      type: "library_rejected",
      title: "Material rechazado ❌",
      message: `Tu material "${item.title}" fue rechazado.${reason ? ` Motivo: ${reason}` : ""}`,
      sender_id: user.id,
      link: "/library",
      is_read: false,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: "Error inesperado" };
  }
}
