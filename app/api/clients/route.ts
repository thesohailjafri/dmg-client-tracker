import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { collections } from "@/lib/mongodb";
import { clientInput } from "@/lib/schemas";

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

  const now = new Date();
  const { clients } = await collections();
  const _id = new ObjectId();
  await clients.insertOne({ _id, ...parsed.data, createdAt: now, updatedAt: now });
  return Response.json({ id: _id.toString() }, { status: 201 });
}
