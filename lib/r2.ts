import { AwsClient } from "aws4fetch";
import { env } from "./env";

// R2 over the S3-compatible API. The Worker writes screenshots via its bucket binding; the Next.js
// app reads them back (dashboard preview, OpenAI input, email attachment) and keeps clients' logos.
//
// The bucket is shared with other apps, so everything of ours sits under one prefix, in a folder
// per kind of file:
//   <prefix>/clients/<clientId>/<timestamp>.jpg       Google profile screenshots (the Worker)
//   <prefix>/client-info/<clientId>/logo-<time>.<ext> what a client is, not what was captured: its logo

// Must match R2_PREFIX in workflows/wrangler.toml.
const PREFIX = (process.env.R2_PREFIX || "dmg-client-reports").replace(/^\/+|\/+$/g, "");

function client() {
  return new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

function objectUrl(key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${env("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com/${env("R2_BUCKET_NAME")}/${path}`;
}

// Where a client's logo is kept. A new name for every upload, so a replaced logo is never served
// from a cache under the old one.
export function logoKey(clientId: string, extension: string): string {
  return `${PREFIX}/client-info/${clientId}/logo-${Date.now()}.${extension}`;
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await client().fetch(objectUrl(key));
  if (!res.ok) throw new Error(`R2 get ${key} failed: ${res.status}`);
  return {
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/jpeg",
  };
}

// Needs an R2 token that can write. A read-only one answers 403.
export async function putObject(key: string, body: Uint8Array<ArrayBuffer>, contentType: string): Promise<void> {
  // Signed here, sent as a plain URL and options. Handing fetch the signed Request itself does
  // not work inside Next.js: its fetch rebuilds a Request from the body stream, the length is
  // lost, the upload goes out chunked and R2 answers 411 Length Required.
  const signed = await client().sign(objectUrl(key), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
  if (!res.ok) throw new Error(`R2 put ${key} failed: ${res.status}`);
}

export async function deleteObject(key: string): Promise<void> {
  const res = await client().fetch(objectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${key} failed: ${res.status}`);
}
