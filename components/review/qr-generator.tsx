"use client";

import { DownloadIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Choices, Field } from "@/components/review/controls";
import { QrCode, type QrStyle } from "@/components/review/qr-code";
import { DEFAULT_ACCENT } from "@/components/review/review-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { darkEnough } from "@/lib/color";
import { qrMatrix, type QrLevel } from "@/lib/qr";
import { downloadPng, downloadSvg } from "@/lib/svg-export";

const STYLES = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dots", label: "Dots" },
] as const satisfies readonly { value: QrStyle; label: string }[];

const BLACK = "#000000";

// Black plus the accent colour, darkened where needed so the code still scans on white.
function colorOptions(accent: string) {
  const plain = darkEnough(accent, 4.5);
  const dark = darkEnough(accent, 9);
  return [
    { value: BLACK, label: "Black", swatch: BLACK },
    { value: plain, label: "Accent", swatch: plain },
    // an accent that is already dark needs no second shade
    ...(dark === plain ? [] : [{ value: dark, label: "Accent dark", swatch: dark }]),
  ];
}

const LEVELS = [
  { value: "M", label: "Standard" },
  { value: "Q", label: "High" },
  { value: "H", label: "Highest" },
] as const satisfies readonly { value: QrLevel; label: string }[];

// Pixel width of the downloaded PNG.
const PNG_SIZE = 1024;

// Turns a link (or any text) into a QR code that can be downloaded on its own.
export function QrGenerator({
  defaultValue = "",
  // Downloaded file name, without the extension.
  filename = "qr-code",
  // The client's brand colour, offered next to black.
  accent = DEFAULT_ACCENT,
}: {
  defaultValue?: string;
  filename?: string;
  accent?: string;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [style, setStyle] = useState<QrStyle>("square");
  const [color, setColor] = useState(BLACK);
  const [level, setLevel] = useState<QrLevel>("M");
  const [error, setError] = useState("");

  const text = value.trim();
  const matrix = useMemo(() => qrMatrix(text, level), [text, level]);
  const colors = useMemo(() => colorOptions(accent), [accent]);

  async function download(format: "png" | "svg") {
    if (!svg.current) return;
    setError("");
    try {
      if (format === "svg") downloadSvg(svg.current, `${filename}.svg`);
      else await downloadPng(svg.current, `${filename}.png`, PNG_SIZE);
    } catch {
      setError("Download failed. Try the other format.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>QR code</CardTitle>
        <CardDescription>A code on its own, for anywhere the banner does not fit.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex flex-col gap-5">
          <Field
            label="Link or text"
            htmlFor={`${id}-value`}
            help="Scanning the code opens this. Usually the client's Google review link."
          >
            <Input
              id={`${id}-value`}
              type="url"
              inputMode="url"
              maxLength={1000}
              placeholder="https://g.page/r/xxxxxxxxxxxx/review"
              aria-describedby={`${id}-value-help`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <Choices label="Style" name={`${id}-style`} options={STYLES} value={style} onChange={setStyle} />
          <Choices label="Colour" name={`${id}-color`} options={colors} value={color} onChange={setColor} />
          <div className="flex flex-col gap-2">
            <Choices
              label="Error correction"
              name={`${id}-level`}
              options={LEVELS}
              value={level}
              onChange={setLevel}
            />
            <p className="text-xs text-muted-foreground">
              Higher survives more scuffs and creases, but makes a denser code.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {matrix ? (
            <QrCode
              ref={svg}
              matrix={matrix}
              style={style}
              color={color}
              aria-label={`QR code for ${text}`}
              className="aspect-square w-full rounded-lg ring-1 ring-foreground/10"
            />
          ) : (
            <p className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
              {text ? "That is too long for a QR code." : "Enter a link to see its code."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!matrix} onClick={() => download("png")}>
              <DownloadIcon />
              PNG
            </Button>
            <Button variant="outline" disabled={!matrix} onClick={() => download("svg")}>
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
      </CardContent>
    </Card>
  );
}
