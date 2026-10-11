"use client";

import { DownloadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { QrCode } from "@/components/review/qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClientView } from "@/lib/data";
import { qrMatrix } from "@/lib/qr";
import { downloadPng, downloadSvg, slugify } from "@/lib/svg-export";

// Pixel width of the downloaded PNG.
const PNG_SIZE = 1024;

// A client's Google review link as a QR code, ready to download. Open while `client` is set.
export function ReviewQrDialog({
  client,
  onClose,
  onEdit,
}: {
  client: ClientView | null;
  onClose: () => void;
  // Offered when the client has no review link yet.
  onEdit: (client: ClientView) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [error, setError] = useState("");

  const link = client?.googleReviewUrl ?? "";
  const matrix = useMemo(() => qrMatrix(link), [link]);

  async function download(format: "png" | "svg") {
    if (!svg.current || !client) return;
    setError("");
    const filename = `${slugify(client.name) || "client"}-review-qr`;
    try {
      if (format === "svg") downloadSvg(svg.current, `${filename}.svg`);
      else await downloadPng(svg.current, `${filename}.png`, PNG_SIZE);
    } catch {
      setError("Download failed. Try the other format.");
    }
  }

  function close() {
    setError("");
    onClose();
  }

  return (
    <Dialog open={client !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review QR code</DialogTitle>
          <DialogDescription>
            {link
              ? `Scanning it opens the Google review page for ${client?.name}.`
              : `${client?.name} has no Google review link yet.`}
          </DialogDescription>
        </DialogHeader>
        {matrix ? (
          <div className="flex flex-col gap-2">
            <QrCode
              ref={svg}
              matrix={matrix}
              aria-label={`QR code for ${link}`}
              className="aspect-square w-full rounded-lg ring-1 ring-foreground/10"
            />
            <p className="truncate text-center text-xs text-muted-foreground">{link}</p>
          </div>
        ) : (
          <p className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            {link ? "That link is too long for a QR code." : "Add the review link to get its QR code."}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          {matrix ? (
            <>
              <Button variant="outline" onClick={() => download("svg")}>
                <DownloadIcon />
                SVG
              </Button>
              <Button onClick={() => download("png")}>
                <DownloadIcon />
                Download PNG
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                if (!client) return;
                close();
                onEdit(client);
              }}
            >
              {link ? "Edit review link" : "Add review link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
