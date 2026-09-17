import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createServerNotification } from "@/utils/server-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIBRARY_BUCKET = "library";
const MAX_LIBRARY_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_LIBRARY_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "txt", "ppt", "pptx",
  "mp4", "webm", "mov", "m4v",
  "png", "jpg", "jpeg", "gif", "webp", "svg",
]);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("No autenticado", 401);

    const formData = await request.formData();
    const file = formData.get("file");
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const reviewerUsername = String(formData.get("reviewer_username") || "").trim().replace(/^@/, "");

    if (!(file instanceof File) || !title) return errorResponse("Archivo y título son requeridos");
    if (!reviewerUsername) return errorResponse("Debes seleccionar un docente revisor");

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_LIBRARY_EXTENSIONS.has(extension)) return errorResponse("Tipo de archivo no permitido en la Biblioteca");
    if (file.size <= 0) return errorResponse("El archivo está vacío");
    if (file.size > MAX_LIBRARY_FILE_BYTES) return errorResponse("El archivo supera el límite de 50 MB");

    // Prefer the server-only admin client, but keep the authenticated client as
    // a safe fallback so uploads are not completely blocked by a missing secret.
    const admin = createAdminClient();
    const db = admin || supabase;
    const storage = admin || supabase;

    const { data: reviewer, error: reviewerError } = await db
      .from("profiles")
      .select("id, full_name, username, role")
      .eq("username", reviewerUsername)
      .in("role", ["docente", "admin"])
      .maybeSingle();

    if (reviewerError) {
      console.error("[library/upload] Reviewer lookup failed:", reviewerError);
      return errorResponse(`No se pudo comprobar el docente revisor: ${reviewerError.message}`, 500);
    }
    if (!reviewer) return errorResponse(`No se encontró un docente con el usuario @${reviewerUsername}`);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const objectPath = `${user.id}/${Date.now()}-${safeName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.storage.from(LIBRARY_BUCKET).upload(objectPath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      console.error("[library/upload] Storage upload failed:", uploadError);
      return errorResponse(`No se pudo subir el archivo a la Biblioteca: ${uploadError.message}`, 500);
    }

    const { data: publicData } = storage.storage.from(LIBRARY_BUCKET).getPublicUrl(objectPath);
    const publicUrl = publicData.publicUrl;

    let fileType = "document";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) fileType = "image";
    else if (["mp4", "webm", "mov", "m4v"].includes(extension)) fileType = "video";
    else if (extension === "pdf") fileType = "pdf";

    const { data: submitterProfile } = await db
      .from("profiles")
      .select("role, full_name, username")
      .eq("id", user.id)
      .maybeSingle();

    const isTeacher = ["docente", "admin"].includes(submitterProfile?.role || "");
    const reviewerId = isTeacher ? user.id : reviewer.id;

    const { data: newItem, error: dbError } = await db
      .from("library_items")
      .insert({
        title,
        description,
        subject,
        file_url: publicUrl,
        file_type: fileType,
        user_id: user.id,
        reviewer_id: reviewerId,
        is_approved: isTeacher,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[library/upload] Database insert failed:", dbError);
      await storage.storage.from(LIBRARY_BUCKET).remove([objectPath]).catch(() => undefined);
      return errorResponse(`No se pudo registrar el material en la Biblioteca: ${dbError.message}`, 500);
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
        console.error("[library/upload] Review notification failed after successful upload:", notificationError);
      }
    }

    return NextResponse.json({ success: true, itemId: newItem.id });
  } catch (error: any) {
    console.error("[library/upload] Unexpected error:", error);
    return errorResponse(error?.message || "Error inesperado al subir el material", 500);
  }
}
