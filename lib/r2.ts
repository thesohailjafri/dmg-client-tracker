import { AwsClient } from "aws4fetch";
import { env } from "./env";

// R2 over the S3-compatible API. The Worker writes screenshots via its bucket binding;
// the Next.js app only needs to read them back (dashboard preview, OpenAI input, email attachment).

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

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await client().fetch(objectUrl(key));
  if (!res.ok) throw new Error(`R2 get ${key} failed: ${res.status}`);
  return {
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/jpeg",
  };
}
