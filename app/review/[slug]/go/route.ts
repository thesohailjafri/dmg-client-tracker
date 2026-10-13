import type { NextRequest } from "next/server";
import { sendToGoogle } from "@/lib/review-clicks";

// Where the review link's page sends a person's browser: counted as an opened link, then on to Google.
export async function GET(request: NextRequest, ctx: RouteContext<"/review/[slug]/go">) {
  const { slug } = await ctx.params;
  return sendToGoogle(request, slug, "link");
}
