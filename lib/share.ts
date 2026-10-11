import { randomBytes } from "node:crypto";
import { appUrl } from "./env";
import { sharePath } from "./graphs";

// The secret in a client's read-only link. It is the only thing protecting that page, so it is
// long, random, and replaced rather than reused.
export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

// The full address of a client's read-only link, as it goes in an email.
export function shareUrl(name: string, token: string): string {
  return `${appUrl()}${sharePath(name, token)}`;
}
