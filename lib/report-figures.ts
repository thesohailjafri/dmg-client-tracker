import { trafficNumbers, type KeyNumber } from "./format";
import { leadFigures, type LeadFigure } from "./leads";
import type { AiOutput, EventCounts, LeadType, MetricRow, MetricTotals } from "./schemas";

// What a client's report email says, worked out in code: the figures, the facts the AI is given,
// and the check that keeps anything vague or made up out of the AI's wording. Nothing here reads
// data (see lib/report-email.ts), so every rule can be run on its own.

const number = new Intl.NumberFormat("en-US");
const signed = (value: number, digits = 0) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

// A reading of Google's own figures: now, and what the period started from.
export type GoogleFigures = {
  rating: number | null;
  reviewCount: number | null;
  // null when no earlier reading is close enough to the start of the period to compare with
  before: { rating: number | null; reviewCount: number | null } | null;
};

export type Traffic = {
  current: MetricTotals;
  previous: MetricTotals;
  topPages: MetricRow[];
  topReferrers: MetricRow[];
};

export type ReportFigures = {
  google: KeyNumber[];
  traffic: KeyNumber[];
  leads: LeadFigure[];
  // false when there is no earlier period to set any of the figures against
  comparable: boolean;
  // true when every kind of figure in the email has an earlier period. Only then may the AI's
  // wording be used: with one of them new, "from 0 to 120" would read as growth.
  describable: boolean;
  // exactly what the AI is told, and the only numbers its wording may use
  facts: Record<string, unknown>;
};

// The reading a period started from: the one taken nearest its first moment, and within a seventh
// of the period of it (a day for a week, about four days for a month). Scheduled runs are a week
// apart to the minute and Google is read every Monday, so there is one that close whenever the
// history goes back far enough. Anything further off would count reviews from outside the period.
export function readingAtStart<T extends { at: number }>(readings: T[], start: number, periodMs: number): T | null {
  const off = (reading: T) => Math.abs(reading.at - start);
  const near = readings.filter((reading) => off(reading) <= periodMs / 7);
  return near.sort((a, b) => off(a) - off(b))[0] ?? null;
}

const percent = (current: number, previous: number) =>
  previous ? Math.round(((current - previous) / previous) * 100) : null;

// A rating to one decimal, as Google shows it. Compared at that precision everywhere, so the table
// and the AI are told the same thing: 4.74 -> 4.66 is 4.7 both times, not a move the owner can see.
const oneDecimal = (rating: number) => Math.round(rating * 10) / 10;
const ratingMove = (google: GoogleFigures): number | null => {
  const before = google.before?.rating ?? null;
  if (google.rating === null || before === null) return null;
  return (Math.round(google.rating * 10) - Math.round(before * 10)) / 10;
};
const reviewsGained = (google: GoogleFigures): number | null => {
  const before = google.before?.reviewCount ?? null;
  return google.reviewCount === null || before === null ? null : google.reviewCount - before;
};

function googleRows(google: GoogleFigures | null): KeyNumber[] {
  if (!google) return [];
  const rows: KeyNumber[] = [];
  if (google.reviewCount !== null) {
    const gained = reviewsGained(google);
    rows.push({
      label: "Google reviews",
      value: number.format(google.reviewCount),
      change: gained === null ? "" : gained > 0 ? `${signed(gained)} new` : gained < 0 ? signed(gained) : "no new reviews",
    });
  }
  if (google.rating !== null) {
    const moved = ratingMove(google);
    rows.push({
      label: "Google rating",
      value: google.rating.toFixed(1),
      change: moved ? signed(moved, 1) : "",
    });
  }
  return rows;
}

export function reportFigures(input: {
  clientName: string;
  periodDays: number;
  traffic: Traffic | null;
  leadTypes: LeadType[];
  events: EventCounts | undefined;
  google: GoogleFigures | null;
}): ReportFigures {
  const { traffic, google } = input;
  const leads = leadFigures(input.leadTypes, input.events);
  const compare = (key: "visitors" | "pageviews" | "visits") =>
    traffic && {
      current: traffic.current[key],
      previous: traffic.previous[key],
      changePercent: percent(traffic.current[key], traffic.previous[key]),
    };

  const gained = google && reviewsGained(google);
  const moved = google && ratingMove(google);
  const rating = (value: number | null) => (value === null ? null : oneDecimal(value));
  const facts = {
    client: input.clientName,
    periodDays: input.periodDays,
    website: traffic
      ? {
          visitors: compare("visitors"),
          pageViews: compare("pageviews"),
          visits: compare("visits"),
          topPages: traffic.topPages,
          topReferrers: traffic.topReferrers,
        }
      : "No website traffic data is connected for this client.",
    ...(leads.length > 0 && {
      leads: leads.map(({ label, current, previous }) => ({ label, current, previous, change: current - previous })),
    }),
    ...(google && {
      googleRecords: {
        rating: rating(google.rating),
        reviewCount: google.reviewCount,
        ...(google.before && {
          atStartOfPeriod: { rating: rating(google.before.rating), reviewCount: google.before.reviewCount },
        }),
        ...(gained !== null && { reviewsGained: gained }),
        ...(moved !== null && { ratingChange: moved }),
      },
    }),
  };

  // Each kind of figure the email carries, and whether it has an earlier period behind it.
  const compared = [
    ...(traffic ? [traffic.previous.visits > 0] : []),
    ...(google && (google.reviewCount !== null || google.rating !== null)
      ? [
          (google.reviewCount === null || gained !== null) && (google.rating === null || moved !== null),
        ]
      : []),
    ...(leads.length > 0 ? [(input.events?.previous.length ?? 0) > 0] : []),
  ];

  return {
    google: googleRows(google),
    traffic: traffic ? trafficNumbers(traffic.current, traffic.previous) : [],
    leads,
    comparable: compared.some(Boolean),
    describable: compared.length > 0 && compared.every(Boolean),
    facts,
  };
}

// Words that do not state a fact: a guess, praise, a size with no figure, or a quantity spelled out
// where the check below cannot see it. A sentence with one of them does not go to a client.
const LOOSE = new RegExp(
  `\\b(${[
    // guessing
    "may|might|could|possibly|perhaps|potential|potentially|likely|unlikely|probably|seems?|appears?",
    "suggests?|suggesting|indicates?|indicating|opportunit(?:y|ies)|expected|promising",
    // praising
    "strong|strongly|great|excellent|impressive|solid|healthy|good|well|nice|fantastic|amazing",
    "outstanding|remarkable|robust|positive|encouraging|successful",
    // sizing up
    "significant|significantly|substantial|substantially|considerable|considerably|noticeable|noticeably",
    "sharp|sharply|dramatic|dramatically|huge|massive|slight|slightly|modest|minor|major",
    "some|several|many|few|small|large|big|little",
    // quantities in words
    "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens?|hundreds?|thousands?",
    "doubled?|tripled?|quadrupled|halved|half|twice|thrice|quarter",
  ].join("|")})\\b`,
  "i",
);

function numbersIn(value: unknown, found: number[] = []): number[] {
  if (typeof value === "number") found.push(Math.abs(value));
  else if (Array.isArray(value)) value.forEach((item) => numbersIn(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => numbersIn(item, found));
  return found;
}

// A sentence may go out when it states something, says it with a number, and every number in it is
// one the AI was given. The business name is taken out first: "24 Hour Locksmith" is not a figure.
function sound(sentence: string, clientName: string, allowed: number[]): boolean {
  const text = sentence.split(clientName).join(" ");
  if (LOOSE.test(text)) return false;
  const cited = (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((match) => Number(match.replace(/,/g, "")));
  return cited.length > 0 && cited.every((value) => allowed.some((known) => Math.abs(known - value) < 1e-9));
}

const MAX_INSIGHTS = 3;

// The AI's wording, kept only where it holds up. `summary` is null when it does not, and the email
// then says its own plain sentence (see plainSummary). Unless every kind of figure has an earlier
// period behind it, none of the AI's wording is used: there is no full trend to describe yet.
// What this cannot check is meaning: a sentence that pairs a real number with the wrong thing, or
// says "fell" for a rise, still passes.
export function safeText(
  output: Pick<AiOutput, "summary" | "insights">,
  figures: ReportFigures,
  clientName: string,
): { summary: string | null; insights: string[] } {
  if (!figures.describable) return { summary: null, insights: [] };
  const allowed = numbersIn(figures.facts);
  return {
    summary: sound(output.summary, clientName, allowed) ? output.summary.trim() : null,
    insights: output.insights
      .filter((insight) => sound(insight, clientName, allowed))
      .slice(0, MAX_INSIGHTS)
      .map((insight) => insight.trim()),
  };
}

// The summary written from the figures alone, for when the AI's does not hold up.
export function plainSummary(input: {
  periodDays: number;
  traffic: Traffic | null;
  google: GoogleFigures | null;
  comparable: boolean;
}): string {
  const { traffic, google } = input;
  const parts: string[] = [];
  if (traffic) {
    const visitors = traffic.current.visitors;
    const change = percent(visitors, traffic.previous.visitors);
    parts.push(
      `${number.format(visitors)} ${visitors === 1 ? "person" : "people"} visited your website` +
        (change === null ? "" : ` (${signed(change)}% on the ${input.periodDays} days before)`),
    );
  }
  if (google && google.reviewCount !== null) {
    const count = number.format(google.reviewCount);
    const before = google.before?.reviewCount ?? null;
    const gained = before === null ? null : google.reviewCount - before;
    if (gained === null) parts.push(`your Google profile has ${count} reviews`);
    else if (gained > 0)
      parts.push(`your Google profile gained ${number.format(gained)} new ${gained === 1 ? "review" : "reviews"}, ${count} in total`);
    else if (gained === 0) parts.push(`your Google profile got no new reviews and stands at ${count}`);
    else parts.push(`your Google profile shows ${count} reviews, ${number.format(-gained)} fewer than before`);
  }
  const lead = parts.length
    ? `In the last ${input.periodDays} days, ${parts.join(" and ")}.`
    : `Here are your numbers for the last ${input.periodDays} days.`;
  return input.comparable
    ? lead
    : `${lead} This is your first report, so there is no earlier period to compare with yet.`;
}
