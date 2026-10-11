import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth";

// Everything is internal: no session (or Worker secret) means no access. The one exception is a
// client's read-only graphs link, where the long random token in the address is the permission.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login") return NextResponse.next();
  if (pathname.startsWith("/share/")) return NextResponse.next();
  // the app's link preview image: whatever fetches it is never signed in, and it shows no data
  if (pathname === "/opengraph-image") return NextResponse.next();
  if (isAuthorized(request)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|logo.svg).*)"],
};
