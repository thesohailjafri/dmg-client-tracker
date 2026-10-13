import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Graphs } from "@/components/graphs";
import { Loader } from "@/components/loader";
import { Logo } from "@/components/logo";
import { sharedDetails, ShareOverview } from "@/components/share-overview";
import { getSharedClient, type ClientView } from "@/lib/data";
import { AGENCY_EMAIL } from "@/lib/env";
import { loadGraphs } from "@/lib/graph-data";
import { parseRange, sharePath } from "@/lib/graphs";
import { reportable } from "@/lib/schemas";
import { cn } from "@/lib/utils";

// A client's read-only page, opened from a link the team sends them: the Report tab with their
// graphs, and the Overview tab (?tab=overview) with their business details. No sign-in: proxy.ts lets
// /share/ through and the token in the address is the permission. The business name before it is
// only there to make the link recognisable: it is never used to find the client, and an out-of-date
// one is redirected to the current name. Only the graphs and `sharedDetails` are rendered here, so
// nothing else about the client (emails, contacts, IDs, run status) can reach the page.

const TABS = [
  { key: "report", label: "Report" },
  { key: "overview", label: "Overview" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const AGENCY = process.env.AGENCY_NAME || "DMG";

// What the report is of, in fixed words: the website when it is tracked in Umami, the Google
// profile when the business has one. `whose` is "your" on the page and "<name>'s" in the link
// preview. null when there is neither yet, so nothing is claimed to be growing.
function growing(client: ClientView, whose: string): string | null {
  const website = Boolean(client.umamiWebsiteId);
  if (website && client.hasGoogleProfile) return `How ${whose} website and Google profile are growing.`;
  if (website) return `How ${whose} website is growing.`;
  if (client.hasGoogleProfile) return `How ${whose} Google profile is growing.`;
  return null;
}

// Said in place of the report for a client with nothing to report on yet.
const BEING_SET_UP = "Your report is being set up.";

// The tab title and the link preview. The business name only goes in once the token has found a
// client: a link that is not active says nothing about anyone. The preview image beside this file
// (opengraph-image.tsx) follows the same rule.
export async function generateMetadata({ params }: PageProps<"/share/[slug]/[token]">): Promise<Metadata> {
  const { token } = await params;
  const client = await getSharedClient(token);
  const title = client ? `${client.name}: Growth Report by ${AGENCY}` : `Growth Report by ${AGENCY}`;
  const subject = client && growing(client, `${client.name}'s`);
  const description = subject ? `${subject} ${AGENCY} Client Tracker.` : `${AGENCY} Client Tracker.`;
  return {
    title,
    description,
    referrer: "no-referrer",
    openGraph: { title, description, siteName: `${AGENCY} Client Tracker`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}
const AGENCY_URL = "https://domoregrowth.com";

export default function SharePage({ params, searchParams }: PageProps<"/share/[slug]/[token]">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 max-sm:px-4">
      <Suspense fallback={<Loader className="pt-24" />}>
        {Promise.all([params, searchParams]).then(([{ slug, token }, query]) => (
          <Shared
            slug={slug}
            token={token}
            tab={query.tab === "overview" ? "overview" : "report"}
            range={query.range}
          />
        ))}
      </Suspense>
    </div>
  );
}

async function Shared({ slug, token, tab, range }: { slug: string; token: string; tab: Tab; range: unknown }) {
  // Live data on every visit, never a prerender.
  await connection();
  const client = await getSharedClient(token);

  // A link sent before the business was renamed still opens: the token finds the client, and the
  // address moves on to the current name, on the same tab and range.
  const path = client && sharePath(client.name, token);
  if (path && path !== `/share/${slug}/${token}`) {
    if (tab === "overview") redirect(`${path}?tab=overview`);
    redirect(typeof range === "string" ? `${path}?range=${parseRange(range)}` : path);
  }

  if (!client) {
    return (
      <header className="pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">This link is not active</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been replaced or turned off. Ask{" "}
          <a href={`mailto:${AGENCY_EMAIL}`} className="text-primary hover:underline">
            {AGENCY}
          </a>{" "}
          for a new one.
        </p>
      </header>
    );
  }

  const basePath = sharePath(client.name, token);
  return (
    <>
      <header className="pt-10 pb-8">
        <p className="text-sm text-muted-foreground">
          <a
            href={AGENCY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 hover:text-foreground hover:underline"
          >
            <Logo className="size-5" />
            Prepared by {AGENCY}
          </a>
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{client.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab === "overview"
            ? "Your business details, as we have them on file."
            : (growing(client, "your") ?? BEING_SET_UP)}
        </p>
        <nav aria-label="Sections" className="mt-6 flex gap-1 border-b">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={item.key === "report" ? basePath : `${basePath}?tab=${item.key}`}
              aria-current={item.key === tab ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground max-sm:px-2",
                item.key === tab && "border-primary text-primary hover:text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex flex-col gap-8">
        {tab === "overview" ? (
          <ShareOverview details={sharedDetails(client)} />
        ) : reportable(client) ? (
          <SharedReport client={client} basePath={basePath} range={range} />
        ) : (
          // no Google profile and no website tracked yet: there are no graphs to draw. Read with the
          // line under the business name, which says the report is being set up.
          <p className="text-sm text-muted-foreground">It will appear here once tracking is in place.</p>
        )}
      </main>
    </>
  );
}

// The graphs are read only on the Report tab: they wait on Umami, which the Overview has no use for.
async function SharedReport({ client, basePath, range }: { client: ClientView; basePath: string; range: unknown }) {
  const data = await loadGraphs(client, parseRange(range));
  return <Graphs data={data} basePath={basePath} audience="client" />;
}
