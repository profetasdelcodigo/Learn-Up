import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Support for deep linking directly back to mobile apps or relative paths
      if (
        next.startsWith("http://") ||
        next.startsWith("https://") ||
        next.includes("://")
      ) {
        return NextResponse.redirect(next);
      }
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
}
