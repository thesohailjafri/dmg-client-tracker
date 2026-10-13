"use client";

import {
  ChartColumnIcon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  MapPinIcon,
  MegaphoneIcon,
  QrCodeIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReviewBannerDialog } from "@/components/review/review-banner-dialog";
import { ReviewQrDialog } from "@/components/review/review-qr-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ClientView } from "@/lib/data";
import { reviewUrl } from "@/lib/review-link";
import { cn } from "@/lib/utils";

type CopyTarget = "profile" | "review";

// A link that opens in a new tab and looks like the buttons beside it. `cn` matters here: the
// variant classes alone leave the base transparent border on top of the outline one.
function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      {children}
    </a>
  );
}

// The shortcuts on a client's Overview tab: review kit, Google profile, website and Umami.
export function ClientActions({
  client,
  umamiUrl,
}: {
  client: ClientView;
  // This client's website in the Umami app, or null when there is none to open.
  umamiUrl: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"qr" | "banner" | null>(null);
  // which link was just copied
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [error, setError] = useState("");

  async function copy(link: CopyTarget) {
    setError("");
    try {
      // the review link is the client's own (/review/<business-name>), which counts who opens it
      await navigator.clipboard.writeText(link === "profile" ? client.url : reviewUrl(client));
    } catch {
      setError(`Could not copy the ${link} link.`);
      return;
    }
    setCopied(link);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* most used first: looking things up, then sharing links, then the make-once review kit */}
      <div className="flex flex-wrap gap-2">
        <LinkButton href={client.url}>
          <MapPinIcon />
          Open Google profile
        </LinkButton>
        {client.websiteUrl ? (
          <LinkButton href={client.websiteUrl}>
            <GlobeIcon />
            Open website
          </LinkButton>
        ) : (
          <Button variant="outline" size="sm" disabled title="No website is saved for this client.">
            <GlobeIcon />
            Open website
          </Button>
        )}
        {umamiUrl ? (
          <LinkButton href={umamiUrl}>
            <ChartColumnIcon />
            Open Umami analytics
          </LinkButton>
        ) : (
          <Button variant="outline" size="sm" disabled title="No Umami website is connected for this client.">
            <ChartColumnIcon />
            Open Umami analytics
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={!client.googleReviewUrl}
          onClick={() => copy("review")}
        >
          {copied === "review" ? <CheckIcon /> : <CopyIcon />}
          {copied === "review" ? "Review link copied" : "Copy review link"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => copy("profile")}>
          {copied === "profile" ? <CheckIcon /> : <CopyIcon />}
          {copied === "profile" ? "Profile link copied" : "Copy Google profile link"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("qr")}>
          <QrCodeIcon />
          Review QR code
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("banner")}>
          <MegaphoneIcon />
          Review request banner
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <ReviewQrDialog
        client={dialog === "qr" ? client : null}
        onClose={() => setDialog(null)}
        onEdit={() => router.push(`/clients/${client.id}/edit`)}
      />
      <ReviewBannerDialog
        client={dialog === "banner" ? client : null}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
