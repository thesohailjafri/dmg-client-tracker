import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { collections } from "./mongodb";
import { reviewAddress } from "./review-link";
import type { ClickSource } from "./schemas";

// What happens behind a client's review link (see lib/review-link.ts): finding the business,
// sending the visitor on to Google, and counting them on the way.

export type ReviewTarget = { id: string; name: string; googleReviewUrl: string };

// The business behind a review link, or null when nothing answers to that name or the client has
// no Google review link saved. This runs without a session, so it reads the two fields the link
// needs and no more.
export async function findReviewClient(slug: string): Promise<ReviewTarget | null> {
  if (!/^[a-z0-9-]{1,70}$/.test(slug)) return null;
  const { clients } = await collections();
  const doc = await clients.findOne({ reviewSlug: slug }, { projection: { name: 1, googleReviewUrl: 1 } });
  return doc?.googleReviewUrl
    ? { id: doc._id.toString(), name: doc.name, googleReviewUrl: doc.googleReviewUrl }
    : null;
}

// Preview fetchers and crawlers that say who they are. They should not get as far as being sent
// on, since the link's page only forwards a browser that runs its script: this is the second check.
const BOT = /bot\b|crawler|spider|facebookexternalhit|^WhatsApp\/|headless/i;

function isPerson(request: Request): boolean {
  // a browser loading the page ahead of time, before anyone has opened it
  if (request.headers.get("sec-purpose")?.includes("prefetch")) return false;
  return !BOT.test(request.headers.get("user-agent") ?? "");
}

// Sends whoever opened the link or scanned the QR code on to the Google review page, and counts
// them. The Google link is read on every visit, so changing it on the client moves links and
// printed QR codes that are already out.
export async function sendToGoogle(request: NextRequest, slug: string, source: ClickSource): Promise<Response> {
  const client = await findReviewClient(slug);
  // the link's own page says it is not active
  if (!client) return Response.redirect(reviewAddress(request, slug).url, 302);

  if (isPerson(request)) {
    try {
      const { reviewClicks } = await collections();
      await reviewClicks.updateOne(
        { clientId: new ObjectId(client.id), day: new Date().toISOString().slice(0, 10), source },
        { $inc: { count: 1 } },
        { upsert: true },
      );
    } catch (error) {
      // a customer on their way to leave a review is never stopped by a count that failed
      console.error("Could not count a review link click", error);
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: client.googleReviewUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

// How far back "recent" goes on the client's Overview.
export const RECENT_DAYS = 30;

// How many people a client's review link has sent to Google, by how they reached it.
export type ReviewClickTotals = Record<ClickSource, { total: number; recent: number }>;

export async function reviewClickTotals(clientId: string): Promise<ReviewClickTotals> {
  const { reviewClicks } = await collections();
  const docs = await reviewClicks.find({ clientId: new ObjectId(clientId) }).toArray();
  // today and the days before it, RECENT_DAYS in all
  const since = new Date(Date.now() - (RECENT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);

  const totals: ReviewClickTotals = { link: { total: 0, recent: 0 }, qr: { total: 0, recent: 0 } };
  for (const doc of docs) {
    totals[doc.source].total += doc.count;
    if (doc.day >= since) totals[doc.source].recent += doc.count;
  }
  return totals;
}
