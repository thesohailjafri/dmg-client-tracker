import { Suspense } from "react";
import { KeyNumbers } from "@/components/key-numbers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getClient,
  listAnalyticsSnapshots,
  requireSession,
  SNAPSHOT_LIMIT,
  type AnalyticsSnapshotView,
} from "@/lib/data";
import { formatDate, formatDay } from "@/lib/format";
import { LEAD_LABELS } from "@/lib/leads";
import type { MetricRow } from "@/lib/schemas";

export default function ClientAnalyticsPage({ params }: PageProps<"/clients/[id]/analytics">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      {params.then(({ id }) => (
        <Analytics id={id} />
      ))}
    </Suspense>
  );
}

function Rows({ title, rows }: { title: string; rows: MetricRow[] }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {rows.map((row) => (
            <li key={row.name} className="flex justify-between gap-4 py-1.5">
              <span className="truncate">{row.name}</span>
              <span className="tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Started against completed for each form on the site.
function Forms({ forms }: { forms: AnalyticsSnapshotView["forms"] }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">Forms</h3>
      {forms.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {forms.map((form) => (
            <li key={form.name} className="flex justify-between gap-4 py-1.5">
              <span className="truncate">{form.name}</span>
              <span className="shrink-0 tabular-nums">
                {form.started} started, {form.submitted} completed
                {form.started > 0 && ` (${Math.round((form.submitted / form.started) * 100)}%)`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Analytics({ id }: { id: string }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;
  const { snapshots, silentLeads } = await listAnalyticsSnapshots(id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics snapshots</CardTitle>
        <CardDescription>
          Website traffic and leads from Umami, saved each time a report runs. Each change is against
          the period before. Newest first, last {SNAPSHOT_LIMIT}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {silentLeads.length > 0 && (
          <p role="alert" className="mb-5 rounded-lg border border-dashed px-3 py-2 text-sm">
            No events yet for {silentLeads.map((type) => LEAD_LABELS[type].toLowerCase()).join(", ")}, which{" "}
            {silentLeads.length === 1 ? "is" : "are"} ticked for this client&apos;s report. Check the
            tracking file is on the site, or untick what the site does not have.
          </p>
        )}
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {client.umamiWebsiteId
              ? "No analytics snapshots yet. Run a report to take the first one."
              : "No Umami website is connected for this client. Add its Umami website ID in Settings."}
          </p>
        ) : (
          <ul className="divide-y">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{formatDate(snapshot.fetchedAt)} UTC</span>
                  <Badge variant="outline">{snapshot.period}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDay(snapshot.periodStart)} – {formatDay(snapshot.periodEnd)}
                  </span>
                </div>
                <KeyNumbers numbers={snapshot.numbers} />
                {snapshot.leads.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-muted-foreground">Leads in the report</h3>
                    <KeyNumbers numbers={snapshot.leads} />
                  </div>
                )}
                <details>
                  <summary className="cursor-pointer text-xs text-primary">Top pages and referrers</summary>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    <Rows title="Top pages" rows={snapshot.topPages} />
                    <Rows title="Top referrers" rows={snapshot.topReferrers} />
                  </div>
                </details>
                {/* internal only: the client's report carries the ticked leads above and nothing else */}
                {snapshot.events.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs text-primary">Forms and all events</summary>
                    <div className="mt-4 grid gap-6 sm:grid-cols-2">
                      <Forms forms={snapshot.forms} />
                      <Rows title="Form steps reached" rows={snapshot.formSteps} />
                      <Rows title="All events" rows={snapshot.events} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
