import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { collections } from "@/lib/mongodb";
import { getObject } from "@/lib/r2";

// The R2 bucket is private; the dashboard loads screenshots through this route.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/screenshots/[id]">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return new Response("Not found", { status: 404 });

  const { screenshots } = await collections();
  const screenshot = await screenshots.findOne({ _id: new ObjectId(id) });
  if (!screenshot) return new Response("Not found", { status: 404 });

  const object = await getObject(screenshot.r2Key);
  return new Response(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
