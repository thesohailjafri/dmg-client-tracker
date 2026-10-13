import { ReviewQr } from "@/components/review/review-qr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientView } from "@/lib/data";
import { reviewUrl } from "@/lib/review-link";
import type { Directory } from "@/lib/schemas";

// Everything about a client that its read-only link may show: what is already public about the
// business, and nothing the team keeps to itself (recipients, contacts, IDs, schedules, run status).
// The Overview below takes only this, so a field added to the client later cannot reach the page
// without being added here on purpose.
export type SharedDetails = {
  name: string;
  websiteUrl: string;
  // "" for a business with no Google profile, as are the two review links below
  mapsUrl: string;
  // The client's own review link (/review/<business-name>), to share and to print as a QR code.
  // "" when no Google review link is saved.
  reviewUrl: string;
  reviewQrUrl: string;
  directories: Directory[];
};

export function sharedDetails(client: ClientView): SharedDetails {
  return {
    name: client.name,
    websiteUrl: client.websiteUrl,
    mapsUrl: client.url,
    reviewUrl: reviewUrl(client),
    reviewQrUrl: reviewUrl(client, "qr"),
    directories: client.directories.map(({ name, url }) => ({ name, url })),
  };
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">
      {href}
    </a>
  );
}

// The Overview tab of the client's read-only link: their business details as the team has them.
// Whatever is not saved is left out instead of shown as missing.
export function ShareOverview({ details }: { details: SharedDetails }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your business</CardTitle>
          <CardDescription>The details we have on file for your business.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail label="Business name">{details.name}</Detail>
            {details.websiteUrl && (
              <Detail label="Website">
                <ExternalLink href={details.websiteUrl} />
              </Detail>
            )}
            {details.mapsUrl && (
              <Detail label="Google Business Profile">
                <ExternalLink href={details.mapsUrl} />
              </Detail>
            )}
            {details.reviewUrl && (
              <Detail label="Your review link">
                <ExternalLink href={details.reviewUrl} />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Share it with your customers. It opens your Google review page.
                </span>
              </Detail>
            )}
          </dl>
        </CardContent>
      </Card>

      {details.reviewUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Review QR code</CardTitle>
            <CardDescription>
              Customers scan it to leave you a Google review. Print it for your counter, receipts or
              business cards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewQr link={details.reviewQrUrl} name={details.name} />
          </CardContent>
        </Card>
      )}

      {details.directories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Where you are listed</CardTitle>
            <CardDescription>
              Your business&apos;s pages on public directories{details.mapsUrl && ", besides Google"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {details.directories.map((directory, index) => (
                <li
                  key={index}
                  className="flex items-baseline gap-4 py-2 text-sm first:pt-0 last:pb-0 max-sm:flex-col max-sm:gap-0.5"
                >
                  <span className="w-40 shrink-0 truncate font-medium max-sm:w-full">{directory.name}</span>
                  <a
                    href={directory.url}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-full min-w-0 truncate text-primary hover:underline"
                  >
                    {directory.url}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
