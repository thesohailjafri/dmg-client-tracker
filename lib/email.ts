import { AGENCY_NAME, BRAND_BLUE, env } from "./env";
import type { KeyNumber } from "./format";
import type { AiOutput, EmailResult, MetricRow } from "./schemas";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
const TEXT = "#1d1d1f";
const MUTED = "#6e6e73";
const BORDER = "#e5e5ea";

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const heading = (text: string) =>
  `<h2 style="margin:32px 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};">${text}</h2>`;

const list = (items: string[]) =>
  `<ul style="margin:0;padding:0 0 0 20px;">${items
    .map((item) => `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${TEXT};">${escape(item)}</li>`)
    .join("")}</ul>`;

const rows = (title: string, items: MetricRow[]) =>
  items.length
    ? `${heading(title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items
        .map(
          (row) =>
            `<tr><td style="padding:6px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">${escape(row.name)}</td><td align="right" style="padding:6px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">${row.count}</td></tr>`,
        )
        .join("")}</table>`
    : "";

export type ReportEmail = {
  clientName: string;
  period: string; // "Weekly"
  dateRange: string; // "Oct 2 – Oct 9, 2026"
  numbers: KeyNumber[]; // empty when no Umami site is connected
  leads: KeyNumber[]; // empty when no leads are ticked for the client
  topPages: MetricRow[];
  topReferrers: MetricRow[];
  ai: AiOutput;
};

// Plain HTML + inline CSS only. The screenshot is attached inline and referenced as cid:screenshot.
export function renderReportEmail(report: ReportEmail): string {
  const figures = (title: string, numbers: KeyNumber[], note: string) =>
    numbers.length
      ? `${heading(title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${numbers
          .map(
            (n) =>
              `<tr><td style="padding:10px 0;font-size:15px;color:${MUTED};border-bottom:1px solid ${BORDER};">${n.label}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${BORDER};"><span style="font-size:20px;font-weight:600;color:${TEXT};">${n.value}</span>${
                n.change ? `<span style="font-size:13px;color:${MUTED};">&nbsp;&nbsp;${n.change}</span>` : ""
              }</td></tr>`,
          )
          .join("")}</table><p style="margin:8px 0 0;font-size:12px;color:${MUTED};">${note}</p>`
      : "";
  const numbers = figures("Key numbers", report.numbers, "Change is versus the previous period.");
  const leads = figures(
    "Leads from your website",
    report.leads,
    "What visitors did on your website. Change is versus the previous period.",
  );

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(report.clientName)} report</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
<tr><td style="padding:16px 32px;background:${BRAND_BLUE};border-radius:12px 12px 0 0;font-size:15px;font-weight:600;color:#ffffff;">${escape(AGENCY_NAME)}</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0;font-size:24px;font-weight:600;line-height:1.25;color:${TEXT};">${escape(report.clientName)}</h1>
<p style="margin:4px 0 0;font-size:14px;color:${MUTED};">${report.period} report &middot; ${escape(report.dateRange)}</p>
<p style="margin:24px 0 0;font-size:16px;line-height:1.5;color:${TEXT};">${escape(report.ai.summary)}</p>
${numbers}
${leads}
${heading("What we see")}
${list(report.ai.insights)}
${heading("What we recommend")}
${list(report.ai.recommendations)}
${rows("Top pages", report.topPages)}
${rows("Top traffic sources", report.topReferrers)}
${heading("Your Google listing")}
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${TEXT};">${escape(report.ai.screenshotFindings)}</p>
<img src="cid:screenshot" alt="Screenshot of your Google listing" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:1px solid ${BORDER};border-radius:8px;">
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Sent by ${escape(AGENCY_NAME)}. Reply to this email with any questions.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendReportEmail(input: {
  to: string[];
  subject: string;
  html: string;
  screenshot: { base64: string; filename: string };
}): Promise<EmailResult> {
  // EMAIL_OVERRIDE_TO reroutes every report to one inbox — set it while testing.
  const to = process.env.EMAIL_OVERRIDE_TO ? [process.env.EMAIL_OVERRIDE_TO] : input.to;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: env("EMAIL_FROM"),
        to,
        subject: input.subject,
        html: input.html,
        attachments: [
          {
            filename: input.screenshot.filename,
            content: input.screenshot.base64,
            content_id: "screenshot",
          },
        ],
      }),
    });
    if (!res.ok) {
      return { status: "failed", error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    return { status: "sent", id: ((await res.json()) as { id: string }).id, to };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
