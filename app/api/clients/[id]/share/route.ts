import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { collections } from "@/lib/mongodb";
import { newShareToken } from "@/lib/share";

// The client's read-only link, /share/<business-name>/<token>. A new client gets one when it is
// created (app/api/clients/route.ts); this replaces it or turns it off.

// Makes the link, or replaces it: the old address stops working at once.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/clients/[id]/share">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const token = newShareToken();
  const { clients } = await collections();
  const result = await clients.updateOne(
    { _id: new ObjectId(id) },
    { $set: { shareToken: token, updatedAt: new Date() } },
  );
  if (!result.matchedCount) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ token });
}

// Turns the link off.
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/clients/[id]/share">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const { clients } = await collections();
  await clients.updateOne(
    { _id: new ObjectId(id) },
    { $unset: { shareToken: "" }, $set: { updatedAt: new Date() } },
  );
  return Response.json({ ok: true });
}
