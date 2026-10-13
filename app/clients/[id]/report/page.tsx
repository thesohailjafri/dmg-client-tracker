import Link from "next/link";
import { Suspense } from "react";
import { Graphs } from "@/components/graphs";
import { Loader } from "@/components/loader";
import { ShareLink } from "@/components/share-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient, requireSession } from "@/lib/data";
import { loadGraphs } from "@/lib/graph-data";
import { parseRange } from "@/lib/graphs";
import { reportable } from "@/lib/schemas";

export default function ClientReportPage({ params, searchParams }: PageProps<"/clients/[id]/report">) {
  return (
    <Suspense fallback={<Loader />}>
      {Promise.all([params, searchParams]).then(([{ id }, query]) => (
        <ClientReport id={id} range={query.range} />
      ))}
    </Suspense>
  );
}

async function ClientReport({ id, range }: { id: string; range: unknown }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;
  // no Google profile and no Umami website: there are no graphs to draw
  const data = reportable(client) ? await loadGraphs(client, parseRange(range)) : null;

  return (
    <>
      {data ? (
        <Graphs data={data} basePath={`/clients/${client.id}/report`} audience="team" />
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nothing to report on yet. Add a Google Business Profile or an Umami website ID on the{" "}
              <Link href={`/clients/${client.id}/edit`} className="text-primary hover:underline">
                Edit tab
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Client link</CardTitle>
          <CardDescription>
            A read-only page for the client, with no sign-in: this report, and an overview with their
            business name, website{client.hasGoogleProfile && ", Google links, review QR code"} and
            directories. Anyone with the link can open it. Recipients, contacts and settings are never on
            it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShareLink clientId={client.id} name={client.name} token={client.shareToken} />
        </CardContent>
      </Card>
    </>
  );
}
