import { createAdminClient } from "@/utils/supabase/admin";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!isValidEmail(email)) {
      return Response.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    if (!supabase) {
      return Response.json(
        { error: "El servicio de autenticación no está configurado correctamente." },
        { status: 500 },
      );
    }

    // Create the account server-side and auto-confirm the email so the demo flow
    // can continue directly to onboarding without a verification email.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data?.user) {
      const message = error?.message || "No se pudo crear la cuenta.";
      const alreadyRegistered = /already registered|already exists|email.*exists|user.*exists/i.test(message);

      if (alreadyRegistered) {
        return Response.json(
          { error: "Este correo ya está registrado. Inicia sesión en lugar de crear otra cuenta." },
          { status: 409 },
        );
      }

      console.error("Signup createUser error:", error);
      return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
    }

    return Response.json({ ok: true, userId: data.user.id });
  } catch (error) {
    console.error("Unexpected signup error:", error);
    return Response.json({ error: "Ocurrió un error inesperado al crear la cuenta." }, { status: 500 });
  }
}
