import { Resend } from "resend";
import ConfirmSignupEmail from "@/emails/confirmSignup";
import { createAdminClient } from "@/utils/supabase/admin";

const productionSiteUrl = "https://learn-up-qmgx.onrender.com";

function getSiteUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  try {
    return new URL(request.url).origin;
  } catch {
    return productionSiteUrl;
  }
}

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
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabase) {
      return Response.json(
        { error: "El servicio de autenticación no está configurado correctamente." },
        { status: 500 },
      );
    }

    if (!resendApiKey) {
      return Response.json(
        { error: "El servicio de correo no está configurado correctamente." },
        { status: 500 },
      );
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });

    if (error || !data?.properties?.action_link) {
      const message = error?.message || "No se pudo crear la cuenta.";
      const alreadyRegistered = /already registered|already exists|email.*exists|user.*exists/i.test(message);

      if (alreadyRegistered) {
        return Response.json(
          { error: "Este correo ya está registrado. Inicia sesión en lugar de crear otra cuenta." },
          { status: 409 },
        );
      }

      console.error("Signup generateLink error:", error);
      return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
    }

    const siteUrl = getSiteUrl(request);
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent("/onboarding")}`;
    const confirmationUrl = new URL(data.properties.action_link);
    confirmationUrl.searchParams.set("redirect_to", redirectTo);

    const resend = new Resend(resendApiKey);
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "Learn Up <bienvenida@learnup.app>";

    const { error: emailError } = await resend.emails.send({
      from,
      to: email,
      subject: "Confirma tu correo para entrar a Learn Up 🎓",
      react: ConfirmSignupEmail({
        recipientEmail: email,
        confirmationUrl: confirmationUrl.toString(),
      }),
    });

    if (emailError) {
      console.error("Resend signup confirmation error:", emailError);
      return Response.json(
        { error: "La cuenta fue creada, pero no pudimos enviar el correo de confirmación. Intenta solicitarlo de nuevo." },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unexpected signup error:", error);
    return Response.json({ error: "Ocurrió un error inesperado al crear la cuenta." }, { status: 500 });
  }
}
