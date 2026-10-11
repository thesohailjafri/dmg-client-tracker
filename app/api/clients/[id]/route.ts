import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { collections } from "@/lib/mongodb";
import { clientActivePatch, clientInput } from "@/lib/schemas";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/clients/[id]">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  // Either just the active flag (table toggle) or the whole client (edit form).
  const body = await request.json().catch(() => null);
  const toggle = clientActivePatch.safeParse(body);
  const parsed = toggle.success ? toggle : clientInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { clients } = await collections();
  const result = await clients.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed.data, updatedAt: new Date() } },
  );
  if (!result.matchedCount) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

// Removes the client only. Its screenshots, metrics and AI logs stay for the record.
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/clients/[id]">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const { clients } = await collections();
  await clients.deleteOne({ _id: new ObjectId(id) });
  return Response.json({ ok: true });
}
