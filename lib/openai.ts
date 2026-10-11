import { env } from "./env";
import {
  aiOutput,
  GBP_STATES,
  gbpNote,
  type AiOutput,
  type GbpNote,
  type MetricRow,
  type MetricTotals,
} from "./schemas";

// Must accept images and the classic chat params used below (temperature, max_tokens).
// Measured on a 1440x1600 screenshot, cost per report: gpt-4.1-nano ~$0.0007, gpt-4.1-mini ~$0.002,
// gpt-4o-mini ~$0.004 (it bills ~26k tokens per image). gpt-5+/gpt-6 models reject max_tokens.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const SYSTEM_PROMPT = `You are a local-search analyst at a marketing agency, writing a short report for a small-business owner.
You get a screenshot of the client's Google Maps / Google Business Profile page and, when available, website traffic numbers.
Rules:
- Plain English. No jargon, no hype, no filler.
- Only state what the screenshot or the numbers actually show. Never invent figures, rankings or reviews.
- If the screenshot shows a consent screen, an error or a blocked page instead of the listing, say so in screenshotFindings and base the rest on the traffic numbers alone.
- The screenshot is taken signed out, and Google often shows a "limited view" that hides the review count, the reviews themselves and most photos. Something not visible in the screenshot is not evidence that the listing lacks it: never report a missing review count, missing reviews or few photos as a problem, and never mention the limited view or the sign-in prompts.
- When the facts include googleRecords, its rating and review count come from Google's own records: use them in the report, even when the screenshot hides them or shows something else. The listing fields below still describe only what the screenshot shows.
- The blue bar at the bottom is our own watermark. Ignore it.
- Google picks the page's language from where the screenshot was taken, so its buttons, labels and the business category may be in a language the business does not use. That is not the client's doing and not a problem with the listing: read through it, write everything in English, and never mention the language or quote the foreign wording.
- screenshotFindings: 2-4 sentences on what is visible (position in results, rating, review count, photos, missing info).
- summary: 2-3 sentences the owner can read in ten seconds.
- insights: 3-5 short observations.
- recommendations: 3-5 specific actions, most valuable first.
- listing: facts read off the screenshot. This is compared with earlier screenshots, so never guess or round: use null for anything that is not visible.
  - state: "listing" when one business profile is shown, "search_results" when a list of several businesses is shown, "consent" for a cookie or consent screen, "blocked" for an error page or sign-in wall, "other" for anything else.
  - rating: the star rating as a number, e.g. 4.7 (some languages print it as "4,7"). reviewCount: the number of reviews as a whole number.
  - category: the type of business, always in English. If Google printed it in another language, give the plain English name for that type of business, e.g. "Jasa Pembuatan Kunci Duplikat" becomes "Key duplication service".
  - address, phone, website: exactly as printed on the profile.
  - hoursShown: true when opening hours or an open / closed status is visible, in any language.
  - language: the language of Google's own buttons and tabs in the screenshot, as one English word, e.g. "English" or "Indonesian".`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["screenshotFindings", "summary", "insights", "recommendations", "listing"],
  properties: {
    screenshotFindings: { type: "string" },
    summary: { type: "string" },
    insights: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    listing: {
      type: "object",
      additionalProperties: false,
      required: [
        "state",
        "rating",
        "reviewCount",
        "category",
        "address",
        "phone",
        "website",
        "hoursShown",
        "language",
      ],
      properties: {
        state: { type: "string", enum: GBP_STATES },
        rating: { type: ["number", "null"] },
        reviewCount: { type: ["integer", "null"] },
        category: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        hoursShown: { type: "boolean" },
        language: { type: "string" },
      },
    },
  },
};

const response = aiOutput.extend({ listing: gbpNote });

export type InsightInput = {
  clientName: string;
  url: string;
  periodDays: number;
  metrics: {
    current: MetricTotals;
    previous: MetricTotals;
    topPages: MetricRow[];
    topReferrers: MetricRow[];
  } | null;
  // Google's own rating and review count from the Places API, when it is connected.
  google: { rating: number | null; reviewCount: number | null } | null;
  image: { base64: string; contentType: string };
};

export async function generateInsights(input: InsightInput): Promise<{
  output: AiOutput;
  note: GbpNote;
  usage: { promptTokens: number; completionTokens: number };
}> {
  const facts = {
    client: input.clientName,
    url: input.url,
    periodDays: input.periodDays,
    traffic: input.metrics ?? "No website traffic data is connected for this client.",
    ...(input.google && { googleRecords: input.google }),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 1100,
      response_format: {
        type: "json_schema",
        json_schema: { name: "client_report", strict: true, schema: RESPONSE_SCHEMA },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: JSON.stringify(facts, null, 2) },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.image.contentType};base64,${input.image.base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string | null; refusal?: string | null } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const message = data.choices[0]?.message;
  if (!message?.content) throw new Error(`OpenAI returned no content: ${message?.refusal ?? "empty"}`);

  const { listing, ...output } = response.parse(JSON.parse(message.content));
  return {
    output,
    note: listing,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
