import type { NextRequest } from "next/server";
import { OG_SIZE } from "@/lib/og";
import { findReviewClient } from "@/lib/review-clicks";
import { reviewAddress } from "@/lib/review-link";

// A client's review link, as the business's customers open it: /review/<business-name>, or just
// /<business-name> on the review domain when there is one (lib/review-link.ts). No sign-in
// (proxy.ts lets it through). Google's own review link shows no preview in a chat app, so
// this page stands in front of it: a chat app fetching the link reads the preview below (the image
// is opengraph-image.tsx beside this file), and a person's browser runs the one line of script and
// is sent on through go/route.ts, which counts them. A plain redirect here would not do: the chat
// app would follow it and show Google's empty preview again.
//
// Written out by hand instead of as a page so every fetcher gets the same few tags in the <head>,
// whatever it calls itself, and a customer on a slow phone downloads next to nothing before Google.

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const STYLE = `
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff; color: #121212;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif; }
  main { max-width: 26rem; padding: 2rem 1.5rem; text-align: center; }
  h1 { margin: 0; font-size: 1.5rem; line-height: 1.25; }
  p { margin: 0.5rem 0 0; color: #6e6e73; line-height: 1.5; }
  a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; border-radius: 999px;
    background: #121212; color: #fff; font-weight: 600; text-decoration: none; }
`;

function page(head: string, body: string, status: number) {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
${head}
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest, ctx: RouteContext<"/review/[slug]">) {
  const { slug } = await ctx.params;
  const client = await findReviewClient(slug);

  // Nothing about any business on a link that leads nowhere.
  if (!client) {
    return page(
      "<title>This review link is not active</title>",
      "<h1>This review link is not active</h1>\n<p>Ask the business for its current link.</p>",
      404,
    );
  }

  // The address the link was opened on, so the preview image comes from the same place.
  // `slug` is only ever letters, digits and dashes (findReviewClient), so it is safe in the script
  const { path, url } = reviewAddress(request, slug);
  const name = escape(client.name);
  const title = `Rate ${name} on Google`;
  const description = "Tap to leave us a review on Google.";
  const go = `${path}/go`;

  return page(
    `<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${url}/opengraph-image">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${OG_SIZE.width}">
<meta property="og:image:height" content="${OG_SIZE.height}">
<meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${url}/opengraph-image">
<script>location.replace("${go}")</script>`,
    // seen for a moment on the way, and the way through for a browser with scripts turned off
    `<h1>${name}</h1>
<p>Taking you to Google to leave a review.</p>
<a href="${go}" rel="nofollow">Continue to Google</a>`,
    200,
  );
}
