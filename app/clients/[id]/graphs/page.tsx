import { Suspense } from "react";
import { Graphs } from "@/components/graphs";
import { Loader } from "@/components/loader";
import { ShareLink } from "@/components/share-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient, requireSession } from "@/lib/data";
import { loadGraphs } from "@/lib/graph-data";
import { parseRange } from "@/lib/graphs";

export default function ClientGraphsPage({ params, searchParams }: PageProps<"/clients/[id]/graphs">) {
  return (
    <Suspense fallback={<Loader />}>
      {Promise.all([params, searchParams]).then(([{ id }, query]) => (
        <ClientGraphs id={id} range={query.range} />
      ))}
    </Suspense>
  );
}

async function ClientGraphs({ id, range }: { id: string; range: unknown }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;
  const data = await loadGraphs(client, parseRange(range));

  return (
    <>
      <Graphs data={data} basePath={`/clients/${client.id}/graphs`} audience="team" />

      <Card>
        <CardHeader>
          <CardTitle>Client link</CardTitle>
          <CardDescription>
            A read-only page of these graphs for the client, with no sign-in. Anyone with the link can
            open it, and it shows nothing else about the client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShareLink clientId={client.id} name={client.name} token={client.shareToken} />
        </CardContent>
      </Card>
    </>
  );
}
