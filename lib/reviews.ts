import { ObjectId } from "mongodb";
import { collections } from "./mongodb";
import { fetchPlace, placesEnabled } from "./places";
import { googleOn } from "./schemas";

// The weekly Google reading behind the review graphs. Reviews move slowly, so once a week is
// enough to draw growth, and it is one Place Details call per client (see lib/places.ts for the
// free allowance). Clients on a weekly or monthly report get readings from their report runs too.

export type ReviewPull = {
  pulled: number;
  // active clients with a Google profile whose business has not been matched on Google yet
  unmatched: number;
  failed: { clientId: string; error: string }[];
};

// One reading for every active client that has a Google profile and a Google place ID. A client
// with its Google profile switched off is left out, place ID or not. A client that fails is
// recorded and the rest still run.
export async function pullReviews(): Promise<ReviewPull> {
  if (!placesEnabled()) throw new Error("GOOGLE_PLACES_API_KEY is not set");

  const { clients, reviews } = await collections();
  const active = await clients
    .find({ active: true }, { projection: { _id: 1, googlePlaceId: 1, hasGoogleProfile: 1 } })
    .toArray();
  const onGoogle = active.filter(googleOn);
  const matched = onGoogle.filter((client) => client.googlePlaceId);

  const result: ReviewPull = { pulled: 0, unmatched: onGoogle.length - matched.length, failed: [] };
  // One at a time: a handful of clients, and no reason to race Google's rate limit.
  for (const client of matched) {
    try {
      const place = await fetchPlace(client.googlePlaceId);
      await reviews.insertOne({
        _id: new ObjectId(),
        clientId: client._id,
        placeId: place.placeId,
        rating: place.rating,
        reviewCount: place.reviewCount,
        fetchedAt: new Date(),
      });
      result.pulled += 1;
    } catch (error) {
      result.failed.push({
        clientId: client._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}
