import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Loader } from "@/components/loader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient, listGbpSnapshots, requireSession, SNAPSHOT_LIMIT, type GbpSnapshotView } from "@/lib/data";
import { formatDate, isEnglish } from "@/lib/format";
import type { GbpNote, GbpState } from "@/lib/schemas";

export default function ClientGoogleProfilePage({ params }: PageProps<"/clients/[id]/google-profile">) {
  return (
    <Suspense fallback={<Loader />}>
      {params.then(({ id }) => (
        <GoogleProfile id={id} />
      ))}
    </Suspense>
  );
}

const STATES: Record<GbpState, { label: string; captured: boolean }> = {
  listing: { label: "Profile captured", captured: true },
  search_results: { label: "Search results, not the profile", captured: false },
  consent: { label: "Consent screen", captured: false },
  blocked: { label: "Blocked or error page", captured: false },
  other: { label: "Unexpected page", captured: false },
};

const HIDDEN = <span className="text-muted-foreground">Not visible</span>;

function Fact({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value ?? HIDDEN}</dd>
    </div>
  );
}

// The same fields in the same order on every snapshot, so dates can be read against each other.
function Note({ note }: { note: GbpNote }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      <Fact label="Rating" value={note.rating} />
      <Fact label="Reviews" value={note.reviewCount?.toLocaleString("en-US") ?? null} />
      <Fact label="Opening hours" value={note.hoursShown ? "Shown" : null} />
      <Fact label="Category" value={note.category} />
      <Fact label="Phone" value={note.phone} />
      <Fact label="Website" value={note.website} />
      <div className="col-span-full">
        <Fact label="Address" value={note.address} />
        {note.language && !isEnglish(note) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Google showed this page in {note.language}. The category is the AI&apos;s English translation.
          </p>
        )}
      </div>
    </dl>
  );
}

function Snapshot({ snapshot, clientName }: { snapshot: GbpSnapshotView; clientName: string }) {
  const state = snapshot.note && STATES[snapshot.note.state];
  const date = `${formatDate(snapshot.capturedAt)} UTC`;

  return (
    <li className="grid gap-5 py-5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]">
      {/* the bucket is private, so the image comes through our own route and skips the optimizer */}
      <a
        href={`/api/screenshots/${snapshot.id}`}
        target="_blank"
        rel="noreferrer"
        className="block h-44 w-40 overflow-hidden rounded-lg ring-1 ring-foreground/10"
      >
        <Image
          src={`/api/screenshots/${snapshot.id}`}
          alt={`Google profile of ${clientName} on ${date}`}
          width={160}
          height={176}
          unoptimized
          className="size-full object-cover object-top"
        />
      </a>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{date}</span>
          {state && <Badge variant={state.captured ? "secondary" : "destructive"}>{state.label}</Badge>}
        </div>

        {snapshot.note ? (
          <Note note={snapshot.note} />
        ) : (
          <p className="text-muted-foreground">
            No AI note for this snapshot. It was taken before notes were added, or the report run failed.
          </p>
        )}

        {snapshot.place && (
          <p className="text-xs text-muted-foreground">
            Rating and reviews are Google&apos;s own figures for {snapshot.place.name}, {snapshot.place.address}.
            The rest is read off the screenshot.
          </p>
        )}
        {snapshot.placeError && (
          <p role="alert" className="text-xs text-destructive">
            Google&apos;s figures were not available, so rating and reviews are as read off the screenshot.{" "}
            {snapshot.placeError}
          </p>
        )}

        {snapshot.changes.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Changed since earlier snapshots</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {snapshot.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        )}

        {snapshot.findings && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">What the AI saw</h3>
            <p className="mt-2">{snapshot.findings}</p>
          </div>
        )}
      </div>
    </li>
  );
}

async function GoogleProfile({ id }: { id: string }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;
  const snapshots = await listGbpSnapshots(id);

  // No Google profile and never had one: the tab is not offered, but its address still opens.
  if (!client.hasGoogleProfile && snapshots.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This client has no Google Business Profile.{" "}
            <Link href={`/clients/${client.id}/edit`} className="text-primary hover:underline">
              Change it on the Edit tab
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google profile snapshots</CardTitle>
        <CardDescription>
          A screenshot of the Google Maps profile each time a report runs, with the AI&apos;s note on what it
          shows. Google hides some details from signed-out visitors, so &ldquo;Not visible&rdquo; does not
          mean missing. Newest first, last {SNAPSHOT_LIMIT}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!client.hasGoogleProfile && (
          <p className="mb-5 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
            Google Business Profile is switched off for this client. These are past snapshots. No new ones
            are taken.
          </p>
        )}
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Google profile snapshots yet. Run a report to take the first one.
          </p>
        ) : (
          <ul className="divide-y">
            {snapshots.map((snapshot) => (
              <Snapshot key={snapshot.id} snapshot={snapshot} clientName={client.name} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
