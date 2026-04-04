/**
 * Keeps Supabase Auth sessions fresh for App Router requests and protects the
 * internal admin routes from unauthenticated access. Authorization is handled
 * later in server code so we can return a clean "not authorized" experience
 * for signed-in non-admin users.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, user } = await updateSession(request);

  response.headers.set("x-current-path", pathname);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/admin/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
