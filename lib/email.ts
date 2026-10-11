import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AGENCY_EMAIL, AGENCY_NAME, BRAND_BLUE, env } from "./env";
import type { KeyNumber } from "./format";
import type { EmailResult, Schedule } from "./schemas";

// The emails a client gets: a welcome when they are added, then their weekly and monthly reports.
// Plain HTML with inline CSS and tables only, which is what mail apps (Outlook most of all) draw
// reliably. Each email also has a plain-text version saying the same thing.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
const TEXT = "#1d1d1f";
const MUTED = "#6e6e73";
const BORDER = "#e5e5ea";

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const heading = (text: string) =>
  `<h2 style="margin:32px 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};">${text}</h2>`;

const paragraph = (text: string) =>
  `<p style="margin:16px 0 0;font-size:16px;line-height:1.5;color:${TEXT};">${text}</p>`;

const list = (items: string[]) =>
  `<ul style="margin:0;padding:0 0 0 20px;">${items
    .map((item) => `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${TEXT};">${escape(item)}</li>`)
    .join("")}</ul>`;

// A table cell coloured as the button, with the link inside: Outlook ignores padding on a link.
const button = (label: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td bgcolor="${BRAND_BLUE}" style="border-radius:8px;"><a href="${escape(href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a></td></tr></table>`;

const figures = (title: string, numbers: KeyNumber[], note: string) =>
  numbers.length
    ? `${heading(title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${numbers
        .map(
          (n) =>
            `<tr><td style="padding:10px 0;font-size:15px;color:${MUTED};border-bottom:1px solid ${BORDER};">${escape(n.label)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${BORDER};"><span style="font-size:20px;font-weight:600;color:${TEXT};">${escape(n.value)}</span>${
              n.change ? `<span style="font-size:13px;color:${MUTED};">&nbsp;&nbsp;${escape(n.change)}</span>` : ""
            }</td></tr>`,
        )
        .join("")}</table>${note && `<p style="margin:8px 0 0;font-size:12px;color:${MUTED};">${note}</p>`}`
    : "";

const figuresText = (title: string, numbers: KeyNumber[]) =>
  numbers.length
    ? `\n${title.toUpperCase()}\n${numbers
        .map((n) => `${n.label}: ${n.value}${n.change ? ` (${n.change})` : ""}`)
        .join("\n")}\n`
    : "";

const AGENCY_SITE = "domoregrowth.com";
const REPLY_NOTE = "Reply to this email and it reaches our team.";
const FOOTER = `${REPLY_NOTE}\nPowered by ${AGENCY_SITE}`;

const AGENCY_FULL_NAME = "DoMoreGrowth";
// Who signs the welcome email.
const FOUNDER = { name: "Sohail Jafri", title: `Founder, ${AGENCY_FULL_NAME}` };

// The pictures in an email. Each travels inside it as an inline attachment (cid:<name>), so it
// shows without the mail app having to load anything remote.
//   logo:    the DoMoreGrowth mark in the header, the arrow cut from assets/domoregrowth.png,
//            144 x 144 on white, shown at a quarter of that so it stays sharp on dense screens.
//   founder: the photo beside the welcome email's signature. Optional: square, about 200 x 200.
//            Until the file is there the signature is the name alone.
const IMAGES = {
  logo: { file: "assets/domoregrowth-mark.png", type: "image/png" },
  founder: { file: "assets/founder.jpg", type: "image/jpeg" },
} as const;
type ImageName = keyof typeof IMAGES;

// Read the first time an email needs it, not when this file loads, and null when the file is not
// there. Only a file that was found is remembered, so one added later is picked up.
const loaded = new Map<ImageName, string>();
async function image(name: ImageName): Promise<string | null> {
  const known = loaded.get(name);
  if (known) return known;
  try {
    const content = (await readFile(join(process.cwd(), IMAGES[name].file))).toString("base64");
    loaded.set(name, content);
    return content;
  } catch {
    return null;
  }
}

export const hasFounderPhoto = async () => (await image("founder")) !== null;

// The pictures an email's HTML points at, as Resend attachments.
async function attachments(html: string) {
  const used = (Object.keys(IMAGES) as ImageName[]).filter((name) => html.includes(`cid:${name}`));
  return Promise.all(
    used.map(async (name) => {
      const content = await image(name);
      if (!content) throw new Error(`Missing email image: ${IMAGES[name].file}`);
      return { filename: IMAGES[name].file.split("/").pop(), content, content_id: name };
    }),
  );
}

// The same HTML with its pictures written into it, for showing an email in a browser, where there
// are no attachments for cid: to point at.
export async function withInlineImages(html: string): Promise<string> {
  let page = html;
  for (const name of Object.keys(IMAGES) as ImageName[]) {
    const content = await image(name);
    if (content) page = page.replace(`cid:${name}`, `data:${IMAGES[name].type};base64,${content}`);
  }
  return page;
}

// The frame every email shares. `preview` is the line a mail app shows next to the subject.
function layout(title: string, preview: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f5f5f7;">${escape(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
<tr><td style="padding:20px 32px;border-bottom:1px solid ${BORDER};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" style="padding-right:12px;"><img src="cid:logo" width="36" height="36" alt="" style="display:block;border:0;"></td>
<td style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:${TEXT};">${escape(AGENCY_NAME)} Report</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px;">
${body}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.6;color:${MUTED};">${escape(REPLY_NOTE)}<br>Powered by <a href="https://${AGENCY_SITE}" style="color:${MUTED};text-decoration:underline;">${AGENCY_SITE}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export type RenderedEmail = { subject: string; html: string; text: string };

export type ReportEmail = {
  clientName: string;
  period: string; // "Weekly"
  dateRange: string; // "Oct 2 – Oct 9, 2026"
  // one or two sentences, already checked: see lib/report-figures.ts
  summary: string;
  google: KeyNumber[]; // empty when Google's figures could not be read
  traffic: KeyNumber[]; // empty when no Umami site is connected
  leads: KeyNumber[]; // empty when no leads are ticked for the client
  insights: string[]; // empty when the AI had nothing that held up
  // the client's read-only link, null when it is turned off
  shareUrl: string | null;
};

// The weekly or monthly report: the summary, the figures, and the way to the full report.
export function renderReportEmail(report: ReportEmail): RenderedEmail {
  const compared = "Change is against the period before.";
  const html = layout(
    `${report.clientName} report`,
    report.summary,
    `<h1 style="margin:0;font-size:24px;font-weight:600;line-height:1.25;color:${TEXT};">${escape(report.clientName)}</h1>
<p style="margin:4px 0 0;font-size:14px;color:${MUTED};">${escape(report.period)} report &middot; ${escape(report.dateRange)}</p>
<p style="margin:24px 0 0;font-size:16px;line-height:1.5;color:${TEXT};">${escape(report.summary)}</p>
${figures("Google profile", report.google, "Google's own figures.")}
${figures("Website", report.traffic, compared)}
${figures("Leads from your website", report.leads, `What visitors did on your website. ${compared}`)}
${report.insights.length ? heading("What changed") + list(report.insights) : ""}
${report.shareUrl ? button("See your full report", report.shareUrl) : ""}`,
  );

  const text = [
    `${report.clientName}: ${report.period.toLowerCase()} report, ${report.dateRange}`,
    "",
    report.summary,
    figuresText("Google profile", report.google),
    figuresText("Website", report.traffic),
    figuresText("Leads from your website", report.leads),
    ...(report.insights.length ? ["WHAT CHANGED", ...report.insights.map((insight) => `- ${insight}`), ""] : []),
    ...(report.shareUrl ? [`See your full report: ${report.shareUrl}`, ""] : []),
    FOOTER,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { subject: `${report.clientName}: ${report.period.toLowerCase()} report`, html, text };
}

// When each kind of report arrives, as the welcome email tells it. Keep in step with the cron
// times in workflows/wrangler.toml.
const ARRIVES: Record<Schedule, string> = {
  weekly: "Every Monday you will get a short email with the week's numbers.",
  monthly: "On the 1st of each month you will get a short email with the month's numbers.",
};

// Sent when the client is added: a welcome from the founder, why they get a growth report at all,
// and their own link to it. The wording is the agency's pitch, so it is written out here in full.
export function renderWelcomeEmail(welcome: {
  clientName: string;
  shareUrl: string;
  schedules: Schedule[];
  // whether assets/founder.jpg is there to put beside the signature
  founderPhoto: boolean;
}): RenderedEmail {
  const glad = "We are glad to have you here.";
  const intro = `Your growth report is part of your ${AGENCY_FULL_NAME} website package. It shows how your website and your Google profile are growing, and it is always up to date. Open it whenever you like, as often as you like.`;
  const why = [
    "I have seen the same thing many times. A business owner comes to us after leaving another provider, and the reason is nearly always that they could not see what they were paying for. Nobody showed them how many people were visiting their website, or whether anything was growing.",
    "If nobody is visiting your website, why pay for one? You should never have to wonder. Not many agencies show their clients this. We do, so that you can always see for yourself how the digital side of your business is growing.",
  ];
  // a client from when there was a daily report may still carry "daily", which has no line
  const arrives = welcome.schedules.flatMap((schedule) => ARRIVES[schedule] ?? []);
  const care = "This link is yours. Anyone who has it can open the page, so pass it on only to people you want to see it.";

  const signature = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr>${
    welcome.founderPhoto
      ? `<td width="48" style="padding-right:12px;"><img src="cid:founder" width="48" height="48" alt="" style="display:block;border:0;border-radius:24px;"></td>`
      : ""
  }<td style="font-size:15px;line-height:1.4;color:${TEXT};"><strong>${escape(FOUNDER.name)}</strong><br><span style="font-size:13px;color:${MUTED};">${escape(FOUNDER.title)}</span></td></tr></table>`;

  const html = layout(
    `Welcome to ${AGENCY_FULL_NAME}`,
    `${glad} Your growth report is ready.`,
    `<h1 style="margin:0;font-size:24px;font-weight:600;line-height:1.25;color:${TEXT};">Welcome, ${escape(welcome.clientName)}</h1>
${paragraph(escape(glad))}
${paragraph(escape(intro))}
${button("Open your report", welcome.shareUrl)}
${heading("Why we do this")}
${why.map((line, index) => paragraph(escape(line)).replace("margin:16px", index ? "margin:16px" : "margin:0")).join("")}
${arrives.length ? heading("What happens next") + arrives.map((line, index) => paragraph(escape(line)).replace("margin:16px", index ? "margin:8px" : "margin:0")).join("") : ""}
${signature}
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">${escape(care)}</p>`,
  );

  const text = [
    `Welcome, ${welcome.clientName}`,
    "",
    glad,
    "",
    intro,
    "",
    `Open your report: ${welcome.shareUrl}`,
    "",
    "WHY WE DO THIS",
    ...why.flatMap((line) => [line, ""]),
    ...(arrives.length ? ["WHAT HAPPENS NEXT", ...arrives, ""] : []),
    FOUNDER.name,
    FOUNDER.title,
    "",
    care,
    "",
    FOOTER,
  ].join("\n");

  return { subject: `Welcome to ${AGENCY_FULL_NAME}: your growth report for ${welcome.clientName}`, html, text };
}

// How long Resend gets to answer. Without a limit a slow answer would hang whatever is waiting on
// the email, which for a new client is the Add client form.
const SEND_TIMEOUT = 15_000;

// Sends one email through Resend. Replies go to the team. Never throws: the result says what happened.
export async function sendEmail(input: {
  to: string[];
  email: RenderedEmail;
  // The same key within a day is sent once only, so a retried cron tick cannot email a client twice.
  idempotencyKey?: string;
}): Promise<EmailResult> {
  // EMAIL_OVERRIDE_TO reroutes every email to one inbox: set it while testing.
  const override = process.env.EMAIL_OVERRIDE_TO;
  // Only the live site may email a client. Anywhere else (a laptop, a preview deploy) an email goes
  // to the override inbox or nowhere, whatever addresses the database holds.
  if (!override && process.env.VERCEL_ENV !== "production") {
    return {
      status: "failed",
      error: "Not sent: outside production, emails only go to EMAIL_OVERRIDE_TO, and it is not set.",
    };
  }
  const to = override ? [override] : input.to;
  const subject = override ? `[Test, for ${input.to.join(", ")}] ${input.email.subject}` : input.email.subject;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(SEND_TIMEOUT),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        ...(input.idempotencyKey && { "Idempotency-Key": input.idempotencyKey }),
      },
      body: JSON.stringify({
        from: env("EMAIL_FROM"),
        to,
        reply_to: AGENCY_EMAIL,
        subject,
        html: input.email.html,
        text: input.email.text,
        attachments: await attachments(input.email.html),
      }),
    });
    // Resend answers 409 when a key is used again with a different email, which a retried run's
    // always is. The first email already went, so this one is left out and nothing has failed.
    if (res.status === 409 && input.idempotencyKey) return { status: "skipped" };
    if (!res.ok) {
      return { status: "failed", error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    return { status: "sent", id: ((await res.json()) as { id: string }).id, to };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
