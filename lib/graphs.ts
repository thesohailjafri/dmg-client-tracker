// The shapes and arithmetic behind the Graphs tab and the client's read-only link. Nothing here
// reads data (see lib/graph-data.ts), so the chart component can import it in the browser.

import type { GraphSectionKey } from "./schemas";

export type GraphUnit = "week" | "month";

// The sections as they are titled on the graphs and listed on the client form.
export const GRAPH_SECTION_LABELS: Record<GraphSectionKey, string> = {
  traffic: "Website traffic",
  leads: "Website leads",
  reviews: "Google reviews",
};

// The only control: how far back. Each range fixes its own grouping, so there is never a view with
// too many points to read or too few to compare. `periods` counts finished weeks or months; the one
// in progress is shown after them. null = back to the first data there is.
export const RANGES = [
  { key: "30d", label: "Last 30 days", unit: "week", periods: 4 },
  { key: "60d", label: "Last 60 days", unit: "week", periods: 8 },
  { key: "90d", label: "Last 90 days", unit: "week", periods: 13 },
  { key: "6m", label: "Last 6 months", unit: "month", periods: 6 },
  { key: "12m", label: "Last 12 months", unit: "month", periods: 12 },
  { key: "all", label: "All time", unit: "month", periods: null },
] as const satisfies readonly { key: string; label: string; unit: GraphUnit; periods: number | null }[];

export type RangeKey = (typeof RANGES)[number]["key"];
export const DEFAULT_RANGE: RangeKey = "90d";

// "All time" stops here, so a site with years of history still draws a readable chart.
export const MAX_MONTHS = 36;

// From a ?range= value, which may be anything.
export function parseRange(value: unknown): RangeKey {
  return RANGES.find((range) => range.key === value)?.key ?? DEFAULT_RANGE;
}

// A client's read-only graphs link: /share/<business-name>/<token>. The name is there so the link
// can be recognised and searched for; only the random token finds the client, so the name gives
// nothing away to guess from, and a link sent before a rename redirects to the current name.
export function sharePath(name: string, token: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  // a name with no Latin letters or digits still needs something in that place
  return `/share/${slug || "client"}/${token}`;
}

export type GraphBucket = {
  label: string; // on the axis: "Sep 7", "Sep"
  long: string; // in the tooltip and table: "Sep 7 – Sep 13, 2026", "September 2026"
  partial: boolean; // the week or month still in progress
};

export type GraphSeries = {
  key: string;
  label: string;
  // "total" is counted over each period and drawn as a bar. "level" is a reading taken at a point
  // in time (a review count), drawn as a line, and a period without a reading is null.
  kind: "total" | "level";
  values: (number | null)[];
  digits: number;
  // Traffic changes are percentages; small counts and readings are plain differences.
  change: "percent" | "difference";
  // The highest value the scale may show, e.g. 5 for a star rating.
  ceiling?: number;
};

export type GraphSection = {
  key: GraphSectionKey;
  title: string;
  note: string;
  series: GraphSeries[];
  // Why there is nothing to draw. Written for the team: the client's page leaves the section out.
  empty: string;
};

export type GraphsData = {
  range: RangeKey;
  unit: GraphUnit;
  buckets: GraphBucket[];
  sections: GraphSection[];
};

const DAY = 86_400_000;

// Weeks run Monday to Sunday and months by the calendar, both in UTC like every date in the app.
function periodStart(unit: GraphUnit, at: number, offset: number): number {
  const date = new Date(at);
  if (unit === "month") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return midnight + (offset * 7 - sinceMonday) * DAY;
}

export type Period = { start: number; end: number; partial: boolean };

// `finished` whole periods, oldest first, then the one in progress.
export function periods(unit: GraphUnit, finished: number, now: number): Period[] {
  return Array.from({ length: finished + 1 }, (_, index) => {
    const offset = index - finished;
    return {
      start: periodStart(unit, now, offset),
      end: periodStart(unit, now, offset + 1),
      partial: offset === 0,
    };
  });
}

// How many finished months lie between the first data and now, for "All time".
export function monthsSince(first: number, now: number): number {
  const from = new Date(first);
  const to = new Date(now);
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
  // at least one finished month, so there is always something to compare the current one with
  return Math.min(Math.max(months, 1), MAX_MONTHS);
}

const day = (at: number, year = false) =>
  new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: year ? "numeric" : undefined,
    timeZone: "UTC",
  });

export function bucketLabels(unit: GraphUnit, list: Period[]): GraphBucket[] {
  return list.map(({ start, end, partial }, index) => {
    const date = new Date(start);
    if (unit === "week") {
      return { label: day(start), long: `${day(start)} – ${day(end - DAY, true)}`, partial };
    }
    const month = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    // the year only where it changes, and on the first label
    const year = index === 0 || date.getUTCMonth() === 0 ? ` ’${String(date.getUTCFullYear()).slice(2)}` : "";
    return {
      label: `${month}${year}`,
      long: date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      partial,
    };
  });
}

export function formatValue(value: number, digits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// The period a value is compared with: the one before for a total, the last reading for a level.
function previousIndex(series: GraphSeries, index: number): number {
  if (series.kind === "total") return index - 1;
  for (let before = index - 1; before >= 0; before--) {
    if (series.values[before] !== null) return before;
  }
  return -1;
}

export type Change = { text: string; from: number };

// How a period moved against the one it is compared with, or null when there is nothing to compare:
// no earlier value, or a percentage of zero.
export function changeAt(series: GraphSeries, index: number): Change | null {
  const from = previousIndex(series, index);
  const now = series.values[index];
  const before = from >= 0 ? series.values[from] : null;
  if (now === null || now === undefined || before === null || before === undefined) return null;

  if (series.change === "percent") {
    if (before === 0) return null;
    const percent = Math.round(((now - before) / before) * 100);
    return { text: percent === 0 ? "No change" : `${percent > 0 ? "+" : ""}${percent}%`, from };
  }
  const difference = now - before;
  const shown = formatValue(Math.abs(difference), series.digits);
  // a difference too small to show at this precision is no change
  if (Number(shown.replace(/,/g, "")) === 0) return { text: "No change", from };
  return { text: `${difference > 0 ? "+" : "−"}${shown}`, from };
}

// The period a chart leads with: the last finished one for a total (the one in progress would read
// as a drop), the latest reading for a level. -1 when there is none.
export function headlineIndex(series: GraphSeries, buckets: GraphBucket[]): number {
  for (let index = series.values.length - 1; index >= 0; index--) {
    if (series.values[index] === null) continue;
    if (series.kind === "total" && buckets[index]?.partial) continue;
    return index;
  }
  return -1;
}

export type Scale = { low: number; high: number; ticks: number[] };

const STEPS = [1, 2, 5, 10];

// The smallest round step that is at least `raw`, and no finer than the values are shown at.
function roundStep(raw: number, digits: number): number {
  const finest = 10 ** -digits;
  if (raw <= finest) return finest;
  const power = 10 ** Math.floor(Math.log10(raw));
  return STEPS.map((step) => step * power).find((step) => step >= raw * (1 - 1e-9)) ?? power * 10;
}

// The vertical scale: round numbers, a handful of gridlines. Totals start at zero because a bar's
// height is its value; a level is drawn around its own range, or a slow climb would look flat.
export function scaleFor(series: GraphSeries): Scale {
  const values = series.values.filter((value) => value !== null);
  const top = Math.max(0, ...values);
  let low = 0;
  let high: number;
  let step: number;

  if (series.kind === "total" || values.length === 0) {
    step = roundStep(top / 4, series.digits);
    high = Math.max(step, Math.ceil(top / step - 1e-9) * step);
  } else {
    const bottom = Math.min(...values);
    step = roundStep((top - bottom) / 3, series.digits);
    low = Math.floor(bottom / step + 1e-9) * step;
    high = Math.ceil(top / step - 1e-9) * step;
    // At least three steps of headroom, so one step of change (a rating going 4.7 to 4.8) is not
    // stretched over the whole height of the chart.
    const ceiling = series.ceiling ?? Infinity;
    high = Math.min(high, ceiling);
    for (let turn = 0; turn < 6 && Math.round((high - low) / step) < 3; turn++) {
      if (turn % 2 === 0 && low - step >= 0) low -= step;
      else if (high + step <= ceiling + 1e-9) high += step;
    }
  }

  const count = Math.round((high - low) / step);
  const ticks = Array.from({ length: count + 1 }, (_, index) => Number((low + index * step).toFixed(6)));
  return { low, high, ticks };
}
