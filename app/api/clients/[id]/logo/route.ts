import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth";
import { collections } from "@/lib/mongodb";
import { deleteObject, getObject, logoKey, putObject } from "@/lib/r2";
import { LOGO_MAX_BYTES, LOGO_TYPES, type LogoType } from "@/lib/schemas";

// What the file really is, read off its first bytes: the type the browser sends is only a claim.
function sniff(bytes: Uint8Array): LogoType | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  // "RIFF", four bytes of length, "WEBP"
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

// The R2 bucket is private; the app loads a client's logo through this route.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/clients/[id]/logo">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return new Response("Not found", { status: 404 });

  const { clients } = await collections();
  const client = await clients.findOne({ _id: new ObjectId(id) }, { projection: { logo: 1 } });
  if (!client?.logo) return new Response("Not found", { status: 404 });

  const object = await getObject(client.logo.r2Key);
  return new Response(new Uint8Array(object.body), {
    headers: {
      "Content-Type": client.logo.contentType,
      // never run as a page, whatever the bytes turn out to be
      "X-Content-Type-Options": "nosniff",
      // the address carries the upload time (?v=), so what it names never changes
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

// Saves a new logo for the client, in place of the one it had. Body: form data with the file as `logo`.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/clients/[id]/logo">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a logo file to upload." }, { status: 400 });
  }
  if (file.size > LOGO_MAX_BYTES) {
    return Response.json({ error: "The logo is over 2 MB. Use a smaller file." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniff(bytes);
  if (!contentType) {
    return Response.json({ error: "The logo has to be a PNG, JPG or WebP image." }, { status: 400 });
  }

  const _id = new ObjectId(id);
  const { clients } = await collections();
  const before = await clients.findOne({ _id }, { projection: { logo: 1 } });
  if (!before) return Response.json({ error: "Not found" }, { status: 404 });

  const logo = {
    r2Key: logoKey(id, LOGO_TYPES[contentType]),
    contentType,
    bytes: bytes.byteLength,
    uploadedAt: new Date(),
  };
  try {
    await putObject(logo.r2Key, bytes, contentType);
  } catch (error) {
    console.error(error);
    // 403 = the keys are good but may not write; anything else is said as it came
    const status = /failed: (\d+)$/.exec(error instanceof Error ? error.message : "")?.[1];
    return Response.json(
      {
        error:
          status === "403"
            ? "Storage refused the upload (403 Access Denied). The R2 keys in the app's settings can read but not write."
            : `Could not save the logo to storage${status ? ` (R2 answered ${status})` : ""}.`,
      },
      { status: 502 },
    );
  }
  await clients.updateOne({ _id }, { $set: { logo, updatedAt: new Date() } });
  // the old file is no longer pointed at; leaving it behind costs storage, not correctness
  if (before.logo) await deleteObject(before.logo.r2Key).catch(console.error);
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/clients/[id]/logo">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const { clients } = await collections();
  const before = await clients.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $unset: { logo: "" }, $set: { updatedAt: new Date() } },
    { projection: { logo: 1 } },
  );
  if (!before) return Response.json({ error: "Not found" }, { status: 404 });
  if (before.logo) await deleteObject(before.logo.r2Key).catch(console.error);
  return Response.json({ ok: true });
}
