"use client";

import {
  ChartColumnIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  GlobeIcon,
  IdCardIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  QrCodeIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VisitingCardDialog } from "@/components/card/visiting-card-dialog";
import { ReviewBannerDialog } from "@/components/review/review-banner-dialog";
import { ReviewQrDialog } from "@/components/review/review-qr-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClientView } from "@/lib/data";
import { reviewUrl } from "@/lib/review-link";
import { REVIEW_MESSAGES, type ReviewMessageKey } from "@/lib/review-message";
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

// The shortcuts on a client's Overview tab: review kit, visiting card, Google profile, website and Umami.
export function ClientActions({
  client,
  umamiUrl,
}: {
  client: ClientView;
  // This client's website in the Umami app, or null when there is none to open.
  umamiUrl: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"qr" | "banner" | "card" | null>(null);
  // which link or review request message was just copied
  const [copied, setCopied] = useState<CopyTarget | ReviewMessageKey | null>(null);
  const [error, setError] = useState("");
  const reviewLink = reviewUrl(client);

  async function copy(link: CopyTarget) {
    setError("");
    try {
      // the review link is the client's own (/review/<business-name>), which counts who opens it
      await navigator.clipboard.writeText(link === "profile" ? client.url : reviewLink);
    } catch {
      setError(`Could not copy the ${link} link.`);
      return;
    }
    setCopied(link);
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyMessage(key: ReviewMessageKey, text: string) {
    setError("");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Could not copy the review request message.");
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* most used first: looking things up, then sharing links, then the make-once print kit */}
      <div className="flex flex-wrap gap-2">
        {client.hasGoogleProfile && (
          <LinkButton href={client.url}>
            <MapPinIcon />
            Open Google profile
          </LinkButton>
        )}
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
        {client.hasGoogleProfile && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!client.googleReviewUrl}
              onClick={() => copy("review")}
            >
              {copied === "review" ? <CheckIcon /> : <CopyIcon />}
              {copied === "review" ? "Review link copied" : "Copy review link"}
            </Button>
            {/* a review request to paste into a chat: three wordings, each ending in the review link */}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={!reviewLink} />}>
                <MessageCircleIcon />
                Copy review message
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                {REVIEW_MESSAGES.map((message) => {
                  const text = message.text(client.name, reviewLink);
                  return (
                    // stays open so the "copied" state is seen
                    <DropdownMenuItem
                      key={message.key}
                      closeOnClick={false}
                      className="items-start py-1.5"
                      onClick={() => copyMessage(message.key, text)}
                    >
                      {copied === message.key ? <CheckIcon className="mt-0.5" /> : <CopyIcon className="mt-0.5" />}
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {copied === message.key ? "Message copied" : message.label}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{text}</span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
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
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => setDialog("card")}>
          <IdCardIcon />
          Visiting card
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
      <VisitingCardDialog client={dialog === "card" ? client : null} onClose={() => setDialog(null)} />
    </div>
  );
}
