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

    if (!file || !title) {
      return { success: false, error: "Archivo y título son requeridos" };
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("library")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: "Error al subir el archivo" };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("library").getPublicUrl(filePath);

    // Save reference to database
    const { error: dbError } = await supabase.from("library_items").insert({
      title,
      file_url: publicUrl,
      user_id: user.id, // Correct column according to most recent instruction
      is_approved: false,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return { success: false, error: "Error al guardar en la base de datos" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in uploadLibraryFile:", error);
    return { success: false, error: "Error inesperado" };
  }
}
