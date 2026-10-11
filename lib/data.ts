import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isValidSession, SESSION_COOKIE } from "./auth";
import { gbpChanges, keyNumbers, periodLabel, type KeyNumber } from "./format";
import { formRows, leadFigures, silentLeadTypes, type FormRow } from "./leads";
import { collections } from "./mongodb";
import {
  type AiOutput,
  type ClientDoc,
  type ClientInput,
  type EmailResult,
  type GbpNote,
  type LeadType,
  type MetricRow,
  type Schedule,
} from "./schemas";

// Read models for the dashboard: plain JSON (string ids, ISO dates) safe to pass to client components.

export type ClientView = ClientInput & {
  id: string;
  // The secret in the client's read-only graphs link, "" when there is no link.
  shareToken: string;
  lastRunAt: string | null;
  lastStatus: "ok" | "failed" | null;
  lastError: string;
};

export type ReportView = {
  id: string;
  clientName: string;
  trigger: "manual" | "cron";
  period: Schedule;
  status: "ok" | "failed";
  error: string;
  createdAt: string;
  screenshotId: string | null;
  numbers: KeyNumber[];
  output: AiOutput | null;
  email: EmailResult;
};

// One Umami pull, as shown on a client's Analytics tab.
export type AnalyticsSnapshotView = {
  id: string;
  fetchedAt: string;
  period: string; // "Weekly"
  periodStart: string;
  periodEnd: string;
  numbers: KeyNumber[];
  topPages: MetricRow[];
  topReferrers: MetricRow[];
  // The leads ticked on the client, as its report shows them. Empty when none are ticked, and on
  // pulls from before events were read.
  leads: KeyNumber[];
  // Internal detail, never in the client's report: each form, each form step that reports itself,
  // and every event name Umami recorded, ticked or not.
  forms: FormRow[];
  formSteps: MetricRow[];
  events: MetricRow[];
};

// One Google profile screenshot, as shown on a client's Google profile tab.
export type GbpSnapshotView = {
  id: string;
  capturedAt: string;
  // The AI's fixed-field note. null on captures from before notes existed, or when the AI step failed.
  // Its rating and review count are Google's own when `place` is set.
  note: GbpNote | null;
  // The business the Places API answered for, so a wrong match can be spotted. null = not used.
  place: { name: string; address: string } | null;
  // Why the Places API did not answer, when it was tried.
  placeError: string;
  // Differences from earlier snapshots, worked out in code so the wording never varies.
  changes: string[];
  // The AI's free-text description from the same report run.
  findings: string;
};

// How many snapshots a client tab shows, newest first.
export const SNAPSHOT_LIMIT = 30;

// Pages call this before reading data, in addition to the proxy.ts gate.
export async function requireSession(): Promise<void> {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/login");
  // Everything after this reads live data, so keep it out of prerenders and prefetches.
  await connection();
}

function clientView(doc: ClientDoc): ClientView {
  return {
    id: doc._id.toString(),
    shareToken: doc.shareToken ?? "",
    name: doc.name,
    emails: doc.emails,
    contacts: doc.contacts ?? [],
    url: doc.url,
    googleReviewUrl: doc.googleReviewUrl ?? "",
    googlePlaceId: doc.googlePlaceId ?? "",
    umamiWebsiteId: doc.umamiWebsiteId,
    leadTypes: doc.leadTypes ?? [],
    schedules: doc.schedules ?? [],
    active: doc.active,
    lastRunAt: doc.lastRunAt?.toISOString() ?? null,
    lastStatus: doc.lastStatus ?? null,
    lastError: doc.lastError ?? "",
  };
}

export async function listClients(): Promise<ClientView[]> {
  const { clients } = await collections();
  const docs = await clients.find().sort({ name: 1 }).toArray();
  return docs.map(clientView);
}

// Cached per request: the client layout and the tab under it both ask for the same client.
export const getClient = cache(async (id: string): Promise<ClientView | null> => {
  if (!ObjectId.isValid(id)) return null;
  const { clients } = await collections();
  const doc = await clients.findOne({ _id: new ObjectId(id) });
  return doc ? clientView(doc) : null;
});

// The client behind a read-only graphs link, or null when the link was reset, turned off or made up.
// This is the one read that runs without a session: the token in the address is the permission.
export async function getSharedClient(token: string): Promise<ClientView | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const { clients } = await collections();
  const doc = await clients.findOne({ shareToken: token });
  return doc ? clientView(doc) : null;
}

// `silentLeads` are the ticked lead types none of the snapshots has an event for.
export async function listAnalyticsSnapshots(
  clientId: string,
): Promise<{ snapshots: AnalyticsSnapshotView[]; silentLeads: LeadType[] }> {
  const { metrics } = await collections();
  const [client, docs] = await Promise.all([
    getClient(clientId),
    metrics.find({ clientId: new ObjectId(clientId) }).sort({ periodEnd: -1 }).limit(SNAPSHOT_LIMIT).toArray(),
  ]);
  const leadTypes = client?.leadTypes ?? [];
  const snapshots = docs.map((doc) => ({
    id: doc._id.toString(),
    fetchedAt: doc.fetchedAt.toISOString(),
    period: periodLabel(Math.round((doc.periodEnd.getTime() - doc.periodStart.getTime()) / 86_400_000)),
    periodStart: doc.periodStart.toISOString(),
    periodEnd: doc.periodEnd.toISOString(),
    numbers: keyNumbers(doc.current, doc.previous),
    topPages: doc.topPages,
    topReferrers: doc.topReferrers,
    leads: leadFigures(leadTypes, doc.events).map(({ label, value, change }) => ({ label, value, change })),
    forms: formRows(doc.forms),
    formSteps: [...(doc.forms?.steps ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })),
    events: doc.events?.current ?? [],
  }));
  return {
    snapshots,
    silentLeads: silentLeadTypes(leadTypes, docs.flatMap((doc) => (doc.events ? [doc.events] : []))),
  };
}

export async function listGbpSnapshots(clientId: string): Promise<GbpSnapshotView[]> {
  const { screenshots, aiLogs } = await collections();
  const docs = await screenshots
    .find({ clientId: new ObjectId(clientId) })
    .sort({ capturedAt: -1 })
    .limit(SNAPSHOT_LIMIT)
    .toArray();

  const logs = docs.length
    ? await aiLogs
        .find({ clientId: new ObjectId(clientId), screenshotId: { $in: docs.map((doc) => doc._id) } })
        .toArray()
    : [];
  const findings = new Map(
    logs.map((log) => [log.screenshotId!.toString(), log.output?.screenshotFindings ?? ""]),
  );

  // Google's own figures win over what the AI read off the screenshot, which often hides the count.
  const notes = docs.map((doc) =>
    doc.note
      ? {
          ...doc.note,
          rating: doc.place?.rating ?? doc.note.rating,
          reviewCount: doc.place?.reviewCount ?? doc.note.reviewCount,
        }
      : null,
  );

  return docs.map((doc, index) => {
    const note = notes[index];
    const earlier = notes.slice(index + 1).filter((other) => other !== null);
    return {
      id: doc._id.toString(),
      capturedAt: doc.capturedAt.toISOString(),
      note,
      place: doc.place ? { name: doc.place.name, address: doc.place.address } : null,
      placeError: doc.placeError ?? "",
      changes: note ? gbpChanges(note, earlier) : [],
      findings: findings.get(doc._id.toString()) ?? "",
    };
  });
}

export async function listReports(limit = 20): Promise<ReportView[]> {
  const { aiLogs, metrics } = await collections();
  const logs = await aiLogs.find().sort({ createdAt: -1 }).limit(limit).toArray();

  const metricIds = logs.flatMap((log) => (log.metricsId ? [log.metricsId] : []));
  const metricDocs = metricIds.length
    ? await metrics.find({ _id: { $in: metricIds } }).toArray()
    : [];
  const metricsById = new Map(metricDocs.map((doc) => [doc._id.toString(), doc]));

  return logs.map((log) => {
    const metric = log.metricsId ? metricsById.get(log.metricsId.toString()) : undefined;
    return {
      id: log._id.toString(),
      clientName: log.clientName,
      trigger: log.trigger,
      period: log.period ?? "weekly",
      status: log.status,
      error: log.error ?? "",
      createdAt: log.createdAt.toISOString(),
      screenshotId: log.screenshotId?.toString() ?? null,
      numbers: metric ? keyNumbers(metric.current, metric.previous) : [],
      output: log.output ?? null,
      email: log.email,
    };
  });
}
