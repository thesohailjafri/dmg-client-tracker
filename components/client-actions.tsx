"use client";

import { ChartColumnIcon, CheckIcon, CopyIcon, MapPinIcon, MegaphoneIcon, QrCodeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReviewBannerDialog } from "@/components/review/review-banner-dialog";
import { ReviewQrDialog } from "@/components/review/review-qr-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ClientView } from "@/lib/data";
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

// The shortcuts on a client's Overview tab: review kit, Google profile and Umami.
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
      await navigator.clipboard.writeText(link === "profile" ? client.url : client.googleReviewUrl);
    } catch {
      setError(`Could not copy the ${link} link.`);
      return;
    }
    setCopied(link);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog("qr")}>
          <QrCodeIcon />
          Review QR code
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("banner")}>
          <MegaphoneIcon />
          Review request banner
        </Button>
        <LinkButton href={client.url}>
          <MapPinIcon />
          Open Google profile
        </LinkButton>
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
        <Button variant="outline" size="sm" onClick={() => copy("profile")}>
          {copied === "profile" ? <CheckIcon /> : <CopyIcon />}
          {copied === "profile" ? "Profile link copied" : "Copy Google profile link"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!client.googleReviewUrl}
          onClick={() => copy("review")}
        >
          {copied === "review" ? <CheckIcon /> : <CopyIcon />}
          {copied === "review" ? "Review link copied" : "Copy Google review link"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {/* the review link is edited in Settings, where the client form lives */}
      <ReviewQrDialog
        client={dialog === "qr" ? client : null}
        onClose={() => setDialog(null)}
        onEdit={() => router.push("/settings")}
      />
      <ReviewBannerDialog
        client={dialog === "banner" ? client : null}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
