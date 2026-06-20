import { Resend } from "resend";
import WelcomeEmail from "@/emails/welcome";
import { createAdminClient } from "@/utils/supabase/admin";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: Request) {
  // Verificamos el secreto de Supabase Webhooks
  if (req.headers.get("x-webhook-secret") !== process.env.NEW_USER_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const record = payload.record; // payload del Database Webhook de Supabase
  const { id, email, full_name } = record;

  const supabase = createAdminClient();
  if (!supabase) {
    return new Response("Error de configuración de Supabase", { status: 500 });
  }

  // Insertamos en la tabla de idempotencia para evitar doble envío
  const { error } = await supabase.from("welcome_emails_sent").insert({ user_id: id });
  
  if (error) {
    // Si da error por llave primaria duplicada, significa que ya se envió
    console.log("Correo ya enviado anteriormente a:", email);
    return new Response("ok (ya enviado)", { status: 200 }); 
  }

  if (!resend) {
    console.log("Resend API key missing, skipping welcome email");
    return new Response("ok (email skipped)", { status: 200 });
  }

  try {
    const data = await resend.emails.send({
      from: "Learn Up <bienvenida@learnup.app>", // El usuario deberá configurar este dominio en Resend
      to: email,
      subject: "¡Bienvenido a Learn Up! 🎓",
      react: WelcomeEmail({ name: full_name || "estudiante" }),
    });
    console.log("Correo enviado:", data);
  } catch (err) {
    console.error("Error enviando el correo:", err);
    return new Response("Error interno enviando correo", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
