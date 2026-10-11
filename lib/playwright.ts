import { AGENCY_NAME, env } from "./env";

// Browser automation runs in the Cloudflare Worker (workflows/), because Browser Run is only
// reachable through a Worker binding. This helper asks the Worker to capture a URL; the Worker
// watermarks the page, stores the JPEG in R2 and returns the object key.

export type Capture = { key: string; bytes: number; capturedAt: string };

export async function captureScreenshot(input: {
  url: string;
  clientId: string;
  clientName: string;
}): Promise<Capture> {
  const res = await fetch(`${env("WORKER_URL").replace(/\/+$/, "")}/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env("WORKER_SECRET")}`,
    },
    body: JSON.stringify({ ...input, agencyName: AGENCY_NAME }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Screenshot failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  return res.json() as Promise<Capture>;
}
