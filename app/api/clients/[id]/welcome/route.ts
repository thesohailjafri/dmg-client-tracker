import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { collections } from "@/lib/mongodb";
import { NOTHING_TO_REPORT, reportable } from "@/lib/schemas";
import { sendWelcome } from "@/lib/welcome";

// Sends the client's welcome email again: for a client from before there was one, one whose first
// went wrong, or one added while emails were going to the test inbox.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/clients/[id]/welcome">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const { clients } = await collections();
  const client = await clients.findOne({ _id: new ObjectId(id) });
  if (!client) return Response.json({ error: "Not found" }, { status: 404 });
  // refused, not tried: nothing is recorded on the client as a failed send
  if (!reportable(client)) return Response.json({ error: NOTHING_TO_REPORT }, { status: 400 });

  const result = await sendWelcome(client);
  if (result.status !== "sent") {
    return Response.json({ error: result.status === "failed" ? result.error : "Not sent." }, { status: 502 });
  }
  return Response.json({ to: result.to });
}
