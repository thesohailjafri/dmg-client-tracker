import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { runReport } from "@/lib/pipeline";
import { SCHEDULES, type Schedule } from "@/lib/schemas";

// Screenshot + OpenAI + email for one client takes 20-60s.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    clientId?: string;
    period?: Schedule;
    sendEmail?: boolean;
    trigger?: string;
  };
  if (!body.clientId || !ObjectId.isValid(body.clientId)) {
    return Response.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!body.period || !SCHEDULES.includes(body.period)) {
    return Response.json({ error: "period must be weekly or monthly" }, { status: 400 });
  }

  try {
    const log = await runReport(body.clientId, {
      trigger: body.trigger === "cron" ? "cron" : "manual",
      period: body.period,
      sendEmail: body.sendEmail === true,
    });
    return Response.json(
      { id: log._id.toString(), status: log.status, error: log.error, email: log.email.status },
      { status: log.status === "ok" ? 200 : 502 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Run failed" },
      { status: 500 },
    );
  }
}
