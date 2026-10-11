import { env } from "./env";
import { aiOutput, GBP_STATES, gbpNote, type AiOutput, type GbpNote } from "./schemas";

// Must accept images and the classic chat params used below (temperature, max_tokens).
// Measured on a 1440x1600 screenshot, cost per report: gpt-4.1-nano ~$0.0007, gpt-4.1-mini ~$0.002,
// gpt-4o-mini ~$0.004 (it bills ~26k tokens per image). gpt-5+/gpt-6 models reject max_tokens.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const SYSTEM_PROMPT = `You are a local-search analyst at a marketing agency, writing a short report for a small-business owner.
You get a screenshot of the client's Google Maps / Google Business Profile page and the facts for the period: website figures, leads and Google's records, whichever are available.
Rules:
- Plain English. No jargon, no hype, no filler.
- Only state what the screenshot or the numbers actually show. Never invent figures, rankings or reviews.
- Report, do not interpret. Say what the figures are and how they moved. Never guess at a cause, never predict, never say what something "may", "might", "could" or is "likely" to mean, and never praise or reassure.
- The summary and the insights are sent to the owner as written, and a program checks them first: a sentence is dropped if it has no figure in it, if it uses a number that is not in the facts, if it guesses, if it praises or sizes something up ("strong", "great", "significant", "slight", "some"), or if it spells a quantity out in words ("two", "doubled", "half"). Write every quantity in digits and use the numbers exactly as given, including changePercent, reviewsGained and ratingChange. Do not work out new numbers of your own.
- When there is little to say, say little. Fewer sentences are better than padded ones, and an empty list is a correct answer. When a previous figure is 0 or missing there is nothing to compare with: do not describe that as growth or decline.
- If the screenshot shows a consent screen, an error or a blocked page instead of the listing, say so in screenshotFindings and base the rest on the facts alone.
- The screenshot is taken signed out, and Google often shows a "limited view" that hides the review count, the reviews themselves and most photos. Something not visible in the screenshot is not evidence that the listing lacks it: never report a missing review count, missing reviews or few photos as a problem, and never mention the limited view or the sign-in prompts.
- When the facts include googleRecords, its rating and review count come from Google's own records: use them in the report, even when the screenshot hides them or shows something else. atStartOfPeriod, reviewsGained and ratingChange, when present, are where those stood when the period began and how they moved over it. The listing fields below still describe only what the screenshot shows.
- When the facts include leads, they count what visitors did on the website in this period (current) and the one before it (previous): taps on the call, text or WhatsApp button, chat widget opens, forms started and completed, booking pages opened, bookings made. These matter most to the owner, so work them into the summary and the insights. A tap on a call, text or WhatsApp button is not a call or message that happened: use the labels as given and never call them "calls", "texts" or "WhatsApp messages". An opened chat widget is not a conversation either. When every previous figure is 0, tracking may have only just started: do not describe that as growth.
- The blue bar at the bottom is our own watermark. Ignore it.
- Google picks the page's language from where the screenshot was taken, so its buttons, labels and the business category may be in a language the business does not use. That is not the client's doing and not a problem with the listing: read through it, write everything in English, and never mention the language or quote the foreign wording.
- screenshotFindings: 2-4 sentences on what is visible (position in results, rating, review count, photos, missing info). For the team, not sent to the owner.
- summary: 1-2 sentences on how the period went, each with a figure from the facts.
- insights: 0-3 short observations, each one a change shown by the figures and stating them. Empty when nothing moved or there is nothing to compare with.
- recommendations: 0-3 specific actions, each tied to a figure or to something visible in the screenshot, most valuable first. Empty rather than generic advice. For the team, not sent to the owner.
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
  // The period's figures, from reportFigures (lib/report-figures.ts). The email checks the AI's
  // wording against these same facts, so nothing may be added to them here.
  facts: Record<string, unknown>;
  image: { base64: string; contentType: string };
};

export async function generateInsights(input: InsightInput): Promise<{
  output: AiOutput;
  note: GbpNote;
  usage: { promptTokens: number; completionTokens: number };
}> {
  const { facts } = input;

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
