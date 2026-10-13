import type { WithId } from "mongodb";
import { hasFounderPhoto, renderWelcomeEmail, sendEmail, type RenderedEmail } from "./email";
import { collections } from "./mongodb";
import {
  googleOn,
  NOTHING_TO_REPORT,
  reportable,
  SCHEDULES,
  type ClientDoc,
  type EmailResult,
} from "./schemas";
import { shareUrl } from "./share";

// The welcome email for a client as it stands now. Throws when the client's link is turned off:
// the link is what the email is for. Throws too when there is nothing to report on yet: the email
// promises a growth report.
export async function welcomeEmail(
  client: Pick<ClientDoc, "name" | "shareToken" | "schedules" | "active" | "umamiWebsiteId" | "hasGoogleProfile">,
): Promise<RenderedEmail> {
  if (!reportable(client)) throw new Error(NOTHING_TO_REPORT);
  if (!client.shareToken) throw new Error("This client's link is turned off. Make one on the Report tab first.");
  return renderWelcomeEmail({
    clientName: client.name,
    shareUrl: shareUrl(client.name, client.shareToken),
    website: Boolean(client.umamiWebsiteId),
    google: googleOn(client),
    founderPhoto: await hasFounderPhoto(),
    // a paused client is promised no reports; "daily" from older clients is not a schedule any more
    schedules: client.active ? SCHEDULES.filter((schedule) => client.schedules?.includes(schedule)) : [],
  });
}

// Sends the welcome email and keeps how it went on the client. Never throws.
export async function sendWelcome(client: WithId<ClientDoc>, idempotencyKey?: string): Promise<EmailResult> {
  let result: EmailResult;
  try {
    result = await sendEmail({
      to: client.emails,
      email: await welcomeEmail(client),
      copyTeam: client.copyTeam,
      idempotencyKey,
    });
  } catch (error) {
    result = { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
  const { clients } = await collections();
  await clients.updateOne({ _id: client._id }, { $set: { welcomeEmail: { ...result, at: new Date() } } });
  return result;
}
