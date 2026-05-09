import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Sign out from Supabase (server-side)
  await supabase.auth.signOut();

  // Use the request's origin for the redirect (works in local and production)
  const requestUrl = new URL(request.url);
  const redirectUrl = `${requestUrl.origin}/login`;

  const response = NextResponse.redirect(redirectUrl, { status: 302 });

  // Explicitly clear all Supabase auth cookies to prevent stale session data
  const cookiesToClear = [
    "sb-access-token",
    "sb-refresh-token",
  ];

  // Clear any cookie that starts with "sb-" (Supabase auth cookies)
  const allCookies = request.headers.get("cookie");
  if (allCookies) {
    allCookies.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name.startsWith("sb-")) {
        response.cookies.set(name, "", {
          expires: new Date(0),
          path: "/",
        });
      }
    });
  }

  return response;
}
