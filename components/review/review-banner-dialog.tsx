"use client";

import { ReviewBannerGenerator } from "@/components/review/review-banner-generator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ClientView } from "@/lib/data";
import { reviewUrl } from "@/lib/review-link";

// The banner generator, filled in for one client. Open while `client` is set.
export function ReviewBannerDialog({
  client,
  onClose,
}: {
  client: ClientView | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={client !== null} onOpenChange={(open) => !open && onClose()}>
      {/* the generator brings its own card; inside the dialog it loses the frame and fills the popup */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-5xl *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0">
        <DialogTitle className="sr-only">Review request banner for {client?.name}</DialogTitle>
        {client && (
          <ReviewBannerGenerator
            key={client.id}
            defaultBusinessName={client.name}
            // the client's own link, so a scan off the banner is counted
            defaultReviewUrl={reviewUrl(client, "qr")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
