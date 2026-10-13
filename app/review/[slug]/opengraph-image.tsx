import { brandImage, OG_SIZE, reviewImage } from "@/lib/og";
import { findReviewClient } from "@/lib/review-clicks";

// The preview of a client's review link, with the business name on it. Drawn when a chat app asks
// for it and stored nowhere. A link that leads nowhere gets the app's own image and no name.
export const alt = "Rate us on Google";
export const size = OG_SIZE;
export const contentType = "image/png";

// Kept for an hour and no longer, so a renamed business shows its new name on the next share.
const HEADERS = { "Cache-Control": "public, max-age=3600" };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await findReviewClient(slug);
  return client ? reviewImage(client.name, HEADERS) : brandImage(HEADERS);
}
