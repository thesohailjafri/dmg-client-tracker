import type { KeyNumber } from "./format";
import type { EventCounts, FormCounts, LeadType, MetricRow } from "./schemas";

// The event names every client site sends to Umami. tracking/umami-events.tsx, the file copied into
// those sites, uses the same names: change them in both places or not at all.
export const EVENTS = {
  call: "call_click",
  text: "sms_click",
  whatsapp: "whatsapp_click",
  chat: "chat_open",
  formStart: "form_start",
  formStep: "form_step",
  formSubmit: "form_submit",
  bookingOpened: "book_click",
  bookingMade: "book_complete",
} as const;

// The tick boxes on the client form.
export const LEAD_LABELS: Record<LeadType, string> = {
  calls: "Call taps",
  texts: "Text taps",
  whatsapp: "WhatsApp taps",
  chat: "Chat opens",
  forms: "Forms",
  bookings: "Bookings",
};

// The report rows behind each lead type. A tap on a call or WhatsApp button is not a call or chat
// that happened, so the wording says what was counted. `optional` rows only show once the site has
// sent that event: book_complete needs the booking calendar embedded on the site, which not every
// site has.
const ROWS: Record<LeadType, { event: string; label: string; optional?: true }[]> = {
  calls: [{ event: EVENTS.call, label: "Call button taps" }],
  texts: [{ event: EVENTS.text, label: "Text button taps" }],
  whatsapp: [{ event: EVENTS.whatsapp, label: "WhatsApp button taps" }],
  chat: [{ event: EVENTS.chat, label: "Chat widget opens" }],
  forms: [
    { event: EVENTS.formStart, label: "Forms started" },
    { event: EVENTS.formSubmit, label: "Forms completed" },
  ],
  bookings: [
    { event: EVENTS.bookingOpened, label: "Booking page opened" },
    { event: EVENTS.bookingMade, label: "Bookings made", optional: true },
  ],
};

const number = new Intl.NumberFormat("en-US");

const count = (rows: MetricRow[], event: string) => rows.find((row) => row.name === event)?.count ?? 0;

export type LeadFigure = KeyNumber & { current: number; previous: number };

// The lead rows for a report, in the dashboard and the client email alike. Counts are small, so the
// change is a plain difference, not a percentage. A period before with no events at all is taken
// as the tracking not being installed yet, and nothing is compared with it.
export function leadFigures(types: LeadType[], events: EventCounts | undefined): LeadFigure[] {
  if (!events) return [];
  const comparable = events.previous.length > 0;
  return types.flatMap((type) =>
    ROWS[type].flatMap(({ event, label, optional }) => {
      const current = count(events.current, event);
      const previous = count(events.previous, event);
      if (optional && !current && !previous) return [];
      const diff = current - previous;
      return [
        {
          label,
          value: number.format(current),
          change: comparable && diff ? `${diff > 0 ? "+" : ""}${number.format(diff)}` : "",
          current,
          previous,
        },
      ];
    }),
  );
}

// Ticked lead types whose event has not shown up in any of the given pulls: most likely the tracking
// file is missing from the site, or the box was ticked for something the site does not have.
export function silentLeadTypes(types: LeadType[], pulls: EventCounts[]): LeadType[] {
  if (pulls.length === 0) return [];
  return types.filter((type) =>
    pulls.every((pull) => !count(pull.current, ROWS[type][0].event) && !count(pull.previous, ROWS[type][0].event)),
  );
}

export type FormRow = { name: string; started: number; submitted: number };

// One row per form, from the form events split by their `form` property.
export function formRows(forms: FormCounts | undefined): FormRow[] {
  if (!forms) return [];
  const names = new Set([...forms.started, ...forms.submitted].map((row) => row.name));
  return [...names].sort().map((name) => ({
    name,
    started: count(forms.started, name),
    submitted: count(forms.submitted, name),
  }));
}
