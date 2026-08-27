import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - public/static assets such as PWA files and images
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|workbox-.*\\.js|worker-.*\\.js|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json|js|css|map|woff|woff2)$).*)",
  ],
};
