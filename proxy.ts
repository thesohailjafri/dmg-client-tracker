import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { onReviewDomain } from "@/lib/review-link";

// Everything is internal: no session (or Worker secret) means no access. The exceptions are a
// client's read-only graphs link, where the long random token in the address is the permission,
// and a client's review link, which is handed to the business's customers and only sends them on
// to Google. (/review-kit is not under /review/ and stays internal.)
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The review domain, when there is one, serves review links and nothing else: every address on
  // it is read as a review link, so the sign-in page and the API do not exist there.
  if (onReviewDomain(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/review${pathname}`;
    return NextResponse.rewrite(url);
  }
  if (pathname === "/login" || pathname === "/api/auth/login") return NextResponse.next();
  if (pathname.startsWith("/share/")) return NextResponse.next();
  if (pathname.startsWith("/review/")) return NextResponse.next();
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
