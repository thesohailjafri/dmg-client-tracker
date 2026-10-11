import type { ObjectId } from "mongodb";
import { z } from "zod";
import { isCompletePhone } from "./phone";

// Prototype schemas. Nothing here is migrated — change freely, old docs just lack new fields.

export const SCHEDULES = ["weekly", "monthly"] as const;
export type Schedule = (typeof SCHEDULES)[number];

// Reporting window (days) covered by each kind of report.
export const PERIOD_DAYS: Record<Schedule, number> = {
  weekly: 7,
  monthly: 30,
};

// What a visitor can do on a client's website that counts as a lead. Each is ticked per client, and
// only the ticked ones go in that client's report. Counted from Umami events: see lib/leads.ts.
export const LEAD_TYPES = ["calls", "texts", "whatsapp", "chat", "forms", "bookings"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

// The sections of a client's graphs, in the default order. Each client can have its own order,
// because one client cares most about Google reviews and the next about website traffic.
export const GRAPH_SECTIONS = ["traffic", "leads", "reviews"] as const;
export type GraphSectionKey = (typeof GRAPH_SECTIONS)[number];

// A saved order made whole: every section once, anything missing (a client saved before this
// existed, or before a section was added) after the ones that were placed.
export function graphOrder(saved: readonly GraphSectionKey[] | undefined): GraphSectionKey[] {
  const placed = [...new Set(saved ?? [])].filter((key) => GRAPH_SECTIONS.includes(key));
  return [...placed, ...GRAPH_SECTIONS.filter((key) => !placed.includes(key))];
}

export const contactInput = z.object({
  name: z.string().trim().min(1, "Each contact needs a name").max(120, "Keep each contact name under 120 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{5,30}$/, "Each contact needs a valid phone number")
    .refine(isCompletePhone, "A contact's phone number is not complete for its country"),
});
export type Contact = z.infer<typeof contactInput>;

// A public web address: http(s) on a real domain name, so "https://okauto" and "https://localhost" fail.
const webUrl = (error: string) =>
  z.url({ protocol: /^https?$/, hostname: z.regexes.domain, error }).max(2000, error);

// Google's own addresses: google.com and its country sites, and the short links it hands out for
// Maps and reviews (maps.app.goo.gl, g.page, g.co, share.google). Catches a link pasted from elsewhere.
const GOOGLE_HOST = /^(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?|goo\.gl|g\.co|g\.page|share\.google)$/i;
const googleUrl = (error: string) =>
  z.url({ protocol: /^https?$/, hostname: GOOGLE_HOST, error }).max(2000, error);

// One place the business is listed: Yelp, Bing Places, a Chamber of Commerce page and so on.
export const directoryInput = z.object({
  name: z.string().trim().min(1, "Each directory needs a name").max(80, "Keep each directory name under 80 characters"),
  url: webUrl("Each directory needs a valid link, like https://www.yelp.com/biz/ok-auto"),
});
export type Directory = z.infer<typeof directoryInput>;

export const clientInput = z.object({
  // The business name, as it appears on Google Maps.
  name: z
    .string("Enter the business name")
    .trim()
    .min(1, "Enter the business name")
    .max(120, "Keep the business name under 120 characters"),
  // Who the report is emailed to. An address given twice is kept once, so nobody gets it twice.
  emails: z
    .array(z.email({ error: (issue) => `"${String(issue.input)}" is not a valid email address` }))
    .min(1, "Add at least one report recipient")
    .max(10, "A report can go to 10 recipients at most")
    .transform((list) =>
      list.filter((email, index) => list.findIndex((other) => other.toLowerCase() === email.toLowerCase()) === index),
    ),
  // People at the business and their phone numbers. Stored only; reports go to `emails`.
  contacts: z.array(contactInput).max(10, "A client can have 10 contacts at most").default([]),
  // The page the report screenshots: the business's own Maps share link (maps.app.goo.gl/...),
  // which opens the same profile every time. A search URL works too but its results can shift.
  url: googleUrl("Paste the business's Google Maps link, like https://maps.app.goo.gl/Qy7kL2mNp4RsT8vW9"),
  // The client's own website. Stored and linked to only; the report does not read it.
  websiteUrl: z
    .union([z.literal(""), webUrl("Enter a valid website address, like https://www.okauto.in")])
    .default(""),
  // Where else the business is listed, kept in one place to look up. Stored only.
  directories: z
    .array(directoryInput)
    .max(50, "A client can have 50 directories at most")
    .default([])
    .refine((list) => new Set(list.map((directory) => directory.url)).size === list.length, {
      error: "The same directory link is listed twice",
    }),
  // The client's "leave us a Google review" link. Stored only; not used by the report yet.
  googleReviewUrl: z
    .union([
      z.literal(""),
      googleUrl("Paste the Google review link, like https://g.page/r/CQx1aBcDeFgHiEBM/review"),
    ])
    .default(""),
  // The business in Google's Places API. Found by the first report run and saved here; editable in
  // case the search matched the wrong business. Empty = look it up on the next run.
  googlePlaceId: z
    .string()
    .trim()
    .regex(
      /^(?:[A-Za-z0-9_-]{10,300})?$/,
      "A Google Place ID has only letters, numbers, - and _, like ChIJN1t_tDeuEmsRUsoyG83frY4",
    )
    .optional()
    .default(""),
  // The website's ID in Umami: the 8-4-4-4-12 code in its address there.
  umamiWebsiteId: z
    .string()
    .trim()
    .regex(
      /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i,
      "An Umami website ID looks like 3f2a9c1e-7b4d-4e6a-9f10-2c8d5b7a1e34",
    )
    .optional()
    .default(""),
  // Which leads this client's site tracks and its report shows. Empty = no leads in the report.
  leadTypes: z
    .array(z.enum(LEAD_TYPES))
    .default([])
    .transform((list) => LEAD_TYPES.filter((type) => list.includes(type))),
  // A client can be on several schedules at once (e.g. weekly + monthly). Empty = manual runs only.
  schedules: z
    .array(z.enum(SCHEDULES))
    .default([])
    .transform((list) => SCHEDULES.filter((schedule) => list.includes(schedule))),
  // The order of the sections on the Report tab and the client's graphs link.
  graphOrder: z.array(z.enum(GRAPH_SECTIONS)).default([]).transform(graphOrder),
  active: z.boolean().default(true),
});
export type ClientInput = z.infer<typeof clientInput>;

// Activate / deactivate from the clients table without resending the whole client.
export const clientActivePatch = z.strictObject({ active: z.boolean() });

// collection: clients
export type ClientDoc = ClientInput & {
  _id: ObjectId;
  // The secret in this client's read-only link (/share/<business-name>/<token>). Absent = no link.
  // Made when the client is created, reset by /api/clients/[id]/share, never set by the client form.
  shareToken?: string;
  // How the welcome email went when the client was created. Absent on clients from before it existed.
  welcomeEmail?: EmailResult & { at: Date };
  lastRunAt?: Date;
  lastStatus?: "ok" | "failed";
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

// What the screenshot turned out to be. Anything but "listing" means the profile itself was not captured.
export const GBP_STATES = ["listing", "search_results", "consent", "blocked", "other"] as const;
export type GbpState = (typeof GBP_STATES)[number];

// The AI's note on one Google profile screenshot: the same fixed fields every time, so two dates
// can be compared. null = not visible in the screenshot, which is not the same as missing.
export const gbpNote = z.object({
  state: z.enum(GBP_STATES),
  rating: z.number().nullable(),
  reviewCount: z.number().nullable(),
  category: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  hoursShown: z.boolean(),
  // Language of Google's own interface in the screenshot, e.g. "English", "Indonesian". Google picks
  // it from where the browser runs. Not English means `category` is the AI's translation.
  // Notes saved before this field existed lack it.
  language: z.string(),
});
export type GbpNote = z.infer<typeof gbpNote>;

// collection: screenshots
export type ScreenshotDoc = {
  _id: ObjectId;
  clientId: ObjectId;
  url: string;
  r2Key: string;
  bytes: number;
  capturedAt: Date;
  note?: GbpNote; // written after the AI step; absent on older captures and failed runs
  place?: PlaceFacts; // only when the Places API is connected and answered
  placeError?: string; // why it did not answer
};

// Google's own figures for the business at the time of a screenshot, from the Places API.
export type PlaceFacts = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
};

// collection: reviews — one Places API reading per client per weekly pull, for the review graphs.
// Report runs keep their own reading on the screenshot (`place`); the graphs read both.
export type ReviewDoc = {
  _id: ObjectId;
  clientId: ObjectId;
  placeId: string;
  rating: number | null;
  reviewCount: number | null;
  fetchedAt: Date;
};

export type MetricTotals = {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totalTime: number; // seconds
};

export type MetricRow = { name: string; count: number };

// collection: metrics
export type MetricsDoc = {
  _id: ObjectId;
  clientId: ObjectId;
  websiteId: string;
  periodStart: Date;
  periodEnd: Date;
  current: MetricTotals;
  previous: MetricTotals;
  topPages: MetricRow[];
  topReferrers: MetricRow[];
  // Absent on pulls from before events were read.
  events?: EventCounts;
  forms?: FormCounts;
  fetchedAt: Date;
};

// Every custom event Umami recorded, by event name, in the period and in the one before it.
export type EventCounts = { current: MetricRow[]; previous: MetricRow[] };

// The form events of the period split by form: how many started and submitted each one, and how
// many reached each step where a form reports its steps.
export type FormCounts = { started: MetricRow[]; submitted: MetricRow[]; steps: MetricRow[] };

export const aiOutput = z.object({
  screenshotFindings: z.string(),
  summary: z.string(),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});
export type AiOutput = z.infer<typeof aiOutput>;

export type EmailResult =
  | { status: "sent"; id: string; to: string[] }
  | { status: "skipped" }
  | { status: "failed"; error: string };

// collection: ai_logs — one doc per pipeline run (successful or not)
export type AiLogDoc = {
  _id: ObjectId;
  clientId: ObjectId;
  clientName: string;
  trigger: "manual" | "cron";
  period: Schedule; // which report this was. Logs from when there was a daily report say "daily"
  status: "ok" | "failed";
  error?: string;
  screenshotId?: ObjectId;
  metricsId?: ObjectId;
  model?: string;
  output?: AiOutput;
  usage?: { promptTokens: number; completionTokens: number };
  email: EmailResult;
  createdAt: Date;
};
