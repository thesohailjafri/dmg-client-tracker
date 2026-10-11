import { getSharedClient } from "@/lib/data";
import { AGENCY_NAME } from "@/lib/env";
import { brandImage, OG_SIZE, reportImage } from "@/lib/og";

// The preview of a client's shared graphs link, with the business name on it. Drawn when a chat
// app asks for it and stored nowhere. Like the page, it only knows the client through the token:
// a link that was reset, turned off or made up gets the app's own image and no name.
export const alt = "Growth report";
export const size = OG_SIZE;
export const contentType = "image/png";

// Kept for an hour and no longer, so a renamed business shows its new name on the next share.
const HEADERS = { "Cache-Control": "public, max-age=3600" };

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getSharedClient(token);
  return client ? reportImage(client.name, AGENCY_NAME, HEADERS) : brandImage(HEADERS);
}
