import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

function getBaseUrl(request: Request, requestUrl: URL): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (
    requestUrl.hostname === "localhost" ||
    requestUrl.hostname === "127.0.0.1" ||
    process.env.NODE_ENV === "development"
  ) {
    return requestUrl.origin;
  }

  return process.env.NEXT_PUBLIC_SITE_URL || "https://learn-up-qmgx.onrender.com";
}

function getSafeRedirect(baseUrl: string, next: string): string {
  if (next.startsWith("/") && !next.startsWith("//")) {
    return `${baseUrl}${next}`;
  }

  try {
    const parsed = new URL(next);
    if (parsed.protocol === "com.learnup.app:") {
      return parsed.toString();
    }
  } catch {
    // Fall through to dashboard.
  }

  return `${baseUrl}/dashboard`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const baseUrl = getBaseUrl(request, requestUrl);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(getSafeRedirect(baseUrl, next));
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
