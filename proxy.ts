import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// `/api/calendar-feed` is exempt because Apple Calendar polls it without a
// cookie; that route authenticates itself with CALENDAR_FEED_SECRET instead.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/calendar-feed"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env.SESSION_SECRET ?? "";
  const authenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", safeReturnPath(`${pathname}${request.nextUrl.search}`));
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
