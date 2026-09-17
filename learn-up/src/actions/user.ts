"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { Resend } from "resend";
import { DeleteAccountEmail } from "@/emails/deleteAccount";
import { cookies } from "next/headers";

const resend = new Resend(process.env.RESEND_API_KEY);

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para eliminar cuentas.");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
};

export async function deleteAccountAction() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No estás autenticado." };

  const userEmail = user.email;
  const userFirstName = user.user_metadata?.full_name?.split(" ")[0] || "Usuario";

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Elimina primero el correo de despedida de forma best-effort: un fallo de Resend
    // jamás debe convertir una eliminación ya solicitada en un falso error.
    if (userEmail && process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: "Learn Up <onboarding@resend.dev>",
          to: userEmail,
          subject: "Confirmación de eliminación de cuenta - Learn Up",
          react: DeleteAccountEmail({ userFirstName }),
        });
      } catch (emailError) {
        console.warn("No se pudo enviar el correo de despedida; la cuenta continuará eliminándose:", emailError);
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Error al borrar usuario de Supabase:", deleteError);
      throw new Error("No se pudo eliminar la cuenta de Supabase.");
    }

    const cookieStore = await cookies();
    cookieStore.getAll().forEach((cookie) => {
      if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) cookieStore.delete(cookie.name);
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en deleteAccountAction:", error);
    return { success: false, error: error?.message || "No se pudo eliminar la cuenta." };
  }
}
