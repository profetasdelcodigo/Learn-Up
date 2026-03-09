import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  // Identificar el host real (necesario en Render debido a su Load Balancer interno)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  let baseUrl = "https://learn-up-qmgx.onrender.com"; // Fallback para producción
  if (forwardedHost) {
    baseUrl = `${forwardedProto}://${forwardedHost}`;
  } else if (
    !requestUrl.hostname.includes("localhost") ||
    process.env.NODE_ENV === "development"
  ) {
    // Si estamos en entorno de desarrollo local real (npm run dev)
    baseUrl = requestUrl.origin;
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Soporte para Deep Links nativos (ej: com.learnup.app://auth)
      if (
        next.startsWith("http://") ||
        next.startsWith("https://") ||
        next.includes("://")
      ) {
        return NextResponse.redirect(next);
      }
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  // Retornar al usuario a un error en el dominio correspondiente
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
