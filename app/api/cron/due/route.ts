import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { collections } from "@/lib/mongodb";
import { SCHEDULES, type Schedule } from "@/lib/schemas";

// Called by the Cloudflare Worker on each cron tick: which clients belong to this schedule?
export async function GET(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const schedule = request.nextUrl.searchParams.get("schedule") as Schedule | null;
  if (!schedule || !SCHEDULES.includes(schedule)) {
    return Response.json({ error: "schedule must be daily, weekly or monthly" }, { status: 400 });
  }

  // Matches every client whose schedules array contains this one.
  const { clients } = await collections();
  const due = await clients
    .find({ active: true, schedules: schedule }, { projection: { _id: 1 } })
    .toArray();
  return Response.json({ schedule, clientIds: due.map((client) => client._id.toString()) });
}
