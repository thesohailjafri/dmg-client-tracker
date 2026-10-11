"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MegaphoneIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReviewBannerDialog } from "@/components/review/review-banner-dialog";
import { ReviewQrDialog } from "@/components/review/review-qr-dialog";
import { ScheduleBadges } from "@/components/schedule-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClientView } from "@/lib/data";
import { SCHEDULES, type Contact } from "@/lib/schemas";

const BLANK_CONTACT: Contact = { name: "", phone: "" };

// What has to be typed into the delete dialog before the button unlocks.
const DELETE_WORD = "confirm";

type Tab = "active" | "inactive";

// Maps search for the business, e.g. "OK Auto" -> https://www.google.com/maps/search/ok+auto
function mapsSearchUrl(name: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(name.trim().toLowerCase()).replace(/%20/g, "+")}`;
}

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

export function ClientManager({ clients }: { clients: ClientView[] }) {
  const router = useRouter();
  // null = dialog closed, "new" = add form, otherwise the client being edited
  const [editing, setEditing] = useState<ClientView | "new" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // controlled so the Maps search link can follow the name, and contact rows can be added / removed
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([BLANK_CONTACT]);
  // the client awaiting delete confirmation, and what has been typed to confirm it
  const [deleting, setDeleting] = useState<ClientView | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [removing, setRemoving] = useState(false);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  // id of the client being activated / deactivated
  const [toggling, setToggling] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  // the client whose review QR code / review banner is open
  const [qrFor, setQrFor] = useState<ClientView | null>(null);
  const [bannerFor, setBannerFor] = useState<ClientView | null>(null);
  // id of the client whose review link was just copied
  const [copied, setCopied] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? clients.filter((client) =>
        [
          client.name,
          client.url,
          ...client.emails,
          ...client.contacts.flatMap((contact) => [contact.name, contact.phone]),
        ].some((value) => value.toLowerCase().includes(needle)),
      )
    : clients;
  const byTab: Record<Tab, ClientView[]> = {
    active: matches.filter((client) => client.active),
    inactive: matches.filter((client) => !client.active),
  };
  const rows = byTab[tab];
  const confirmed = confirmText.trim().toLowerCase() === DELETE_WORD;

  const current = editing === "new" || editing === null ? null : editing;

  function open(target: ClientView | "new") {
    setError("");
    setName(target === "new" ? "" : target.name);
    setContacts(target !== "new" && target.contacts.length > 0 ? target.contacts : [BLANK_CONTACT]);
    setEditing(target);
  }

  function setContact(index: number, patch: Partial<Contact>) {
    setContacts((list) => list.map((contact, i) => (i === index ? { ...contact, ...patch } : contact)));
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
      googleReviewUrl: String(form.get("googleReviewUrl")).trim(),
      googlePlaceId: form.get("googlePlaceId"),
      umamiWebsiteId: form.get("umamiWebsiteId"),
      schedules: form.getAll("schedules"),
      active: form.get("active") === "on",
    };
    const res = await fetch(current ? `/api/clients/${current.id}` : "/api/clients", {
      method: current ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Save failed.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function askDelete(client: ClientView) {
    setConfirmText("");
    setDeleting(client);
  }

  async function remove(client: ClientView) {
    setRemoving(true);
    setListError("");
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    setRemoving(false);
    setDeleting(null);
    if (!res.ok) setListError(`Could not delete ${client.name}.`);
    router.refresh();
  }

  async function copyReviewLink(client: ClientView) {
    try {
      await navigator.clipboard.writeText(client.googleReviewUrl);
    } catch {
      setListError(`Could not copy the review link for ${client.name}.`);
      return;
    }
    setCopied(client.id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function setActive(client: ClientView, active: boolean) {
    setToggling(client.id);
    setListError("");
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setToggling(null);
    if (!res.ok) setListError(`Could not ${active ? "activate" : "deactivate"} ${client.name}.`);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Scheduled reports are emailed by the Cloudflare Worker from 06:00 UTC. Inactive clients are
            skipped.
          </CardDescription>
          <CardAction>
            <Button onClick={() => open("new")}>
              <PlusIcon />
              Add client
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="active" className="px-3">
                  Active
                  <span className="text-muted-foreground tabular-nums">{byTab.active.length}</span>
                </TabsTrigger>
                <TabsTrigger value="inactive" className="px-3">
                  Inactive
                  <span className="text-muted-foreground tabular-nums">{byTab.inactive.length}</span>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search clients"
                  placeholder="Search name, email or phone"
                  className="pl-8"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            {listError && (
              <p role="alert" className="text-sm text-destructive">
                {listError}
              </p>
            )}
            <TabsContent value={tab}>
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  {needle
                    ? `No ${tab} clients match “${query.trim()}”.`
                    : tab === "active"
                      ? "No active clients yet."
                      : "No inactive clients."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Umami</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {client.name}
                          </Link>
                          <div className="max-w-64 truncate text-xs text-muted-foreground">{client.url}</div>
                          {client.googleReviewUrl && (
                            <a
                              href={client.googleReviewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Review link
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {client.emails.join(", ")}
                          {client.contacts.map((contact, index) => (
                            <div key={index} className="text-muted-foreground">
                              {contact.name} ·{" "}
                              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                                {contact.phone}
                              </a>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {/* the tab already says active / inactive, so always show the schedule itself */}
                          <ScheduleBadges schedules={client.schedules} active />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {client.umamiWebsiteId ? "Connected" : "None"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {/* split button: Edit is the default, the arrow holds the rest */}
                            <ButtonGroup>
                              <Button variant="outline" size="sm" onClick={() => open(client)}>
                                Edit
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="outline"
                                      size="icon-sm"
                                      aria-label={`More actions for ${client.name}`}
                                    />
                                  }
                                >
                                  <ChevronDownIcon />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-60">
                                  <DropdownMenuItem
                                    disabled={toggling === client.id}
                                    onClick={() => setActive(client, !client.active)}
                                  >
                                    {client.active ? <PauseIcon /> : <PlayIcon />}
                                    {client.active ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setQrFor(client)}>
                                    <QrCodeIcon />
                                    Review QR code
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setBannerFor(client)}>
                                    <MegaphoneIcon />
                                    Review request banner
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    render={<a href={client.url} target="_blank" rel="noreferrer" />}
                                  >
                                    <MapPinIcon />
                                    Open Google Maps profile
                                  </DropdownMenuItem>
                                  {/* stays open so the "copied" state is seen */}
                                  <DropdownMenuItem
                                    closeOnClick={false}
                                    disabled={!client.googleReviewUrl}
                                    onClick={() => copyReviewLink(client)}
                                  >
                                    {copied === client.id ? <CheckIcon /> : <CopyIcon />}
                                    {copied === client.id ? "Review link copied" : "Copy Google review link"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </ButtonGroup>
                            <Button variant="destructive" size="sm" onClick={() => askDelete(client)}>
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !pending && setEditing(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{current ? `Edit ${current.name}` : "New client"}</DialogTitle>
          </DialogHeader>
          {/* key resets the uncontrolled fields when switching between clients */}
          <form key={current?.id ?? "new"} onSubmit={save} className="flex min-h-0 flex-col">
            <div className="divide-y overflow-y-auto px-5">
              <Section title="Business" description="The business this report is about.">
                <Field label="Business name" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="OK Auto"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
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
                    placeholder="https://maps.app.goo.gl/xxxxxxxxxxxxxxxxx"
                    aria-describedby="url-help"
                    defaultValue={current?.url}
                  />
                </Field>
                <Field label="Google review link" htmlFor="googleReviewUrl" optional>
                  <Input
                    id="googleReviewUrl"
                    name="googleReviewUrl"
                    type="url"
                    placeholder="https://g.page/r/xxxxxxxxxxxx/review"
                    defaultValue={current?.googleReviewUrl}
                  />
                </Field>
                <Field
                  label="Google Place ID"
                  htmlFor="googlePlaceId"
                  optional
                  help="Filled in by the first report run. Clear it to search again, or paste the right one if reports show the wrong business."
                >
                  <Input
                    id="googlePlaceId"
                    name="googlePlaceId"
                    placeholder="ChIJxxxxxxxxxxxxxxxxxxxxxxx"
                    aria-describedby="googlePlaceId-help"
                    defaultValue={current?.googlePlaceId}
                  />
                </Field>
              </Section>

              <Section title="People" description="Who gets the report, and who to call.">
                <Field label="Report recipients" htmlFor="emails" help="Emails, separated by commas.">
                  <Input
                    id="emails"
                    name="emails"
                    required
                    placeholder="owner@example.com, manager@example.com"
                    aria-describedby="emails-help"
                    defaultValue={current?.emails.join(", ")}
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
                      <div key={index} className="flex gap-2">
                        <Input
                          aria-label={`Contact ${index + 1} name`}
                          placeholder="Name"
                          required={started}
                          value={contact.name}
                          onChange={(event) => setContact(index, { name: event.target.value })}
                        />
                        <Input
                          aria-label={`Contact ${index + 1} phone number`}
                          type="tel"
                          placeholder="Phone number"
                          required={started}
                          value={contact.phone}
                          onChange={(event) => setContact(index, { phone: event.target.value })}
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
                          defaultChecked={(current?.schedules ?? ["weekly"]).includes(schedule)}
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
                    defaultChecked={current?.active ?? true}
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
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    aria-describedby="umamiWebsiteId-help"
                    defaultValue={current?.umamiWebsiteId}
                  />
                </Field>
              </Section>
            </div>

            <div className="flex flex-col gap-3 rounded-b-xl border-t bg-muted/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p role="alert" className="text-sm text-destructive empty:hidden sm:empty:block">
                {error}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : current ? "Save changes" : "Add client"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ReviewQrDialog client={qrFor} onClose={() => setQrFor(null)} onEdit={open} />
      <ReviewBannerDialog client={bannerFor} onClose={() => setBannerFor(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !removing && setDeleting(null)}>
        <AlertDialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (deleting && confirmed) remove(deleting);
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the client for good and stops its scheduled reports. Past reports are kept.
                {deleting?.active && " To pause reports and keep the client, deactivate it instead."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-delete" className="gap-1.5 font-normal select-text">
                Type
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium select-all">
                  {DELETE_WORD}
                </code>
                to delete
              </Label>
              <Input
                id="confirm-delete"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={DELETE_WORD}
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" variant="destructive" disabled={!confirmed || removing}>
                {removing ? "Deleting…" : "Delete client"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
