import { toE164 } from "./phone";

// What a QR code on the back of a visiting card can do. Only the review code goes through our own
// link and is counted (lib/review-clicks.ts); the rest hold the number or address itself, so they
// keep working whatever happens to this app.
export const CARD_QR_TYPES = [
  { id: "review", label: "Google review", needs: "the Google review link" },
  { id: "call", label: "Call us", needs: "a phone number" },
  { id: "whatsapp", label: "WhatsApp", needs: "a phone number" },
  { id: "maps", label: "Google Maps", needs: "the Google Maps link" },
  { id: "sms", label: "Text us", needs: "a phone number" },
  { id: "web", label: "Our website", needs: "a website" },
  { id: "email", label: "Email us", needs: "an email address" },
  { id: "vcard", label: "Save contact", needs: "a phone number or an email address" },
] as const;

export type CardQrType = (typeof CARD_QR_TYPES)[number]["id"];

// A card carries at most this many codes: any more and they print too small to scan.
export const CARD_QR_LIMIT = 4;

export type CardLinkInput = {
  businessName: string;
  personName: string;
  jobTitle: string;
  // as typed on the card: "+91 98765 43210", "hello@okauto.in", "www.okauto.in"
  phone: string;
  email: string;
  website: string;
  address: string;
  // the client's own review link (counted) and its Google Maps profile
  reviewUrl: string;
  mapsUrl: string;
};

// "www.okauto.in" -> "https://www.okauto.in"
function withScheme(address: string) {
  const trimmed = address.trim();
  return !trimmed || /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// vCard 3.0 text: backslash, comma and semicolon are escaped, a line break becomes \n.
function escapeVcard(text: string) {
  return text.trim().replace(/[\\,;]/g, "\\$&").replace(/\r?\n/g, "\\n");
}

// The address card a phone offers to save. A person's card is filed under their name, with the
// business as their organisation.
function vcard(input: CardLinkInput, phone: string) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVcard(input.personName || input.businessName)}`,
    `ORG:${escapeVcard(input.businessName)}`,
    input.personName && input.jobTitle && `TITLE:${escapeVcard(input.jobTitle)}`,
    phone && `TEL;TYPE=WORK,VOICE:${phone}`,
    input.email.trim() && `EMAIL;TYPE=WORK:${escapeVcard(input.email)}`,
    input.website.trim() && `URL:${withScheme(input.website)}`,
    // ADR is seven parts: box, extended, street, city, region, postcode, country. An address typed
    // as one line goes in whole as the street.
    input.address.trim() && `ADR;TYPE=WORK:;;${escapeVcard(input.address)};;;;`,
    "END:VCARD",
  ];
  return lines.filter(Boolean).join("\r\n");
}

// What each code holds, or "" when the card has nothing for it to point at.
export function cardLinks(input: CardLinkInput): Record<CardQrType, string> {
  // "+<country><number>", so the code dials right from any country
  const phone = toE164(input.phone);
  const email = input.email.trim();
  return {
    review: input.reviewUrl,
    call: phone && `tel:${phone}`,
    whatsapp: phone && `https://wa.me/${phone.slice(1)}`,
    maps: input.mapsUrl,
    sms: phone && `sms:${phone}`,
    web: withScheme(input.website),
    email: email && `mailto:${email}`,
    vcard: phone || email ? vcard(input, phone) : "",
  };
}
