import type { Collection, ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { nameSlug } from "./graphs";
import type { ClickSource, ClientDoc } from "./schemas";

// A client's review link: /review/<business-name>. It shows a proper preview when it is shared in a
// chat app, which Google's own review link does not, sends whoever opens it on to that Google link,
// and counts them (see lib/review-clicks.ts). Unlike the graphs link it is meant to be passed
// around, so there is no secret in it.

// Review links can have a domain of their own (NEXT_PUBLIC_REVIEW_URL, like
// https://review.example.com), pointed at this same app. The links are then
// review.example.com/<business-name>, with no /review in front, and that domain answers for
// nothing else: see proxy.ts. Without it they sit on the app's own address.
const REVIEW_URL = (process.env.NEXT_PUBLIC_REVIEW_URL ?? "").replace(/\/+$/, "");
const REVIEW_HOST = URL.canParse(REVIEW_URL) ? new URL(REVIEW_URL).host : "";

// Whether a request came in on the review domain. The Host header says so wherever the app runs.
export function onReviewDomain(request: NextRequest): boolean {
  return REVIEW_HOST !== "" && request.headers.get("host") === REVIEW_HOST;
}

// A client's link in full, as it is copied, shared and put in a QR code, or "" while the client has
// no Google review link for it to send people to. A QR code gets its own address so scans are
// counted apart from opened links. Built on the live address when the app knows it: a printed QR
// code must not point at wherever the app happened to be open.
export function reviewUrl(
  client: { reviewSlug: string; googleReviewUrl: string },
  source: ClickSource = "link",
): string {
  if (!client.reviewSlug || !client.googleReviewUrl) return "";
  const app = process.env.NEXT_PUBLIC_APP_URL || (typeof window === "undefined" ? "" : window.location.origin);
  const link = REVIEW_HOST
    ? `${REVIEW_URL}/${client.reviewSlug}`
    : `${app.replace(/\/+$/, "")}/review/${client.reviewSlug}`;
  return source === "qr" ? `${link}/qr` : link;
}

// A link as the request for it came in: /<business-name> on the review domain,
// /review/<business-name> on the app's. `path` is for sending the browser on from there, `url` is
// the full address for the preview.
export function reviewAddress(request: NextRequest, slug: string): { path: string; url: string } {
  const short = onReviewDomain(request);
  const path = short ? `/${slug}` : `/review/${slug}`;
  return { path, url: `${short ? REVIEW_URL : request.nextUrl.origin}${path}` };
}

// Gives a client the name in its review link, once: a client that already has one keeps it. Two
// businesses with the same name get "ok-auto" and "ok-auto-2": the unique index on the field
// (lib/mongodb.ts) is what turns the second one away.
export async function claimReviewSlug(clients: Collection<ClientDoc>, id: ObjectId, name: string): Promise<void> {
  const base = nameSlug(name) || "business";
  for (let attempt = 1; ; attempt += 1) {
    try {
      await clients.updateOne(
        { _id: id, reviewSlug: { $exists: false } },
        { $set: { reviewSlug: attempt === 1 ? base : `${base}-${attempt}` } },
      );
      return;
    } catch (error) {
      // 11000 = taken by another client: try the next number
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
}
