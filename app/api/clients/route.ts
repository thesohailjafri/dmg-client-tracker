import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { collections } from "@/lib/mongodb";
import { claimReviewSlug } from "@/lib/review-link";
import { clientInput, reportable } from "@/lib/schemas";
import { newShareToken } from "@/lib/share";
import { sendWelcome } from "@/lib/welcome";

export async function GET(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;
  return Response.json({ clients: await listClients() });
}

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const parsed = clientInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Every client starts with its read-only link, and is told about it straight away.
  const now = new Date();
  const { clients } = await collections();
  const _id = new ObjectId();
  const client = { _id, ...parsed.data, shareToken: newShareToken(), createdAt: now, updatedAt: now };
  await clients.insertOne(client);
  // and with the name in its review link, which it keeps from here on
  await claimReviewSlug(clients, _id, client.name);

  // A client with nothing to report on yet is not welcomed: the email promises a growth report.
  // It is sent by hand from the client's Overview once there is a Google profile or a website.
  if (!reportable(client)) return Response.json({ id: _id.toString(), welcomeEmail: "skipped" }, { status: 201 });

  // The client is saved whatever happens to the email: how it went is kept on the client, and it
  // can be sent again from the client's Overview.
  const welcome = await sendWelcome(client, `welcome-${_id.toString()}`);
  return Response.json({ id: _id.toString(), welcomeEmail: welcome.status }, { status: 201 });
}
