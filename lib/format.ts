import type { GbpNote, MetricTotals } from "./schemas";

const number = new Intl.NumberFormat("en-US");

function change(current: number, previous: number): string {
  if (!previous) return "";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function duration(seconds: number): string {
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const bounceRate = (t: MetricTotals) => (t.visits ? (t.bounces / t.visits) * 100 : 0);
const avgVisit = (t: MetricTotals) => (t.visits ? t.totalTime / t.visits : 0);

export type KeyNumber = { label: string; value: string; change: string };

// The numbers shown in both the dashboard and the client email.
export function keyNumbers(current: MetricTotals, previous: MetricTotals): KeyNumber[] {
  return [
    { label: "Visitors", value: number.format(current.visitors), change: change(current.visitors, previous.visitors) },
    { label: "Page views", value: number.format(current.pageviews), change: change(current.pageviews, previous.pageviews) },
    { label: "Visits", value: number.format(current.visits), change: change(current.visits, previous.visits) },
    { label: "Bounce rate", value: `${Math.round(bounceRate(current))}%`, change: change(bounceRate(current), bounceRate(previous)) },
    { label: "Avg. visit", value: duration(avgVisit(current)), change: change(avgVisit(current), avgVisit(previous)) },
  ];
}

export function periodLabel(days: number): string {
  if (days === 1) return "Daily";
  if (days === 7) return "Weekly";
  if (days === 30) return "Monthly";
  return `${days}-day`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function formatDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// The AI copies text off a picture, so spacing and punctuation can drift between runs.
const loose = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
// In a web address the punctuation matters; only the wrapping around the domain is noise.
const site = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");

const signed = (value: number) => `${value > 0 ? "+" : ""}${number.format(value)}`;

// False for notes saved before `language` existed: their wording cannot be trusted either way.
export const isEnglish = (note: GbpNote) => note.language?.toLowerCase() === "english";

// What changed in a Google profile note. `earlier` is newest first. Each field is compared with the
// last earlier note where it was visible, so a day when Google hid the review count is not a change.
export function gbpChanges(note: GbpNote, earlier: GbpNote[]): string[] {
  const changes: string[] = [];
  const last = <K extends keyof GbpNote>(key: K) =>
    earlier.find((other) => other[key] !== null)?.[key] ?? null;

  const rating = last("rating");
  if (note.rating !== null && rating !== null && note.rating !== rating) {
    changes.push(`Rating ${rating} → ${note.rating}`);
  }
  const reviews = last("reviewCount");
  if (note.reviewCount !== null && reviews !== null && note.reviewCount !== reviews) {
    changes.push(
      `Reviews ${number.format(reviews)} → ${number.format(note.reviewCount)} (${signed(note.reviewCount - reviews)})`,
    );
  }
  // Google words the category and address in the page's language, and a translated category is the
  // AI's own wording. Those two are only compared between screenshots Google served in English.
  const english = earlier.filter(isEnglish);
  for (const [key, label, normalise, worded] of [
    ["category", "Category", loose, true],
    ["address", "Address", loose, true],
    ["phone", "Phone", loose, false],
    ["website", "Website", site, false],
  ] as const) {
    if (worded && !isEnglish(note)) continue;
    const now = note[key];
    const before = worded ? (english.find((other) => other[key] !== null)?.[key] ?? null) : last(key);
    if (now !== null && before !== null && normalise(now) !== normalise(before)) {
      changes.push(`${label}: ${before} → ${now}`);
    }
  }
  // Hours only mean something when both screenshots show the profile itself.
  const listing = earlier.find((other) => other.state === "listing");
  if (note.state === "listing" && listing && note.hoursShown !== listing.hoursShown) {
    changes.push(note.hoursShown ? "Opening hours now shown" : "Opening hours no longer shown");
  }
  return changes;
}
