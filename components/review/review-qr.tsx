"use client";

import { DownloadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { QrCode } from "@/components/review/qr-code";
import { Button } from "@/components/ui/button";
import { qrMatrix } from "@/lib/qr";
import { downloadPng, downloadSvg, slugify } from "@/lib/svg-export";

// Pixel width of the downloaded PNG.
const PNG_SIZE = 1024;

// A Google review link as a QR code with its downloads, on the page itself. Takes the link and the
// business name and nothing else, so it can sit on the client's read-only link.
export function ReviewQr({ link, name }: { link: string; name: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [error, setError] = useState("");
  const matrix = useMemo(() => qrMatrix(link), [link]);

  async function download(format: "png" | "svg") {
    if (!svg.current) return;
    setError("");
    const filename = `${slugify(name) || "business"}-review-qr`;
    try {
      if (format === "svg") downloadSvg(svg.current, `${filename}.svg`);
      else await downloadPng(svg.current, `${filename}.png`, PNG_SIZE);
    } catch {
      setError("Download failed. Try the other format.");
    }
  }

  if (!matrix) {
    return <p className="text-sm text-muted-foreground">This review link is too long for a QR code.</p>;
  }

  return (
    <div className="flex w-full max-w-56 flex-col gap-3">
      <QrCode
        ref={svg}
        matrix={matrix}
        aria-label={`QR code for the Google review page of ${name}`}
        className="aspect-square w-full rounded-lg ring-1 ring-foreground/10"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => download("png")}>
          <DownloadIcon />
          PNG
        </Button>
        <Button variant="outline" onClick={() => download("svg")}>
          <DownloadIcon />
          SVG
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
