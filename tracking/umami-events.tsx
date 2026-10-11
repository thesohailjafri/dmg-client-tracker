"use client";

// Lead tracking for client sites. Copy this file into the site as it is (Next.js or plain React);
// the site already loads the Umami script for its page views, and this adds the events the tracker
// app counts as leads. Not used by the tracker app itself.
//
// The event names are the ones lib/leads.ts in the tracker app reads. Keep them the same on every
// site: the reports rely on it.
//
//   1. Calls, texts, WhatsApp and booking links: mount <TrackLinks /> once in the root layout.
//      Every tel: link, sms: link, WhatsApp link and link to a booking page on the site is then
//      counted, with no change to the links themselves.
//
//   2. Forms: one hook per form, named so its numbers can be told apart from another form's.
//
//        const tracking = useFormTracking("quote");
//        <form onFocus={tracking.start} onSubmit={() => { tracking.submit(); ... }}>
//
//      tracking.step(2) when the visitor reaches a later step (optional, internal detail only), and
//      tracking.booking() when the form's own code sends the visitor on to the booking page.
//
//   3. Chat widget: call chatOpened() from the chat provider's own "opened" callback. A click
//      listener does not work, because most widgets live in an iframe.
//
//   4. Bookings made: only when the Cal.com calendar is embedded on the site.
//
//        cal("on", { action: "bookingSuccessfulV2", callback: bookingMade });
//
// Never put a name, email, phone number or anything typed by the visitor in an event. Those go in
// the booking link's prefill, not in analytics.

import { useEffect, useMemo, useRef } from "react";

type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void };
  }
}

// Does nothing when the Umami script is blocked or has not loaded: tracking never breaks the site.
export function track(name: string, data?: EventData) {
  window.umami?.track(name, data);
}

// wa.me/<number>, api.whatsapp.com/send, web.whatsapp.com/send and the whatsapp: app link
const WHATSAPP_HOSTS = ["wa.me", "whatsapp.com"];

function linksTo(href: string, hosts: string[]) {
  try {
    const { hostname } = new URL(href, window.location.href);
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

// Mount once in the root layout. `bookingHosts` are the domains whose links count as a booking page.
export function TrackLinks({ bookingHosts = ["cal.com"] }: { bookingHosts?: string[] }) {
  const hosts = bookingHosts.join(",");

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      // a link carrying its own data-umami-event is already sent by the Umami script
      if (!link || link.closest("[data-umami-event]")) return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) track("call_click");
      else if (href.startsWith("sms:")) track("sms_click");
      else if (href.startsWith("whatsapp:") || linksTo(href, WHATSAPP_HOSTS)) track("whatsapp_click");
      else if (linksTo(href, hosts.split(","))) track("book_click");
    }
    // capture, so a handler on the page that stops the click does not hide it
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hosts]);

  return null;
}

// The events of one form. `form` is a short fixed name such as "quote" or "contact".
export function useFormTracking(form: string) {
  const started = useRef(false);

  return useMemo(
    () => ({
      // the first time the visitor touches the form; safe to call on every focus
      start() {
        if (started.current) return;
        started.current = true;
        track("form_start", { form });
      },
      // the form's name is part of the value so the tracker can tell one form's steps from another's
      step(step: string | number) {
        track("form_step", { form, step: `${form}: ${step}` });
      },
      submit() {
        track("form_submit", { form });
      },
      // Only when code sends the visitor to the booking page (router, window.location, an embedded
      // calendar). A plain link the visitor clicks is already counted by <TrackLinks />.
      booking() {
        track("book_click", { form });
      },
    }),
    [form],
  );
}

let chatSent = false;

// For the chat provider's "opened" callback. Counts once per page load, however often the widget
// is opened and closed.
export function chatOpened() {
  if (chatSent) return;
  chatSent = true;
  track("chat_open");
}

// The callback for the Cal.com embed's bookingSuccessfulV2 event.
export function bookingMade() {
  track("book_complete");
}
