"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { Resend } from "resend";
import { DeleteAccountEmail } from "@/emails/deleteAccount";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use the Service Role Key to bypass RLS and delete users from auth.users
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

export async function deleteAccountAction() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No estás autenticado.");
  }

  const userEmail = user.email;
  const userFirstName = user.user_metadata?.full_name?.split(" ")[0] || "Usuario";

  try {
    // 1. Delete user from Supabase using Admin API
    const supabaseAdmin = getSupabaseAdmin();
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.error("Error al borrar usuario de Supabase:", deleteError);
      throw new Error("No se pudo eliminar la cuenta de Supabase.");
    }

    // 2. Clear cookies
    const cookieStore = await cookies();
    cookieStore.delete("sb-qmgx-auth-token"); // Ajusta el nombre de la cookie si es diferente

    // 3. Send farewell email via Resend
    if (userEmail && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: "Learn Up <onboarding@resend.dev>", // Replace with your verified domain
        to: userEmail,
        subject: "Confirmación de eliminación de cuenta - Learn Up",
        react: DeleteAccountEmail({ userFirstName }),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error en deleteAccountAction:", error);
    return { success: false, error: error.message };
  }
}
