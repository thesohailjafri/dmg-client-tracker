import { launch, type BrowserWorker } from "@cloudflare/playwright";

// Two jobs, both things only Cloudflare can do for us:
//   1. POST /screenshot — open a URL in Browser Run, stamp the agency watermark, store the JPEG in R2.
//   2. Cron Triggers   — on each tick, ask the Next.js app which clients are due and run their reports.
// The report pipeline itself (Umami, OpenAI, MongoDB, email) lives in the Next.js app.

interface Env {
  BROWSER: BrowserWorker;
  SCREENSHOTS: R2Bucket;
  APP_URL: string;
  R2_PREFIX: string;
  WORKER_SECRET: string;
}

const BRAND_BLUE = "#0066FF";
const VIEWPORT = { width: 1440, height: 1600 };
const CONCURRENCY = 2; // parallel reports per cron tick; keep at or below your Browser Run concurrency limit

type ScreenshotRequest = {
  url: string;
  clientId: string;
  clientName: string;
  agencyName: string;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function capture(env: Env, input: ScreenshotRequest) {
  const target = new URL(input.url);
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error("Only http(s) URLs can be captured");
  }
  // English UI keeps screenshots consistent regardless of where the browser runs.
  if (target.hostname.includes("google.")) target.searchParams.set("hl", "en");

  const capturedAt = new Date();
  const browser = await launch(env.BROWSER);
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, locale: "en-US" });
    await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Share links (maps.app.goo.gl/...) redirect to a URL without hl=en, and Google then picks the
    // language from wherever the browser happens to run. Reload the final URL in English.
    const landed = new URL(page.url());
    if (landed.hostname.includes("google.") && landed.searchParams.get("hl") !== "en") {
      landed.searchParams.set("hl", "en");
      await page.goto(landed.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    }

    // Google shows a consent interstitial from EU locations. Decline and continue.
    if (page.url().includes("consent.google.")) {
      await page
        .getByRole("button", { name: /reject all/i })
        .first()
        .click({ timeout: 5_000 })
        .catch(() => {});
    }

    // Maps keeps polling, so "networkidle" may never come — wait for it briefly, then move on.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);

    // Watermark: a fixed bar drawn in the page itself, so no image processing is needed.
    // Built with createElement/textContent because Google pages enforce Trusted Types (no innerHTML).
    await page.evaluate(
      ({ agency, client, stamp, blue }) => {
        const bar = document.createElement("div");
        bar.style.cssText = `position:fixed;left:0;right:0;bottom:0;z-index:2147483647;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:${blue};color:#fff;font:600 18px -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;`;
        const left = document.createElement("span");
        left.textContent = agency;
        const right = document.createElement("span");
        right.style.fontWeight = "400";
        right.textContent = `${client} · ${stamp}`;
        bar.appendChild(left);
        bar.appendChild(right);
        document.body.appendChild(bar);
      },
      {
        agency: input.agencyName,
        client: input.clientName,
        stamp: `${capturedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
        blue: BRAND_BLUE,
      },
    );

    const image = await page.screenshot({ fullPage: true, type: "jpeg", quality: 80 });

    // The bucket is shared with other apps, so everything goes under one prefix.
    const prefix = env.R2_PREFIX.replace(/^\/+|\/+$/g, "");
    const key = `${prefix}/clients/${input.clientId}/${capturedAt.toISOString().replace(/[:.]/g, "-")}.jpg`;
    await env.SCREENSHOTS.put(key, image, {
      httpMetadata: { contentType: "image/jpeg" },
      customMetadata: {
        clientId: input.clientId,
        url: input.url,
        capturedAt: capturedAt.toISOString(),
      },
    });
    return { key, bytes: image.byteLength, capturedAt: capturedAt.toISOString() };
  } finally {
    await browser.close();
  }
}

// "50 13 1 * *" -> monthly, "40 13 * * MON" -> weekly, anything else -> daily.
// Derived from the cron expression so times can change in wrangler.toml without touching code.
function scheduleFor(cron: string): "daily" | "weekly" | "monthly" {
  const [, , dayOfMonth, , dayOfWeek] = cron.trim().split(/\s+/);
  if (dayOfMonth !== "*") return "monthly";
  if (dayOfWeek !== "*") return "weekly";
  return "daily";
}

async function runBatch(env: Env, schedule: string) {
  const app = env.APP_URL.replace(/\/+$/, "");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.WORKER_SECRET}`,
  };

  const due = await fetch(`${app}/api/cron/due?schedule=${schedule}`, { headers });
  if (!due.ok) throw new Error(`Could not list due clients: ${due.status} ${await due.text()}`);
  const { clientIds } = (await due.json()) as { clientIds: string[] };
  console.log(`[${schedule}] ${clientIds.length} client(s) due`);

  const queue = [...clientIds];
  const worker = async () => {
    for (let clientId = queue.shift(); clientId; clientId = queue.shift()) {
      try {
        const res = await fetch(`${app}/api/reports/run`, {
          method: "POST",
          headers,
          body: JSON.stringify({ clientId, period: schedule, sendEmail: true, trigger: "cron" }),
        });
        console.log(`[${schedule}] ${clientId} -> ${res.status} ${await res.text()}`);
      } catch (error) {
        console.error(`[${schedule}] ${clientId} failed`, error);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

export default {
  async fetch(request, env): Promise<Response> {
    // Fail closed: until the WORKER_SECRET secret is set, nothing is accepted.
    if (!env.WORKER_SECRET || request.headers.get("Authorization") !== `Bearer ${env.WORKER_SECRET}`) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || pathname !== "/screenshot") {
      return json({ error: "Not found" }, 404);
    }

    const input = (await request.json().catch(() => null)) as ScreenshotRequest | null;
    if (!input?.url || !input.clientId) {
      return json({ error: "url and clientId are required" }, 400);
    }
    try {
      return json(
        await capture(env, {
          url: input.url,
          clientId: input.clientId,
          clientName: input.clientName || "",
          agencyName: input.agencyName || "",
        }),
      );
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 502);
    }
  },

  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(runBatch(env, scheduleFor(controller.cron)));
  },
} satisfies ExportedHandler<Env>;
