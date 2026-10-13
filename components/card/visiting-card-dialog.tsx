"use client";

import { VisitingCardGenerator } from "@/components/card/visiting-card-generator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ClientView } from "@/lib/data";

// The visiting card generator, filled in for one client. Open while `client` is set.
export function VisitingCardDialog({
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
        <DialogTitle className="sr-only">Visiting card for {client?.name}</DialogTitle>
        {client && <VisitingCardGenerator key={client.id} client={client} />}
      </DialogContent>
    </Dialog>
  );
}
