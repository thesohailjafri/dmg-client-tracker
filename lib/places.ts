import { env } from "./env";
import type { PlaceFacts } from "./schemas";

// Google Places API (New): Google's own rating and review count for a business. The screenshot is
// taken signed out and Google often hides the review count there, so this is the reliable source.
// Optional: without GOOGLE_PLACES_API_KEY the report uses what the AI reads off the screenshot.

const BASE = "https://places.googleapis.com/v1";

export const placesEnabled = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

// Google bills by the fields asked for, so every call names exactly the ones it needs.
async function call<T>(path: string, fields: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env("GOOGLE_PLACES_API_KEY"),
      "X-Goog-FieldMask": fields,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google Places failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// Text Search for the best match, asking for the id only. null when nothing matches.
export async function findPlaceId(query: string): Promise<string | null> {
  const data = await call<{ places?: { id: string }[] }>("/places:searchText", "places.id", {
    textQuery: query,
    pageSize: 1,
  });
  return data.places?.[0]?.id ?? null;
}

// One Place Details call. rating and userRatingCount put it on the Enterprise tier (1,000 free calls
// a month); the name and address cost nothing extra and show which business was matched.
export async function fetchPlace(placeId: string): Promise<PlaceFacts> {
  const data = await call<{
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
  }>(
    `/places/${encodeURIComponent(placeId)}?languageCode=en`,
    "displayName,formattedAddress,rating,userRatingCount",
  );
  return {
    placeId,
    name: data.displayName?.text ?? "",
    address: data.formattedAddress ?? "",
    rating: data.rating ?? null,
    reviewCount: data.userRatingCount ?? null,
  };
}
