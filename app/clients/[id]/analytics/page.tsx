import { Suspense } from "react";
import { KeyNumbers } from "@/components/key-numbers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient, listAnalyticsSnapshots, requireSession, SNAPSHOT_LIMIT } from "@/lib/data";
import { formatDate, formatDay } from "@/lib/format";
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

async function Analytics({ id }: { id: string }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;
  const snapshots = await listAnalyticsSnapshots(id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics snapshots</CardTitle>
        <CardDescription>
          Website traffic from Umami, saved each time a report runs. Each change is against the period
          before. Newest first, last {SNAPSHOT_LIMIT}.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <details>
                  <summary className="cursor-pointer text-xs text-primary">Top pages and referrers</summary>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    <Rows title="Top pages" rows={snapshot.topPages} />
                    <Rows title="Top referrers" rows={snapshot.topReferrers} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
