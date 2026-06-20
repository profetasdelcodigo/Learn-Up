import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Verificamos el secreto de Supabase Webhooks
  if (req.headers.get("x-webhook-secret") !== process.env.NEW_USER_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const record = payload.record; // payload del Database Webhook de Supabase
  const old_record = payload.old_record;

  // Si el rol acaba de cambiar a docente (o se creó como docente)
  const wasDocente = old_record?.role === "docente";
  const isDocente = record?.role === "docente";

  if (isDocente && !wasDocente) {
    // Enviar a Make.com
    const makeWebhookUrl = process.env.MAKE_TUTOR_WEBHOOK_URL;
    if (makeWebhookUrl) {
      try {
        await fetch(makeWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: record.id,
            full_name: record.full_name,
            email: record.email, // Depende de si tenemos el email. En profiles no solemos tenerlo, quizás haya que buscarlo
            school: record.school,
            grade: record.grade,
          }),
        });
        console.log("Notificación de profesor enviada a Make.com");
      } catch (e) {
        console.error("Error enviando a Make.com:", e);
      }
    }
  }

  return NextResponse.json({ success: true });
}
