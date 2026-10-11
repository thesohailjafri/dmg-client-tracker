import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { pullReviews } from "@/lib/reviews";

// One Google call per client, one after another.
export const maxDuration = 300;

// Called by the Cloudflare Worker on the weekly cron tick: read every active client's Google rating
// and review count, for the review graphs.
export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  try {
    const result = await pullReviews();
    return Response.json(result, { status: result.failed.length > 0 ? 502 : 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Review pull failed" }, { status: 500 });
  }
}
