"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CopyIcon, ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import type { ClientView } from "@/lib/data";
import { GRAPH_SECTION_LABELS } from "@/lib/graphs";
import { LEAD_LABELS } from "@/lib/leads";
import { DEFAULT_PHONE_COUNTRY, toE164 } from "@/lib/phone";
import {
  GRAPH_SECTIONS,
  LEAD_TYPES,
  SCHEDULES,
  type Contact,
  type Directory,
  type GraphSectionKey,
  type LeadType,
} from "@/lib/schemas";
import { SITE_EVENTS, trackingPrompt } from "@/lib/tracking-prompt";

const BLANK_CONTACT: Contact = { name: "", phone: "" };
const BLANK_DIRECTORY: Directory = { name: "", url: "" };

// Offered while typing a directory's name. Any other name can be typed too.
const DIRECTORY_NAMES = [
  "Yelp",
  "Bing Places",
  "Apple Maps",
  "Facebook",
  "Instagram",
  "Justdial",
  "Sulekha",
  "IndiaMART",
  "Tripadvisor",
  "Yellow Pages",
  "Foursquare",
  "Trustpilot",
  "Better Business Bureau",
  "Chamber of Commerce",
];

// Maps search for the business, e.g. "OK Auto" -> https://www.google.com/maps/search/ok+auto
function mapsSearchUrl(name: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(name.trim().toLowerCase()).replace(/%20/g, "+")}`;
}

// A website typed the short way, e.g. "okauto.in" -> https://okauto.in
function withScheme(address: string) {
  const trimmed = address.trim();
  return !trimmed || /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// What the browser accepts in a web address field typed as plain text: a domain with a dot in it,
// with or without http(s):// in front. The server checks the address properly on save.
// (browsers compile `pattern` with the "v" flag, where a "/" inside [] has to be escaped)
const WEB_ADDRESS_PATTERN = "\\s*(https?://)?[^\\s\\/.]+(\\.[^\\s\\/.]+)+(/\\S*)?\\s*";

// Google's own map for looking up a business's Place ID by name.
const PLACE_ID_FINDER_URL =
  "https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder";

const OPTIONAL = <span className="font-normal text-muted-foreground">Optional</span>;

// One group of the client form: what it is on the left, its fields on the right.
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-8 gap-y-4 py-5 sm:grid-cols-[9rem_1fr]">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

// Label, optional side action, the control, then help text (id `${htmlFor}-help`).
function Field({
  label,
  htmlFor,
  optional,
  action,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  action?: React.ReactNode;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor} className="shrink-0">
          {label}
          {optional && OPTIONAL}
        </Label>
        {action}
      </div>
      {children}
      {help && (
        <p id={`${htmlFor}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

// The client form, for a new client (no `client`) or an existing one. It saves by itself and
// then calls `onSaved` with the client's id; where to go next is up to the caller.
export function ClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client?: ClientView;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // controlled so the Maps search link can follow the name, and contact rows can be added / removed
  const [name, setName] = useState(client?.name ?? "");
  const [contacts, setContacts] = useState<Contact[]>(
    client && client.contacts.length > 0 ? client.contacts : [BLANK_CONTACT],
  );
  const [directories, setDirectories] = useState<Directory[]>(
    client && client.directories.length > 0 ? client.directories : [BLANK_DIRECTORY],
  );

  // controlled so the events and the prompt below the boxes follow what is ticked
  const [leadTypes, setLeadTypes] = useState<LeadType[]>(client?.leadTypes ?? []);
  const [copied, setCopied] = useState(false);
  const prompt = trackingPrompt(leadTypes);

  // the order of the sections on this client's graphs
  const [graphOrder, setGraphOrder] = useState<GraphSectionKey[]>(client?.graphOrder ?? [...GRAPH_SECTIONS]);

  // Swaps a section with the one above (-1) or below (+1) it.
  function moveSection(index: number, by: -1 | 1) {
    setGraphOrder((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  function setContact(index: number, patch: Partial<Contact>) {
    setContacts((list) => list.map((contact, i) => (i === index ? { ...contact, ...patch } : contact)));
  }

  function setDirectory(index: number, patch: Partial<Directory>) {
    setDirectories((list) => list.map((directory, i) => (i === index ? { ...directory, ...patch } : directory)));
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      setError("Could not copy the prompt. Select the text and copy it by hand.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name,
      emails: String(form.get("emails"))
        .split(/[,\s]+/)
        .filter(Boolean),
      contacts: contacts
        .map((contact) => ({ name: contact.name.trim(), phone: contact.phone.trim() }))
        .filter((contact) => contact.name || contact.phone),
      url: form.get("url"),
      websiteUrl: withScheme(String(form.get("websiteUrl"))),
      directories: directories
        .map((directory) => ({ name: directory.name.trim(), url: withScheme(directory.url) }))
        .filter((directory) => directory.name || directory.url),
      googleReviewUrl: String(form.get("googleReviewUrl")).trim(),
      googlePlaceId: form.get("googlePlaceId"),
      umamiWebsiteId: form.get("umamiWebsiteId"),
      leadTypes,
      graphOrder,
      schedules: form.getAll("schedules"),
      active: form.get("active") === "on",
    };
    const res = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
      method: client ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setPending(false);
    if (!res.ok) {
      setError(body.error ?? "Save failed.");
      return;
    }
    // creating answers with the new id; editing already knows it
    onSaved(client?.id ?? body.id ?? "");
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-col">
      <div className="divide-y overflow-y-auto px-5">
        <Section title="Business" description="The business this report is about.">
          <Field label="Business name" htmlFor="name">
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. OK Auto Service Centre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="Website"
            htmlFor="websiteUrl"
            optional
            help="The client's own site. Leave it empty if they do not have one."
          >
            {/* plain text, not type="url": the address can be typed without https:// */}
            <Input
              id="websiteUrl"
              name="websiteUrl"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="e.g. www.okauto.in"
              maxLength={2000}
              pattern={WEB_ADDRESS_PATTERN}
              title="A website address, like www.okauto.in"
              aria-describedby="websiteUrl-help"
              defaultValue={client?.websiteUrl}
            />
          </Field>
          <Field
            label="Google Maps profile link"
            htmlFor="url"
            help="Find the business on Google Maps, press Share, then Copy link, and paste it here."
            action={
              name.trim() && (
                <a
                  href={mapsSearchUrl(name)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <span className="truncate">Find on Google Maps</span>
                  <ExternalLinkIcon className="size-3 shrink-0" />
                </a>
              )
            }
          >
            <Input
              id="url"
              name="url"
              type="url"
              required
              placeholder="e.g. https://maps.app.goo.gl/Qy7kL2mNp4RsT8vW9"
              aria-describedby="url-help"
              defaultValue={client?.url}
            />
          </Field>
          <Field label="Google review link" htmlFor="googleReviewUrl" optional>
            <Input
              id="googleReviewUrl"
              name="googleReviewUrl"
              type="url"
              placeholder="e.g. https://g.page/r/CQx1aBcDeFgHiEBM/review"
              defaultValue={client?.googleReviewUrl}
            />
          </Field>
          <Field
            label="Google Place ID"
            htmlFor="googlePlaceId"
            optional
            help="Filled in by the first report run. Clear it to search again, or paste the right one if reports show the wrong business."
            action={
              <a
                href={PLACE_ID_FINDER_URL}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span className="truncate">Visit Finder</span>
                <ExternalLinkIcon className="size-3 shrink-0" />
              </a>
            }
          >
            <Input
              id="googlePlaceId"
              name="googlePlaceId"
              placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
              aria-describedby="googlePlaceId-help"
              defaultValue={client?.googlePlaceId}
            />
          </Field>
        </Section>

        <Section title="Public directories" description="Everywhere else the business is listed.">
          <div role="group" aria-labelledby="directories-label" className="flex flex-col gap-2">
            <div id="directories-label" className="flex items-center gap-2 text-sm leading-none font-medium">
              Listings
              {OPTIONAL}
            </div>
            <datalist id="directory-names">
              {DIRECTORY_NAMES.map((directory) => (
                <option key={directory} value={directory} />
              ))}
            </datalist>
            {directories.map((directory, index) => {
              // a half-filled row must be completed; a blank one is dropped on save
              const started = Boolean(directory.name.trim() || directory.url.trim());
              return (
                // on a phone the link drops to its own line, under the name
                <div key={index} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <Input
                    aria-label={`Directory ${index + 1} name`}
                    placeholder="e.g. Yelp"
                    list="directory-names"
                    maxLength={80}
                    className="w-auto flex-1 basis-32"
                    required={started}
                    value={directory.name}
                    onChange={(event) => setDirectory(index, { name: event.target.value })}
                  />
                  <Input
                    aria-label={`Directory ${index + 1} link`}
                    placeholder="e.g. yelp.com/biz/ok-auto-service-centre"
                    maxLength={2000}
                    pattern={WEB_ADDRESS_PATTERN}
                    title="The link to the listing, like yelp.com/biz/ok-auto-service-centre"
                    inputMode="url"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="order-last w-full sm:order-none sm:w-auto sm:flex-2 sm:basis-52"
                    required={started}
                    value={directory.url}
                    onChange={(event) => setDirectory(index, { url: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    aria-label={`Remove directory ${index + 1}`}
                    onClick={() => setDirectories((list) => list.filter((_, i) => i !== index))}
                  >
                    <XIcon />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2.5 w-fit text-primary hover:text-primary"
              disabled={directories.length >= 50}
              onClick={() => setDirectories((list) => [...list, BLANK_DIRECTORY])}
            >
              <PlusIcon />
              Add directory
            </Button>
            <p className="text-xs text-muted-foreground">
              Paste the link to the business&apos;s own page on each directory. The Google Maps profile is
              already saved above.
            </p>
          </div>
        </Section>

        <Section title="People" description="Who gets the report, and who to call.">
          <Field label="Report recipients" htmlFor="emails" help="Emails, separated by commas.">
            <Input
              id="emails"
              name="emails"
              required
              placeholder="e.g. owner@okauto.in, manager@okauto.in"
              aria-describedby="emails-help"
              defaultValue={client?.emails.join(", ")}
            />
          </Field>
          <div role="group" aria-labelledby="contacts-label" className="flex flex-col gap-2">
            <div id="contacts-label" className="flex items-center gap-2 text-sm leading-none font-medium">
              Contacts
              {OPTIONAL}
            </div>
            {contacts.map((contact, index) => {
              // a half-filled row must be completed; a blank one is dropped on save
              const started = Boolean(contact.name.trim() || contact.phone.trim());
              return (
                // on a phone the number drops to its own line, under the name
                <div key={index} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <Input
                    aria-label={`Contact ${index + 1} name`}
                    placeholder="e.g. Rahul Sharma"
                    className="w-auto flex-1 basis-32"
                    required={started}
                    value={contact.name}
                    onChange={(event) => setContact(index, { name: event.target.value })}
                  />
                  {/* contacts saved before this field were typed freehand, so they are read into
                      its format for display; the stored text only changes once it is edited */}
                  <PhoneInput
                    aria-label={`Contact ${index + 1} phone number`}
                    placeholder="e.g. 98765 43210"
                    className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:basis-52"
                    defaultCountry={DEFAULT_PHONE_COUNTRY}
                    required={started}
                    value={toE164(contact.phone)}
                    onChange={(phone) => setContact(index, { phone })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    aria-label={`Remove contact ${index + 1}`}
                    onClick={() => setContacts((list) => list.filter((_, i) => i !== index))}
                  >
                    <XIcon />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2.5 w-fit text-primary hover:text-primary"
              disabled={contacts.length >= 10}
              onClick={() => setContacts((list) => [...list, BLANK_CONTACT])}
            >
              <PlusIcon />
              Add contact
            </Button>
          </div>
        </Section>

        <Section title="Reporting" description="When reports go out and what goes in them.">
          <div role="group" aria-labelledby="schedules-label" className="flex flex-col gap-2">
            <div id="schedules-label" className="text-sm leading-none font-medium">
              Schedule
            </div>
            <div className="flex flex-wrap gap-2">
              {SCHEDULES.map((schedule) => (
                <Label
                  key={schedule}
                  className="h-8 rounded-lg border border-input px-3 font-normal capitalize has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary"
                >
                  <input
                    type="checkbox"
                    name="schedules"
                    value={schedule}
                    className="size-4 accent-primary"
                    defaultChecked={(client?.schedules ?? ["weekly"]).includes(schedule)}
                  />
                  {schedule}
                </Label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Weekly goes out on Mondays, monthly on the 1st. Tick none for manual runs only.
            </p>
          </div>
          <Label className="items-start gap-2.5 leading-normal">
            <input
              type="checkbox"
              name="active"
              className="mt-0.5 size-4 accent-primary"
              defaultChecked={client?.active ?? true}
            />
            <span>
              Active
              <span className="block text-xs font-normal text-muted-foreground">
                Untick to pause scheduled reports. Manual runs still work.
              </span>
            </span>
          </Label>
          <Field
            label="Umami website ID"
            htmlFor="umamiWebsiteId"
            optional
            help="Adds website traffic to the report."
          >
            <Input
              id="umamiWebsiteId"
              name="umamiWebsiteId"
              placeholder="e.g. 3f2a9c1e-7b4d-4e6a-9f10-2c8d5b7a1e34"
              aria-describedby="umamiWebsiteId-help"
              defaultValue={client?.umamiWebsiteId}
            />
          </Field>
          <div role="group" aria-labelledby="leadTypes-label" className="flex flex-col gap-2">
            <div id="leadTypes-label" className="flex items-center gap-2 text-sm leading-none font-medium">
              Leads in the report
              {OPTIONAL}
            </div>
            <div className="flex flex-wrap gap-2">
              {LEAD_TYPES.map((type) => (
                <Label
                  key={type}
                  className="h-8 rounded-lg border border-input px-3 font-normal has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={leadTypes.includes(type)}
                    onChange={(event) =>
                      setLeadTypes((list) =>
                        LEAD_TYPES.filter((other) => (other === type ? event.target.checked : list.includes(other))),
                      )
                    }
                  />
                  {LEAD_LABELS[type]}
                </Label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tick what this client&apos;s site tracks. Needs the Umami website ID and the tracking file on
              the site. Anything unticked stays out of the report.
            </p>
            {leadTypes.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-3">
                <div>
                  <h4 className="text-xs font-medium">Events the site has to send</h4>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {leadTypes
                      .flatMap((type) => SITE_EVENTS[type])
                      .map(({ event, when }) => (
                        <li key={event} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                          <code className="rounded border bg-background px-1.5 py-0.5 font-mono font-medium select-all">
                            {event}
                          </code>
                          <span className="text-muted-foreground">{when}</span>
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="trackingPrompt" className="text-xs font-medium">
                      Prompt for the AI agent working on the site
                    </label>
                    <Button type="button" variant="outline" size="xs" onClick={copyPrompt}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {copied ? "Copied" : "Copy prompt"}
                    </Button>
                  </div>
                  <textarea
                    id="trackingPrompt"
                    readOnly
                    rows={7}
                    value={prompt}
                    className="w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-xs leading-relaxed text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Follows the boxes ticked above. Paste it into the agent in the client site&apos;s
                    codebase: it states the goal and the event names, and leaves the build to the agent.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Graphs" description="What comes first on this client's graphs.">
          <div role="group" aria-labelledby="graphOrder-label" className="flex flex-col gap-2">
            <div id="graphOrder-label" className="text-sm leading-none font-medium">
              Order of sections
            </div>
            <ol className="flex flex-col gap-2">
              {graphOrder.map((key, index) => (
                <li key={key} className="flex items-center gap-3 rounded-lg border border-input py-1 pr-1 pl-3">
                  <span className="w-3 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {GRAPH_SECTION_LABELS[key]}
                    {key === "leads" && leadTypes.length === 0 && (
                      <span className="text-muted-foreground"> (hidden: no leads ticked)</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    aria-label={`Move ${GRAPH_SECTION_LABELS[key]} up`}
                    disabled={index === 0}
                    onClick={() => moveSection(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    aria-label={`Move ${GRAPH_SECTION_LABELS[key]} down`}
                    disabled={index === graphOrder.length - 1}
                    onClick={() => moveSection(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Use the arrows to put what this client cares about most at the top. The Graphs tab and the
              client&apos;s link both follow this order.
            </p>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-3 rounded-b-xl border-t bg-muted/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert" className="text-sm text-destructive empty:hidden sm:empty:block">
          {error}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : client ? "Save changes" : "Add client"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// The form on a client's Edit tab. Saving or cancelling goes back to that client's Overview.
export function EditClient({ client }: { client: ClientView }) {
  const router = useRouter();
  const overview = `/clients/${client.id}`;

  return (
    // the form brings its own padding and footer bar
    <Card className="gap-0 py-0">
      <ClientForm
        client={client}
        onSaved={() => {
          router.push(overview);
          router.refresh();
        }}
        onCancel={() => router.push(overview)}
      />
    </Card>
  );
}

// The form on the New client page. Saving opens the new client's own page.
export function NewClient() {
  const router = useRouter();

  return (
    <Card className="gap-0 py-0">
      <ClientForm
        onSaved={(id) => {
          router.push(id ? `/clients/${id}` : "/settings");
          router.refresh();
        }}
        onCancel={() => router.push("/settings")}
      />
    </Card>
  );
}
