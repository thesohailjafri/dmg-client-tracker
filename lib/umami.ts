import { env } from "./env";
import type { MetricRow, MetricTotals } from "./schemas";

// Umami REST client. Works with self-hosted (Bearer token) and Umami Cloud (x-umami-api-key).
// Auth: UMAMI_API_KEY if set, otherwise log in with UMAMI_USERNAME / UMAMI_PASSWORD.

function baseUrl(): string {
  const url = env("UMAMI_API_URL").replace(/\/+$/, "");
  return /\/(api|v\d+)$/.test(url) ? url : `${url}/api`;
}

// A website's dashboard in the Umami app itself, or null when Umami is not configured.
export function umamiWebsiteUrl(websiteId: string): string | null {
  const api = process.env.UMAMI_API_URL;
  if (!api) return null;
  // Self-hosted serves the API under the app (<app>/api); Umami Cloud keeps it on its own host.
  const app = /^https?:\/\/api\.umami\.is(\/|$)/.test(api)
    ? "https://cloud.umami.is"
    : api.replace(/\/+$/, "").replace(/\/(api|v\d+)$/, "");
  return `${app}/websites/${encodeURIComponent(websiteId)}`;
}

let loginToken: string | undefined;

async function authHeaders(): Promise<Record<string, string>> {
  const key = process.env.UMAMI_API_KEY;
  if (key) return { Authorization: `Bearer ${key}`, "x-umami-api-key": key };

  if (!loginToken) {
    const res = await fetch(`${baseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: env("UMAMI_USERNAME"),
        password: env("UMAMI_PASSWORD"),
      }),
    });
    if (!res.ok) throw new Error(`Umami login failed: ${res.status}`);
    loginToken = ((await res.json()) as { token: string }).token;
  }
  return { Authorization: `Bearer ${loginToken}` };
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${baseUrl()}${path}?${query}`, {
    headers: { Accept: "application/json", ...(await authHeaders()) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Umami ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Umami v2 returns { pageviews: { value, prev } }, v3 returns { pageviews, comparison: { pageviews } }.
type RawStat = number | { value?: number; prev?: number } | undefined;
type RawStats = Record<string, RawStat> & { comparison?: Record<string, number> };

function totals(raw: RawStats, which: "current" | "previous"): MetricTotals {
  const read = (key: string): number => {
    const stat = raw[key];
    if (which === "current") return typeof stat === "number" ? stat : (stat?.value ?? 0);
    return raw.comparison?.[key] ?? (typeof stat === "object" ? (stat.prev ?? 0) : 0);
  };
  return {
    pageviews: read("pageviews"),
    visitors: read("visitors"),
    visits: read("visits"),
    bounces: read("bounces"),
    totalTime: read("totaltime"),
  };
}

async function topRows(
  websiteId: string,
  range: { startAt: number; endAt: number },
  types: string[],
): Promise<MetricRow[]> {
  // The page metric is "path" on Umami v3 and "url" on v2 — try each in order.
  for (const type of types) {
    try {
      const rows = await get<{ x: string | null; y: number }[]>(
        `/websites/${websiteId}/metrics`,
        { ...range, type, limit: 5 },
      );
      return rows.slice(0, 5).map((row) => ({ name: row.x || "(direct)", count: row.y }));
    } catch {
      // try the next type name
    }
  }
  return [];
}

export async function fetchUmamiMetrics(websiteId: string, periodDays: number) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 86_400_000);
  const range = { startAt: periodStart.getTime(), endAt: periodEnd.getTime() };

  const [stats, topPages, topReferrers] = await Promise.all([
    get<RawStats>(`/websites/${websiteId}/stats`, range),
    topRows(websiteId, range, ["path", "url"]),
    topRows(websiteId, range, ["referrer"]),
  ]);

  return {
    websiteId,
    periodStart,
    periodEnd,
    current: totals(stats, "current"),
    previous: totals(stats, "previous"),
    topPages,
    topReferrers,
  };
}
