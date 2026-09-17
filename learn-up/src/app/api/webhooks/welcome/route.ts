import { Resend } from "resend";
import WelcomeEmail from "@/emails/welcome";
import { createAdminClient } from "@/utils/supabase/admin";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: Request) {
  if (req.headers.get("x-webhook-secret") !== process.env.NEW_USER_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const record = payload.record ?? {};
  const id = record.id;

  if (!id) {
    console.log("Welcome email skipped: missing user id");
    return new Response("ok (missing user id)", { status: 200 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return new Response("Error de configuración de Supabase", { status: 500 });
  }

  let email = record.email as string | undefined;
  let fullName = record.full_name as string | undefined;

  if (!email) {
    const { data: authUserData, error: authUserError } =
      await supabase.auth.admin.getUserById(id);

    if (authUserError || !authUserData.user?.email) {
      console.error("Welcome email skipped: could not resolve auth user email", authUserError);
      return new Response("ok (missing user email)", { status: 200 });
    }

    email = authUserData.user.email;
    fullName =
      fullName ||
      (authUserData.user.user_metadata?.full_name as string | undefined) ||
      (authUserData.user.user_metadata?.name as string | undefined);
  }

  const { error: claimError } = await supabase
    .from("welcome_emails_sent")
    .insert({ user_id: id });

  if (claimError) {
    console.log("Correo de bienvenida ya procesado para:", email);
    return new Response("ok (ya procesado)", { status: 200 });
  }

  if (!resend) {
    console.error("RESEND_API_KEY missing; welcome email was not sent");
    await supabase.from("welcome_emails_sent").delete().eq("user_id", id);
    return new Response("Resend no configurado", { status: 500 });
  }

  try {
    const data = await resend.emails.send({
      // Resend's verified test sender works without configuring a custom domain.
      from: "Learn Up <onboarding@resend.dev>",
      to: email,
      subject: "¡Bienvenido a Learn Up! 🎓",
      react: WelcomeEmail({ name: fullName || "estudiante" }),
    });

    if (data.error) {
      await supabase.from("welcome_emails_sent").delete().eq("user_id", id);
      console.error("Resend rechazó el correo de bienvenida:", data.error);
      return new Response("Error enviando correo", { status: 502 });
    }

    console.log("Correo de bienvenida enviado:", data.data);
    return new Response("ok", { status: 200 });
  } catch (err) {
    await supabase.from("welcome_emails_sent").delete().eq("user_id", id);
    console.error("Error enviando el correo de bienvenida:", err);
    return new Response("Error interno enviando correo", { status: 500 });
  }
}
