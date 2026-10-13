import { ObjectId } from "mongodb";
import {
  bucketLabels,
  GRAPH_SECTION_LABELS,
  monthsSince,
  periods,
  RANGES,
  type GraphSection,
  type GraphSeries,
  type GraphsData,
  type Period,
  type RangeKey,
} from "./graphs";
import { leadSeries } from "./leads";
import { collections } from "./mongodb";
import type { GraphSectionKey, LeadType, MetricTotals } from "./schemas";
import { fetchUmamiBucket, fetchUmamiStart } from "./umami";

// What the graphs need to know about a client. The team's tab and the client's link both pass this.
export type GraphClient = {
  id: string;
  umamiWebsiteId: string;
  // false = no Google profile: the reviews section is left out and no Google reading is used
  hasGoogleProfile: boolean;
  googlePlaceId: string;
  leadTypes: LeadType[];
  // the order this client's sections are shown in
  graphOrder: GraphSectionKey[];
};

// Weeks or months asked of Umami at once. Each is two requests.
const BATCH = 6;

// Without a first date to count from, "All time" shows this many months.
const FALLBACK_MONTHS = 12;

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += BATCH) {
    results.push(...(await Promise.all(items.slice(index, index + BATCH).map(run))));
  }
  return results;
}

export type Reading = { at: number; rating: number | null; reviewCount: number | null };

// Every time Google's own figures were read for this client, oldest first: the weekly pulls, and
// the reading each report run keeps on its screenshot. What the AI read off a screenshot is left
// out, because Google often hides the count there.
export async function reviewReadings(clientId: string): Promise<Reading[]> {
  const { reviews, screenshots } = await collections();
  const id = new ObjectId(clientId);
  const [pulls, captures] = await Promise.all([
    reviews.find({ clientId: id }).toArray(),
    screenshots
      .find({ clientId: id, place: { $exists: true } }, { projection: { capturedAt: 1, place: 1 } })
      .toArray(),
  ]);
  return [
    ...pulls.map((doc) => ({ at: doc.fetchedAt.getTime(), rating: doc.rating, reviewCount: doc.reviewCount })),
    ...captures.flatMap((doc) =>
      doc.place
        ? [{ at: doc.capturedAt.getTime(), rating: doc.place.rating, reviewCount: doc.place.reviewCount }]
        : [],
    ),
  ].sort((a, b) => a.at - b.at);
}

async function trafficSections(client: GraphClient, list: Period[], unit: string): Promise<GraphSection[]> {
  const section = { key: "traffic" as const, title: GRAPH_SECTION_LABELS.traffic, note: "", series: [] };
  if (!client.umamiWebsiteId) {
    return [
      {
        ...section,
        empty: "No Umami website is connected for this client. Add its Umami website ID on the Edit tab.",
      },
    ];
  }

  let buckets: Awaited<ReturnType<typeof fetchUmamiBucket>>[];
  try {
    buckets = await inBatches(list, (period) =>
      fetchUmamiBucket(client.umamiWebsiteId, period.start, period.end, !period.partial),
    );
  } catch (error) {
    console.error(`Graphs: Umami failed for client ${client.id}`, error);
    return [{ ...section, empty: "Umami did not answer, so there is no traffic to draw. Try again in a minute." }];
  }

  const traffic = (key: keyof MetricTotals, label: string): GraphSeries => ({
    key,
    label,
    kind: "total",
    values: buckets.map((bucket) => bucket.totals[key]),
    digits: 0,
    change: "percent",
  });
  const sections: GraphSection[] = [
    {
      ...section,
      note: `From Umami. Each visitor is counted once per ${unit}, so the bars do not add up to a total.`,
      series: [traffic("visitors", "Visitors"), traffic("pageviews", "Page views"), traffic("visits", "Visits")],
      empty: "",
    },
  ];

  // Only the lead types ticked for this client, the same rows its report shows.
  if (client.leadTypes.length > 0) {
    sections.push({
      key: "leads",
      title: GRAPH_SECTION_LABELS.leads,
      note: "What visitors did on the website. Taps and opens are counted, not the call, message or chat itself.",
      series: leadSeries(
        client.leadTypes,
        buckets.map((bucket) => bucket.events),
      ).map(({ event, label, counts }) => ({
        key: event,
        label,
        kind: "total",
        values: counts,
        digits: 0,
        change: "difference",
      })),
      empty: "",
    });
  }
  return sections;
}

function reviewSection(client: GraphClient, readings: Reading[], list: Period[], unit: string): GraphSection {
  // A count is a running total, so a period shows its last reading, not a sum.
  const last = (key: "rating" | "reviewCount") =>
    list.map(({ start, end }) => {
      let value: number | null = null;
      for (const reading of readings) {
        if (reading.at >= start && reading.at < end && reading[key] !== null) value = reading[key];
      }
      return value;
    });
  const reviews = last("reviewCount");
  const rating = last("rating");
  const drawn = [...reviews, ...rating].some((value) => value !== null);

  return {
    key: "reviews",
    title: GRAPH_SECTION_LABELS.reviews,
    note: `Google's own figures, read every Monday and on each report run. Each point is the last reading in that ${unit}.`,
    series: drawn
      ? [
          { key: "reviewCount", label: "Reviews", kind: "level", values: reviews, digits: 0, change: "difference" },
          { key: "rating", label: "Rating", kind: "level", values: rating, digits: 1, change: "difference", ceiling: 5 },
        ]
      : [],
    empty: client.googlePlaceId
      ? "No Google readings in this range yet. One is taken every Monday and on each report run."
      : "Google is not connected for this client yet. Its place ID is found on the first report run with the Places API.",
  };
}

// Everything the Report tab draws for one client and one range.
export async function loadGraphs(client: GraphClient, rangeKey: RangeKey): Promise<GraphsData> {
  const range = RANGES.find((option) => option.key === rangeKey)!;
  const now = Date.now();

  // With the Google profile switched off, readings from when it was on are not drawn or counted.
  const [readings, siteStart] = await Promise.all([
    client.hasGoogleProfile ? reviewReadings(client.id) : [],
    range.periods === null && client.umamiWebsiteId ? fetchUmamiStart(client.umamiWebsiteId) : null,
  ]);
  // "All time" starts at the first visit or the first Google reading, whichever came first.
  const firsts = [siteStart, readings[0]?.at].filter((at) => typeof at === "number");
  const finished =
    range.periods ?? (firsts.length > 0 ? monthsSince(Math.min(...firsts), now) : FALLBACK_MONTHS);

  const list = periods(range.unit, finished, now);
  const traffic = await trafficSections(client, list, range.unit);
  const sections = [
    ...traffic,
    ...(client.hasGoogleProfile ? [reviewSection(client, readings, list, range.unit)] : []),
  ];
  // in the order set for this client on its Edit tab
  const place = (section: GraphSection) => client.graphOrder.indexOf(section.key);
  return {
    range: range.key,
    unit: range.unit,
    buckets: bucketLabels(range.unit, list),
    sections: sections.sort((a, b) => place(a) - place(b)),
  };
}
