import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Graphs } from "@/components/graphs";
import { Loader } from "@/components/loader";
import { Logo } from "@/components/logo";
import { getSharedClient } from "@/lib/data";
import { loadGraphs } from "@/lib/graph-data";
import { parseRange, sharePath } from "@/lib/graphs";

// A client's read-only graphs, opened from a link the team sends them. No sign-in: proxy.ts lets
// /share/ through and the token in the address is the permission. The business name before it is
// only there to make the link recognisable: it is never used to find the client, and an out-of-date
// one is redirected to the current name. Only graphs are rendered here, so nothing else about the
// client (emails, contacts, notes) can reach the page.

// Nothing about the client goes in the tab title: it shows before the token has been checked.
export const metadata: Metadata = { title: "Growth graphs", referrer: "no-referrer" };

const AGENCY = process.env.AGENCY_NAME || "DMG";
const AGENCY_URL = "https://domoregrowth.com";
const AGENCY_EMAIL = "team@domoregrowth.com";

export default function SharePage({ params, searchParams }: PageProps<"/share/[slug]/[token]">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 max-sm:px-4">
      <Suspense fallback={<Loader className="pt-24" />}>
        {Promise.all([params, searchParams]).then(([{ slug, token }, query]) => (
          <Shared slug={slug} token={token} range={query.range} />
        ))}
      </Suspense>
    </div>
  );
}

async function Shared({ slug, token, range }: { slug: string; token: string; range: unknown }) {
  // Live data on every visit, never a prerender.
  await connection();
  const client = await getSharedClient(token);

  // A link sent before the business was renamed still opens: the token finds the client, and the
  // address moves on to the current name.
  const path = client && sharePath(client.name, token);
  if (path && path !== `/share/${slug}/${token}`) {
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

  const data = await loadGraphs(client, parseRange(range));
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
        <p className="mt-1 text-sm text-muted-foreground">How your website and Google profile are growing.</p>
      </header>
      <main className="flex flex-col gap-8">
        <Graphs data={data} basePath={sharePath(client.name, token)} audience="client" />      </main>
    </>
  );
}
