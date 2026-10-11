import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { withInlineImages } from "@/lib/email";
import { collections } from "@/lib/mongodb";
import { reportEmail } from "@/lib/report-email";
import { welcomeEmail } from "@/lib/welcome";

// An email exactly as a client would get it, shown in the browser. Nothing is sent and nothing is
// run: the report is rebuilt from the client's latest finished run.
//   /api/emails/preview?clientId=<id>&kind=welcome
//   /api/emails/preview?clientId=<id>&kind=report
export async function GET(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId") ?? "";
  const kind = searchParams.get("kind");
  if (!ObjectId.isValid(clientId)) return new Response("Client not found.", { status: 404 });

  const { clients, aiLogs } = await collections();
  const client = await clients.findOne({ _id: new ObjectId(clientId) });
  if (!client) return new Response("Client not found.", { status: 404 });

  try {
    // the same email "Send welcome email" would send
    if (kind === "welcome") return html((await welcomeEmail(client)).html);

    const run = await aiLogs.findOne(
      { clientId: client._id, status: "ok", output: { $exists: true } },
      { sort: { createdAt: -1 } },
    );
    if (!run) return new Response("No finished report yet. Run one first, without sending.", { status: 404 });
    return html((await reportEmail(client, run)).html);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Could not build the email.", { status: 500 });
  }
}

// In an inbox the pictures are attachments the email points at; here they are written into the page.
async function html(body: string) {
  return new Response(await withInlineImages(body), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
