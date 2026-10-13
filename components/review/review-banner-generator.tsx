"use client";

import { DownloadIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Choices, Field } from "@/components/review/controls";
import {
  BANNER_SIZES,
  BANNER_TEMPLATES,
  DEFAULT_ACCENT,
  DEFAULT_BANNER_CONTENT,
  POWERED_BY,
  ReviewBanner,
  type BannerContent,
  type BannerSize,
  type BannerTemplate,
} from "@/components/review/review-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HEX_COLOR } from "@/lib/color";
import { qrMatrix } from "@/lib/qr";
import { downloadPng, downloadSvg, slugify } from "@/lib/svg-export";

const SIZES = BANNER_SIZES.map((size) => ({ value: size.id, label: size.name }));

// Short limits on purpose: the banner shrinks text to fit, and long lines end up too small to read.
const WORDING = [
  { key: "eyebrow", label: "Line above the headline", maxLength: 28 },
  { key: "headline", label: "Headline", maxLength: 12 },
  { key: "instruction", label: "Scan instruction", maxLength: 40 },
  { key: "message", label: "Message", maxLength: 80 },
] as const;

function isHttpUrl(value: string) {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Builds a printable review banner for one business: pick a template, adjust the wording, download.
export function ReviewBannerGenerator({
  defaultBusinessName = "",
  defaultReviewUrl = "",
}: {
  defaultBusinessName?: string;
  defaultReviewUrl?: string;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [template, setTemplate] = useState<BannerTemplate>("paper");
  const [url, setUrl] = useState(defaultReviewUrl);
  const [content, setContent] = useState<BannerContent>({
    ...DEFAULT_BANNER_CONTENT,
    businessName: defaultBusinessName,
  });
  const [size, setSize] = useState<BannerSize>("a4");
  const [google, setGoogle] = useState(true);
  // the colour the banner is drawn in, and what is typed in the hex box (which can be half a code)
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [accentText, setAccentText] = useState(DEFAULT_ACCENT);
  const [poweredBy, setPoweredBy] = useState(true);
  const [error, setError] = useState("");

  const link = url.trim();
  const validLink = isHttpUrl(link);
  // Level Q: a printed sheet gets creased and scuffed.
  const matrix = useMemo(() => (validLink ? qrMatrix(link, "Q") : null), [link, validLink]);
  // Shown on the banner while the name is still empty, so the layout can be judged.
  const shown = { ...content, businessName: content.businessName.trim() || "Business name" };

  function set(key: keyof BannerContent, value: string) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  // The banner only follows the box once it holds a whole hex code.
  function typeAccent(text: string) {
    setAccentText(text);
    if (HEX_COLOR.test(text)) setAccent(text.toUpperCase());
  }

  async function download(format: "png" | "svg") {
    if (!svg.current) return;
    setError("");
    const filename = `${slugify(content.businessName) || "review"}-banner-${template}-${size}.${format}`;
    const pngWidth = BANNER_SIZES.find((option) => option.id === size)?.pngWidth ?? 2480;
    try {
      if (format === "svg") downloadSvg(svg.current, filename);
      else await downloadPng(svg.current, filename, pngWidth);
    } catch {
      setError("Download failed. Try the other format.");
    }
  }

  const ready = Boolean(matrix && content.businessName.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review banner</CardTitle>
        <CardDescription>
          A printable sheet that asks customers for a review. The code opens the review link.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-5">
          <Field label="Business name" htmlFor={`${id}-name`}>
            <Input
              id={`${id}-name`}
              maxLength={60}
              placeholder="OK Auto"
              value={content.businessName}
              onChange={(event) => set("businessName", event.target.value)}
            />
          </Field>
          <Field
            label="Review link"
            htmlFor={`${id}-url`}
            help={
              link && !validLink
                ? "That is not a full link. It should start with https://"
                : "The code on the banner opens this link."
            }
          >
            <Input
              id={`${id}-url`}
              type="url"
              inputMode="url"
              maxLength={500}
              placeholder="https://g.page/r/xxxxxxxxxxxx/review"
              aria-describedby={`${id}-url-help`}
              aria-invalid={Boolean(link) && !validLink}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>

          <Choices label="Size" name={`${id}-size`} options={SIZES} value={size} onChange={setSize} />

          <Field
            label="Accent colour"
            htmlFor={`${id}-accent`}
            help="The client's brand colour. Pale colours get dark text on top."
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick the accent colour"
                className="size-8 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
                value={accent.toLowerCase()}
                onChange={(event) => typeAccent(event.target.value)}
              />
              <Input
                id={`${id}-accent`}
                maxLength={7}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder={DEFAULT_ACCENT}
                aria-describedby={`${id}-accent-help`}
                aria-invalid={!HEX_COLOR.test(accentText)}
                className="w-28 font-mono"
                value={accentText}
                onChange={(event) => typeAccent(event.target.value.trim())}
                onBlur={() => setAccentText(accent)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={accent === DEFAULT_ACCENT && accentText === DEFAULT_ACCENT}
                onClick={() => typeAccent(DEFAULT_ACCENT)}
              >
                Reset
              </Button>
            </div>
          </Field>

          <div role="radiogroup" aria-label="Template" className="flex flex-col gap-2">
            <div className="text-sm leading-none font-medium">Template</div>
            <div className="grid grid-cols-3 gap-3">
              {BANNER_TEMPLATES.map((option) => (
                <Label
                  key={option.id}
                  title={option.description}
                  className="flex-col items-stretch gap-2 rounded-xl border border-input p-2 font-normal has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input
                    type="radio"
                    name={`${id}-template`}
                    value={option.id}
                    checked={option.id === template}
                    onChange={() => setTemplate(option.id)}
                    className="sr-only"
                  />
                  <ReviewBanner
                    template={option.id}
                    content={shown}
                    matrix={matrix}
                    accent={accent}
                    poweredBy={poweredBy}
                    google={google}
                    size={size}
                    aria-hidden="true"
                    className="h-auto w-full rounded-md ring-1 ring-foreground/10"
                  />
                  <span className="text-center">{option.name}</span>
                </Label>
              ))}
            </div>
          </div>

          {WORDING.map((field) => (
            <Field key={field.key} label={field.label} htmlFor={`${id}-${field.key}`}>
              <Input
                id={`${id}-${field.key}`}
                maxLength={field.maxLength}
                value={content[field.key]}
                onChange={(event) => set(field.key, event.target.value)}
              />
            </Field>
          ))}
          <Label className="items-start gap-2.5 leading-normal">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={google}
              onChange={(event) => setGoogle(event.target.checked)}
            />
            <span>
              Show the Google mark
              <span className="block text-xs font-normal text-muted-foreground">
                Untick when the link goes somewhere other than Google reviews.
              </span>
            </span>
          </Label>
          <Label className="items-start gap-2.5 leading-normal">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={poweredBy}
              onChange={(event) => setPoweredBy(event.target.checked)}
            />
            <span>
              Show “Powered by {POWERED_BY}”
              <span className="block text-xs font-normal text-muted-foreground">
                Our credit, in small print at the foot of the banner.
              </span>
            </span>
          </Label>
        </div>

        <div className="flex flex-col gap-3 self-start lg:sticky lg:top-20">
          <ReviewBanner
            ref={svg}
            template={template}
            content={shown}
            matrix={matrix}
            accent={accent}
            poweredBy={poweredBy}
            google={google}
            size={size}
            className="h-auto w-full rounded-lg ring-1 ring-foreground/10"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!ready} onClick={() => download("png")}>
              <DownloadIcon />
              PNG
            </Button>
            <Button variant="outline" disabled={!ready} onClick={() => download("svg")}>
              <DownloadIcon />
              SVG
            </Button>
          </div>
          <p role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
            {error ||
              (ready
                ? "PNG is print quality, 300 dpi at the size picked. SVG stays editable."
                : "Add the business name and review link to download.")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
