import type { WithId } from "mongodb";
import { renderReportEmail, type RenderedEmail } from "./email";
import { formatDay, periodLabel } from "./format";
import { reviewReadings } from "./graph-data";
import { collections } from "./mongodb";
import {
  plainSummary,
  readingAtStart,
  reportFigures,
  safeText,
  type GoogleFigures,
  type ReportFigures,
  type Traffic,
} from "./report-figures";
import { PERIOD_DAYS, type AiLogDoc, type ClientDoc, type MetricsDoc, type PlaceFacts } from "./schemas";
import { shareUrl } from "./share";

const DAY = 86_400_000;

// Google's figures now, set against the reading the period started from. `now` is this run's own
// reading from the Places API, or null when Google was not read.
export async function googleFigures(
  clientId: string,
  now: Pick<PlaceFacts, "rating" | "reviewCount"> | null,
  periodStart: Date,
  periodDays: number,
): Promise<GoogleFigures | null> {
  if (!now) return null;
  const before = readingAtStart(await reviewReadings(clientId), periodStart.getTime(), periodDays * DAY);
  return {
    rating: now.rating,
    reviewCount: now.reviewCount,
    before: before && { rating: before.rating, reviewCount: before.reviewCount },
  };
}

const trafficOf = (doc: MetricsDoc | null): Traffic | null =>
  doc && { current: doc.current, previous: doc.previous, topPages: doc.topPages, topReferrers: doc.topReferrers };

// The figures of one run, from what the run saved. The pipeline uses this to brief the AI, and the
// email is built from the same thing, so the two can never disagree.
export async function runFigures(
  client: WithId<ClientDoc>,
  run: Pick<AiLogDoc, "period" | "createdAt" | "metricsId" | "screenshotId">,
): Promise<{ figures: ReportFigures; traffic: Traffic | null; google: GoogleFigures | null; periodDays: number; start: Date }> {
  const { metrics, screenshots } = await collections();
  const periodDays = PERIOD_DAYS[run.period];
  const start = new Date(run.createdAt.getTime() - periodDays * DAY);
  const [metricsDoc, screenshot] = await Promise.all([
    run.metricsId ? metrics.findOne({ _id: run.metricsId }) : null,
    run.screenshotId ? screenshots.findOne({ _id: run.screenshotId }) : null,
  ]);
  const traffic = trafficOf(metricsDoc);
  const google = await googleFigures(client._id.toString(), screenshot?.place ?? null, start, periodDays);
  const figures = reportFigures({
    clientName: client.name,
    periodDays,
    traffic,
    leadTypes: client.leadTypes ?? [],
    events: metricsDoc?.events,
    google,
  });
  return { figures, traffic, google, periodDays, start };
}

// The report email for one finished run. Works for a run from any day, so the same email can be
// previewed before it is ever sent.
export async function reportEmail(client: WithId<ClientDoc>, run: AiLogDoc): Promise<RenderedEmail> {
  if (!run.output) throw new Error("This run has no report to email.");
  const { figures, traffic, google, periodDays, start } = await runFigures(client, run);
  const wording = safeText(run.output, figures, client.name);

  return renderReportEmail({
    clientName: client.name,
    period: periodLabel(periodDays),
    dateRange: `${formatDay(start)} – ${formatDay(run.createdAt)}`,
    summary: wording.summary ?? plainSummary({ periodDays, traffic, google, comparable: figures.comparable }),
    google: figures.google,
    traffic: figures.traffic,
    leads: figures.leads,
    insights: wording.insights,
    shareUrl: client.shareToken ? shareUrl(client.name, client.shareToken) : null,
  });
}
