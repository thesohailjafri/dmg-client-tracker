import type { NextRequest } from "next/server";
import { sendToGoogle } from "@/lib/review-clicks";

// What a client's review QR code points at: counted as a scan, then straight on to Google. A
// scanned code opens in the browser with no preview to show, so it skips the link's page.
export async function GET(request: NextRequest, ctx: RouteContext<"/review/[slug]/qr">) {
  const { slug } = await ctx.params;
  return sendToGoogle(request, slug, "qr");
}
