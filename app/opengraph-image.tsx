import { brandImage, OG_SIZE } from "@/lib/og";

// The preview shown when a link to the app is pasted somewhere. proxy.ts lets this one path through
// without a session, since whatever fetches a preview is never signed in.
export const alt = "DMG Client Tracker";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandImage();
}
