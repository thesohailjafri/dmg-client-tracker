import { EVENTS } from "./leads";
import type { LeadType } from "./schemas";

// The events a client's site has to send for each lead type, as the client form lists them.
export const SITE_EVENTS: Record<LeadType, { event: string; when: string }[]> = {
  calls: [{ event: EVENTS.call, when: "a visitor taps a phone (tel:) link" }],
  texts: [{ event: EVENTS.text, when: "a visitor taps a text message (sms:) link" }],
  whatsapp: [
    {
      event: EVENTS.whatsapp,
      when: "a visitor taps a WhatsApp link or button (wa.me, api.whatsapp.com, whatsapp:)",
    },
  ],
  chat: [{ event: EVENTS.chat, when: "a visitor opens the chat widget" }],
  forms: [
    { event: EVENTS.formStart, when: "a visitor first touches a form" },
    { event: EVENTS.formSubmit, when: "a form is submitted successfully" },
    { event: EVENTS.formStep, when: "a visitor reaches a later step of a multi-step form (optional)" },
  ],
  bookings: [
    { event: EVENTS.bookingOpened, when: "a visitor is sent to the booking page, by a link or by code" },
    { event: EVENTS.bookingMade, when: "a booking is made in a calendar embedded on the site" },
  ],
};

// What to hand the AI agent working in a client's site: the goal and the parts the reports depend
// on (event names and properties). How to build it is left to the agent, since every site differs.
export function trackingPrompt(types: LeadType[]): string {
  const events = types.flatMap((type) => SITE_EVENTS[type]).map(({ event, when }) => `- \`${event}\`: ${when}`);

  const notes = [
    types.includes("chat") &&
      `For \`${EVENTS.chat}\`, find which chat provider this site uses. Most widgets live in an iframe, where a click cannot be seen from the page: use the provider's own "chat opened" callback or event instead. Send it at most once per page load, however often the widget is opened and closed.`,
    types.includes("forms") &&
      `Give every form event a \`form\` property: a short fixed name for that form, such as "quote", so two forms on one site can be told apart. \`${EVENTS.formStep}\` also needs a \`step\` property written as "<form name>: <step number>".`,
    types.includes("bookings") &&
      `\`${EVENTS.bookingMade}\` is only possible where the calendar is embedded on the site (for Cal.com, its bookingSuccessfulV2 embed event). Leave it out if the site only links to the booking page.`,
  ].filter(Boolean);

  return `Add lead tracking to this website using Umami custom events. The site already loads the Umami script for its page views.

Goal: our reporting tool counts the events below for this site. Each must be sent once per action, from every place on the site where that action can happen, under exactly these names:
${events.join("\n")}
${notes.length > 0 ? `\n${notes.join("\n")}\n` : ""}
How you build it is up to you: fit this project's structure and conventions.

Never put a name, email, phone number or anything a visitor typed into an event, and do not change how anything on the site looks or behaves.

When you are done, list where each event is sent from, and any event above this site has no place for.
`;
}
