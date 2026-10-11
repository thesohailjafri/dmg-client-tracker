// Read a required env var at call time (not import time) so `next build` works without secrets.
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const AGENCY_NAME = process.env.AGENCY_NAME || "DMG";
export const BRAND_BLUE = "#0066FF";
