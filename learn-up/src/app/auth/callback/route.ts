import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const PRODUCTION_URL = "https://learn-up-qmgx.onrender.com";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // FORCED PRODUCTION REDIRECT
      return NextResponse.redirect(`${PRODUCTION_URL}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${PRODUCTION_URL}/auth/auth-code-error`);
}
