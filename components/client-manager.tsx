"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  GlobeIcon,
  IdCardIcon,
  MapPinIcon,
  MegaphoneIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VisitingCardDialog } from "@/components/card/visiting-card-dialog";
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
import { formatPhone } from "@/lib/phone";
import { reviewUrl } from "@/lib/review-link";

// What has to be typed into the delete dialog before the button unlocks.
const DELETE_WORD = "confirm";

type Tab = "active" | "inactive";

export function ClientManager({ clients }: { clients: ClientView[] }) {
  const router = useRouter();
  // the client awaiting delete confirmation, and what has been typed to confirm it
  const [deleting, setDeleting] = useState<ClientView | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [removing, setRemoving] = useState(false);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  // id of the client being activated / deactivated
  const [toggling, setToggling] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  // the client whose review QR code / review banner / visiting card is open
  const [qrFor, setQrFor] = useState<ClientView | null>(null);
  const [bannerFor, setBannerFor] = useState<ClientView | null>(null);
  const [cardFor, setCardFor] = useState<ClientView | null>(null);
  // id of the client whose review link was just copied
  const [copied, setCopied] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? clients.filter((client) =>
        [
          client.name,
          client.url,
          client.websiteUrl,
          client.address,
          client.businessPhone,
          client.businessEmail,
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
      await navigator.clipboard.writeText(reviewUrl(client));
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
            Scheduled reports are emailed by the Cloudflare Worker from 13:30 UTC (7:00 PM IST): weekly on Mondays, monthly on the 1st. Inactive clients are
            skipped.
          </CardDescription>
          <CardAction>
            <Button nativeButton={false} render={<Link href="/clients/new" />}>
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
                  placeholder="Search name, website, email or phone"
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
                          {client.url && (
                            <div className="max-w-64 truncate text-xs text-muted-foreground">{client.url}</div>
                          )}
                          <div className="flex gap-3 text-xs">
                            {client.websiteUrl && (
                              <a
                                href={client.websiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                Website
                              </a>
                            )}
                            {client.googleReviewUrl && (
                              <a
                                href={client.googleReviewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                Review link
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {client.emails.join(", ")}
                          {client.contacts.map((contact, index) => (
                            <div key={index} className="text-muted-foreground">
                              {contact.name} ·{" "}
                              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                                {formatPhone(contact.phone)}
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
                              <Button
                                variant="outline"
                                size="sm"
                                nativeButton={false}
                                render={<Link href={`/clients/${client.id}/edit`} />}
                              >
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
                                  {/* the review kit and the Google links are for a client with a Google profile */}
                                  {client.hasGoogleProfile && (
                                    <>
                                      <DropdownMenuItem onClick={() => setQrFor(client)}>
                                        <QrCodeIcon />
                                        Review QR code
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setBannerFor(client)}>
                                        <MegaphoneIcon />
                                        Review request banner
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => setCardFor(client)}>
                                    <IdCardIcon />
                                    Visiting card
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {client.hasGoogleProfile && (
                                    <DropdownMenuItem
                                      render={<a href={client.url} target="_blank" rel="noreferrer" />}
                                    >
                                      <MapPinIcon />
                                      Open Google Maps profile
                                    </DropdownMenuItem>
                                  )}
                                  {client.websiteUrl && (
                                    <DropdownMenuItem
                                      render={<a href={client.websiteUrl} target="_blank" rel="noreferrer" />}
                                    >
                                      <GlobeIcon />
                                      Open website
                                    </DropdownMenuItem>
                                  )}
                                  {/* stays open so the "copied" state is seen */}
                                  {client.hasGoogleProfile && (
                                    <DropdownMenuItem
                                      closeOnClick={false}
                                      disabled={!client.googleReviewUrl}
                                      onClick={() => copyReviewLink(client)}
                                    >
                                      {copied === client.id ? <CheckIcon /> : <CopyIcon />}
                                      {copied === client.id ? "Review link copied" : "Copy review link"}
                                    </DropdownMenuItem>
                                  )}
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

      <ReviewQrDialog
        client={qrFor}
        onClose={() => setQrFor(null)}
        onEdit={(client) => router.push(`/clients/${client.id}/edit`)}
      />
      <ReviewBannerDialog client={bannerFor} onClose={() => setBannerFor(null)} />
      <VisitingCardDialog client={cardFor} onClose={() => setCardFor(null)} />

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
