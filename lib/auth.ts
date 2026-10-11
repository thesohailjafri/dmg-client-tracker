import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Internal tool, one shared team password (APP_PASSWORD). The session cookie holds an HMAC of
// it, so changing the password signs everyone out. The Worker authenticates with WORKER_SECRET.

export const SESSION_COOKIE = "dmg_session";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sessionToken(): string | null {
  const password = process.env.APP_PASSWORD;
  return password ? createHmac("sha256", password).update("dmg-session-v1").digest("hex") : null;
}

export function checkPassword(candidate: string): boolean {
  const password = process.env.APP_PASSWORD;
  return Boolean(password) && safeEqual(candidate, password!);
}

export function isValidSession(cookieValue: string | undefined): boolean {
  const token = sessionToken();
  return Boolean(token && cookieValue) && safeEqual(cookieValue!, token!);
}

function isValidBearer(header: string | null): boolean {
  const secret = process.env.WORKER_SECRET;
  return Boolean(secret && header) && safeEqual(header!, `Bearer ${secret}`);
}

// Team session cookie or the Worker's bearer secret.
export function isAuthorized(request: NextRequest): boolean {
  return (
    isValidSession(request.cookies.get(SESSION_COOKIE)?.value) ||
    isValidBearer(request.headers.get("authorization"))
  );
}

// Route handlers re-check auth themselves instead of relying on proxy.ts alone.
export function unauthorized(request: NextRequest): Response | null {
  return isAuthorized(request)
    ? null
    : Response.json({ error: "Unauthorized" }, { status: 401 });
}
