import Link from "next/link";
import { Suspense } from "react";
import { ClientActions } from "@/components/client-actions";
import { KeyNumbers } from "@/components/key-numbers";
import { Loader } from "@/components/loader";
import { RunButtons } from "@/components/run-buttons";
import { ScheduleBadges } from "@/components/schedule-badges";
import { SendWelcome } from "@/components/send-welcome";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getClient,
  listAnalyticsSnapshots,
  listGbpSnapshots,
  requireSession,
  SNAPSHOT_LIMIT,
  type ClientView,
  type GbpSnapshotView,
} from "@/lib/data";
import { formatDate, formatDay, type KeyNumber } from "@/lib/format";
import { LEAD_LABELS } from "@/lib/leads";
import { formatPhone } from "@/lib/phone";
import { RECENT_DAYS, reviewClickTotals, type ReviewClickTotals } from "@/lib/review-clicks";
import { reviewUrl } from "@/lib/review-link";
import { umamiWebsiteUrl } from "@/lib/umami";

export default function ClientOverviewPage({ params }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<Loader />}>
      {params.then(({ id }) => (
        <Overview id={id} />
      ))}
    </Suspense>
  );
}

async function Overview({ id }: { id: string }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;

  const [analytics, gbp, clicks] = await Promise.all([
    listAnalyticsSnapshots(id),
    listGbpSnapshots(id),
    reviewClickTotals(id),
  ]);
  const traffic = analytics.snapshots[0];
  const profile = profileNumbers(gbp);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Review kit, quick links and manual report runs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <ClientActions
            client={client}
            umamiUrl={client.umamiWebsiteId ? umamiWebsiteUrl(client.umamiWebsiteId) : null}
          />
          <RunButtons clientId={client.id} clientName={client.name} schedules={client.schedules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Growth</CardTitle>
          <CardDescription>The latest figures from this client&apos;s snapshots.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Figures
            title="Google profile"
            href={`/clients/${client.id}/google-profile`}
            caption={profile.caption}
            numbers={profile.numbers}
            empty="No Google profile snapshots yet. Run a report to take the first one."
          />
          <Figures
            title="Website traffic"
            href={`/clients/${client.id}/analytics`}
            caption={
              traffic &&
              `${traffic.period}, ${formatDay(traffic.periodStart)} – ${formatDay(traffic.periodEnd)}. Change is against the period before.`
            }
            numbers={traffic?.numbers ?? []}
            empty={
              client.umamiWebsiteId
                ? "No analytics snapshots yet. Run a report to take the first one."
                : "No Umami website is connected for this client."
            }
          />
          {client.leadTypes.length > 0 && (
            <Figures
              title="Website leads"
              href={`/clients/${client.id}/analytics`}
              caption={
                traffic &&
                traffic.leads.length > 0 &&
                "Same period as the traffic above. Taps and opens are counted, not the call, message or chat itself."
              }
              numbers={traffic?.leads ?? []}
              empty="No leads recorded yet. Run a report to take the first count."
            />
          )}
        </CardContent>
      </Card>

      <ReviewLink client={client} clicks={clicks} />

      <Details client={client} />

      <Directories client={client} />

      <Emails client={client} />
    </>
  );
}

// Rating and review count: the newest snapshot where each is visible, against the oldest one.
// Google hides the review count on some captures, so the two ends are picked per figure.
function profileNumbers(snapshots: GbpSnapshotView[]): { numbers: KeyNumber[]; caption: string } {
  const figure = (label: string, key: "rating" | "reviewCount", digits: number): KeyNumber[] => {
    const visible = snapshots.flatMap((snapshot) => {
      const value = snapshot.note?.[key];
      return typeof value === "number" ? [value] : [];
    });
    if (visible.length === 0) return [];
    const show = (value: number) =>
      value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const delta = visible[0] - visible[visible.length - 1];
    return [{ label, value: show(visible[0]), change: delta ? `${delta > 0 ? "+" : ""}${show(delta)}` : "" }];
  };
  const numbers = [...figure("Rating", "rating", 1), ...figure("Reviews", "reviewCount", 0)];

  if (snapshots.length === 0) return { numbers, caption: "" };
  const since = formatDay(snapshots[snapshots.length - 1].capturedAt);
  return {
    numbers,
    caption:
      numbers.length > 0
        ? `Google's own figures where the Places API is connected, otherwise read off the screenshots. Change is since ${since}, over the last ${SNAPSHOT_LIMIT} snapshots at most.`
        : "Google has not shown the rating or review count in any snapshot yet.",
  };
}

function Figures({
  title,
  href,
  caption,
  numbers,
  empty,
}: {
  title: string;
  href: string;
  caption?: string | false;
  numbers: KeyNumber[];
  // shown when there is nothing to say at all
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        <Link href={href} className="text-xs text-primary hover:underline">
          All snapshots
        </Link>
      </div>
      {numbers.length > 0 && <KeyNumbers numbers={numbers} />}
      <p className="text-xs text-muted-foreground">{caption || empty}</p>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

const NONE = <span className="text-muted-foreground">Not set</span>;

// The emails this client gets, each openable exactly as it would arrive. Opening one sends nothing.
function Emails({ client }: { client: ClientView }) {
  const preview = (kind: "welcome" | "report") => `/api/emails/preview?clientId=${client.id}&kind=${kind}`;
  const welcome = client.welcomeEmail;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emails</CardTitle>
        <CardDescription>
          What this client is sent. A preview shows the email as it would arrive and sends nothing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Detail label="Welcome email">
            {welcome === null ? (
              <span className="text-muted-foreground">Not sent: added before there was one</span>
            ) : welcome.status === "sent" ? (
              // the addresses say whether it reached the client or the test inbox
              <>
                Sent to {welcome.to.join(", ")}
                <span className="block text-xs text-muted-foreground">
                  {formatDate(welcome.at)} UTC{welcome.copied.length > 0 && ", with a copy to the team"}
                </span>
              </>
            ) : (
              <span role="alert" className="text-destructive">
                Not sent. {welcome.error}
              </span>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <SendWelcome clientId={client.id} clientName={client.name} again={welcome?.status === "sent"} />
              <a
                href={preview("welcome")}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Preview welcome email
              </a>
            </div>
          </Detail>
          <Detail label="Report email">
            {client.schedules.length > 0 && client.active ? (
              <>Sent with every {client.schedules.join(" and ")} report</>
            ) : (
              <span className="text-muted-foreground">Only when a report is run and sent by hand</span>
            )}
            <a
              href={preview("report")}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block w-fit text-xs text-primary hover:underline"
            >
              Preview the latest report&apos;s email
            </a>
          </Detail>
        </dl>
      </CardContent>
    </Card>
  );
}

// The client's own review link and how many people it has sent on to Google. The address is shown
// as text, not a link: opening it from here would count as a click.
function ReviewLink({ client, clicks }: { client: ClientView; clicks: ReviewClickTotals }) {
  const link = reviewUrl(client);
  const figure = (label: string, { total, recent }: ReviewClickTotals["link"]): KeyNumber => ({
    label,
    value: total.toLocaleString("en-US"),
    change: `${recent.toLocaleString("en-US")} in the last ${RECENT_DAYS} days`,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review link</CardTitle>
        <CardDescription>
          The link this business shares with its customers. It shows a preview in chat apps and opens the
          Google review page.
        </CardDescription>
        {link && (
          <CardAction>
            <a
              href={`/review/${client.reviewSlug}/opengraph-image`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              See the preview
            </a>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {link ? (
          <>
            <p className="truncate font-mono text-sm select-all">{link}</p>
            <KeyNumbers numbers={[figure("Link clicks", clicks.link), figure("QR scans", clicks.qr)]} />
            <p className="text-xs text-muted-foreground">
              Counted each time someone is sent on to Google, so the same person opening it twice counts
              twice. A chat app fetching the preview is not counted. QR codes downloaded before this link
              existed point straight at Google and are not counted.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Save this client&apos;s Google review link on the Edit tab to turn its review link on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Everywhere the business is listed besides its Google Maps profile, as saved on the Edit tab.
function Directories({ client }: { client: ClientView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Public directories</CardTitle>
        <CardDescription>Where this business is listed, besides Google Maps.</CardDescription>
        <CardAction>
          <Link href={`/clients/${client.id}/edit`} className="text-sm text-primary hover:underline">
            Edit
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {client.directories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No directory listings saved yet.</p>
        ) : (
          <ul className="divide-y">
            {client.directories.map((directory, index) => (
              <li key={index} className="flex items-baseline gap-4 py-2 text-sm first:pt-0 last:pb-0">
                <span className="w-40 shrink-0 truncate font-medium">{directory.name}</span>
                <a
                  href={directory.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-primary hover:underline"
                >
                  {directory.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Details({ client }: { client: ClientView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business details</CardTitle>
        <CardAction>
          <Link href={`/clients/${client.id}/edit`} className="text-sm text-primary hover:underline">
            Edit
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Detail label="Website">
            {client.websiteUrl ? (
              <a
                href={client.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-primary hover:underline"
              >
                {client.websiteUrl}
              </a>
            ) : (
              NONE
            )}
          </Detail>
          <Detail label="Google Maps profile">
            <a
              href={client.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-primary hover:underline"
            >
              {client.url}
            </a>
          </Detail>
          <Detail label="Google review link">
            {client.googleReviewUrl ? (
              <a
                href={client.googleReviewUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-primary hover:underline"
              >
                {client.googleReviewUrl}
              </a>
            ) : (
              NONE
            )}
          </Detail>
          <Detail label="Google Place ID">
            {client.googlePlaceId ? (
              <span className="block truncate font-mono text-xs">{client.googlePlaceId}</span>
            ) : (
              <span className="text-muted-foreground">Found on the first run with the Places API</span>
            )}
          </Detail>
          <Detail label="Report recipients">{client.emails.join(", ")}</Detail>
          <Detail label="Contacts">
            {client.contacts.length === 0
              ? NONE
              : client.contacts.map((contact, index) => (
                  <div key={index}>
                    {contact.name} ·{" "}
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                      {formatPhone(contact.phone)}
                    </a>
                  </div>
                ))}
          </Detail>
          <Detail label="Schedule">
            <ScheduleBadges schedules={client.schedules} active={client.active} />
          </Detail>
          <Detail label="Website analytics">
            {client.umamiWebsiteId ? "Umami connected" : <span className="text-muted-foreground">Not connected</span>}
          </Detail>
          <Detail label="Leads in the report">
            {client.leadTypes.length > 0 ? client.leadTypes.map((type) => LEAD_LABELS[type]).join(", ") : NONE}
          </Detail>
          <Detail label="Last run">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={client.lastStatus} />
              {client.lastRunAt && (
                <span className="text-xs text-muted-foreground">{formatDate(client.lastRunAt)} UTC</span>
              )}
            </div>
            {client.lastError && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {client.lastError}
              </p>
            )}
          </Detail>
        </dl>
      </CardContent>
    </Card>
  );
}
