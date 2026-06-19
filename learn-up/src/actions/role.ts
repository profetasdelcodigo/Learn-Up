"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function requestTutorRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { success: false, error: "Error al obtener perfil" };
  }

  if (profile.role === "profesor" || profile.role === "admin") {
    return { success: false, error: "Ya tienes rol de profesor o admin." };
  }

  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

  if (N8N_WEBHOOK_URL) {
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_tutor_role",
          user_id: user.id,
          email: profile.email || user.email,
          full_name: profile.full_name,
        }),
      });

      if (!response.ok) {
        console.error("Error enviando solicitud a n8n:", await response.text());
        return { success: false, error: "Error enviando solicitud de aprobación." };
      }
    } catch (e) {
      console.error("Excepción enviando solicitud a n8n:", e);
      return { success: false, error: "No se pudo contactar al sistema de aprobación." };
    }
  } else {
    console.warn("N8N_WEBHOOK_URL no está configurada.");
  }

  return { success: true };
}

/**
 * Aprueba a un usuario como tutor.
 * Esta función es interna y solo debe ser llamada por procesos seguros o administradores.
 */
export async function approveTutorRole(userId: string) {
  const adminClient = createAdminClient();
  if (!adminClient) {
    throw new Error("No se pudo inicializar el cliente de administración");
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ role: "profesor" })
    .eq("id", userId);

  if (error) {
    console.error("Error actualizando rol a profesor:", error);
    return { success: false, error: "Error al actualizar el rol" };
  }

  return { success: true };
}
