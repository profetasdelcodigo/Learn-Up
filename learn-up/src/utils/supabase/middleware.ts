import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session to ensure cookie is up to date
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define public routes
  const publicRoutes = ["/", "/login"];
  const authRoutes = ["/auth/callback", "/auth/confirm"];
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );
  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");
  const isBypass =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api");

  // Redirect authenticated users away from public routes
  if (session && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Protected routes logic - redirect to login if not authenticated
  if (!user && !isPublicRoute && !isAuthRoute && !isOnboarding && !isBypass) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // CRITICAL: Redirect to onboarding if profile incomplete (catches Google OAuth bypass)
  if (user && !isPublicRoute && !isAuthRoute && !isOnboarding && !isBypass) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, role, school, grade")
      .eq("id", user.id)
      .single();

    if (
      !profile?.username ||
      !profile?.role ||
      !profile?.school ||
      !profile?.grade
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
