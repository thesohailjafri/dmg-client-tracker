import Link from "next/link";
import { Suspense } from "react";
import { ClientTabs } from "@/components/client-tabs";
import { Nav } from "@/components/nav";
import { ScheduleBadges } from "@/components/schedule-badges";
import { getClient, requireSession } from "@/lib/data";

// One client: its name and tabs here, the tab's content in the page below.
// The id is only known at request time, so everything that reads it (or the URL) sits in Suspense.
export default function ClientLayout({ children, params }: LayoutProps<"/clients/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="h-14 border-b bg-card" />}>
        <Nav />
      </Suspense>
      <div className="mx-auto w-full max-w-5xl px-6 pb-24">
        <Suspense
          fallback={
            <header className="pt-10 pb-8">
              <p className="text-sm text-muted-foreground">Loading…</p>
            </header>
          }
        >
          {params.then(({ id }) => (
            <ClientHeader id={id} />
          ))}
        </Suspense>
        <main className="flex flex-col gap-8">{children}</main>
      </div>
    </>
  );
}

async function ClientHeader({ id }: { id: string }) {
  await requireSession();
  const client = await getClient(id);

  if (!client) {
    return (
      <header className="pt-10 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Client not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted.{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            Back to the dashboard
          </Link>
          .
        </p>
      </header>
    );
  }

  return (
    <header className="pt-10 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <ScheduleBadges schedules={client.schedules} active={client.active} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Growth, analytics snapshots and Google profile snapshots.
      </p>
      <ClientTabs clientId={client.id} />
    </header>
  );
}
