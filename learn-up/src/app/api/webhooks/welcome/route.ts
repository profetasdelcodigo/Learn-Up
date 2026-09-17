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
  const record = payload.record;
  const { id, email, full_name } = record;

  if (!id || !email) {
    console.log("Welcome email skipped: missing user id or email");
    return new Response("ok (missing user data)", { status: 200 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return new Response("Error de configuración de Supabase", { status: 500 });
  }

  // Claim the send before calling Resend so duplicate webhook deliveries do not send twice.
  // If Resend fails, remove the claim so a later webhook retry can try again.
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
      from: "Learn Up <bienvenida@learnup.app>",
      to: email,
      subject: "¡Bienvenido a Learn Up! 🎓",
      react: WelcomeEmail({ name: full_name || "estudiante" }),
    });

    console.log("Correo de bienvenida enviado:", data);
    return new Response("ok", { status: 200 });
  } catch (err) {
    // Do not leave a failed delivery marked as sent; allow the webhook provider to retry.
    await supabase.from("welcome_emails_sent").delete().eq("user_id", id);
    console.error("Error enviando el correo de bienvenida:", err);
    return new Response("Error interno enviando correo", { status: 500 });
  }
}
