// Read a required env var at call time (not import time) so `next build` works without secrets.
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const AGENCY_NAME = process.env.AGENCY_NAME || "DMG";
export const BRAND_BLUE = "#0066FF";
// The team's inbox: where a client's reply to any email lands, and who a dead share link points to.
export const AGENCY_EMAIL = process.env.EMAIL_REPLY_TO || "team@domoregrowth.com";

// Where the app is served from, without a trailing slash. Emails link to it.
export function appUrl(): string {
  return env("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}
