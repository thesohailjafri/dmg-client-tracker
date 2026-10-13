"use client";

import { DownloadIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CARD_BACKS,
  CARD_FRONTS,
  CARD_SIZES,
  cardCodeMm,
  cardPngWidth,
  cardViewBox,
  DEFAULT_CARD_ACCENT,
  VisitingCard,
  type CardBack,
  type CardCode,
  type CardContent,
  type CardFront,
  type CardLogo,
  type CardSize,
} from "@/components/card/visiting-card";
import { Choices, Field } from "@/components/review/controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent as CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARD_QR_LIMIT, CARD_QR_TYPES, cardLinks, type CardQrType } from "@/lib/card-links";
import { HEX_COLOR } from "@/lib/color";
import type { ClientView } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { qrMatrix } from "@/lib/qr";
import { reviewUrl } from "@/lib/review-link";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/schemas";
import { downloadPng, downloadSvg, slugify } from "@/lib/svg-export";

const SIZES = CARD_SIZES.map((size) => ({ value: size.id, label: size.name }));

// Short limits on purpose: the card shrinks text to fit, and long lines end up too small to read.
const DETAILS = [
  { key: "businessName", label: "Business name", maxLength: 60, placeholder: "OK Auto" },
  { key: "tagline", label: "Tagline", maxLength: 40, placeholder: "Car service & repair" },
  { key: "phone", label: "Phone", maxLength: 24, placeholder: "+91 98765 43210" },
  { key: "email", label: "Email", maxLength: 50, placeholder: "hello@okauto.in" },
  { key: "website", label: "Website", maxLength: 40, placeholder: "www.okauto.in" },
  { key: "address", label: "Address", maxLength: 90, placeholder: "14 MG Road, Andheri West, Mumbai 400058" },
  { key: "personName", label: "Person's name", maxLength: 40, placeholder: "Rahul Sharma" },
  { key: "jobTitle", label: "Job title", maxLength: 40, placeholder: "Owner" },
] as const;

// Under this many mm across, a printed code gets hard for a phone to read.
const SMALL_CODE_MM = 15;

// "https://www.okauto.in/" -> "www.okauto.in", the way it reads on a card.
function printedWebsite(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

// An image file as the card needs it: inlined, with its shape.
async function readLogo(file: Blob): Promise<CardLogo> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read the image."));
    image.src = src;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Could not read the image.");
  return { src, ratio: image.naturalWidth / image.naturalHeight };
}

// Builds a printable visiting card for one client: a front and a back, each downloaded on its own.
export function VisitingCardGenerator({ client }: { client: ClientView }) {
  const id = useId();
  const frontSvg = useRef<SVGSVGElement>(null);
  const backSvg = useRef<SVGSVGElement>(null);
  const [content, setContent] = useState<CardContent>({
    businessName: client.name,
    tagline: "",
    personName: "",
    jobTitle: "",
    phone: formatPhone(client.businessPhone),
    email: client.businessEmail,
    website: printedWebsite(client.websiteUrl),
    address: client.address,
  });
  const [logo, setLogo] = useState<CardLogo | null>(null);
  const [logoError, setLogoError] = useState("");
  const [front, setFront] = useState<CardFront>("F1");
  const [back, setBack] = useState<CardBack>("B1");
  const [size, setSize] = useState<CardSize>("us");
  const [bleed, setBleed] = useState(true);
  // the colour the card is drawn in, and what is typed in the hex box (which can be half a code)
  const [accent, setAccent] = useState(DEFAULT_CARD_ACCENT);
  const [accentText, setAccentText] = useState(DEFAULT_CARD_ACCENT);
  const [error, setError] = useState("");

  // The client's saved logo, fetched once and inlined so a downloaded card carries it.
  useEffect(() => {
    if (!client.logoUrl) return;
    let current = true;
    fetch(client.logoUrl)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("no logo"))))
      .then(readLogo)
      .then((saved) => current && setLogo(saved))
      .catch(() => current && setLogoError("Could not load the saved logo. Choose the file again to use it."));
    return () => {
      current = false;
    };
  }, [client.logoUrl]);

  // What each code would hold. Only the review code goes through our own link, which counts the scan.
  const links = useMemo(
    () => cardLinks({ ...content, reviewUrl: reviewUrl(client, "qr"), mapsUrl: client.url }),
    [content, client],
  );
  // Starts on the two a card is most often scanned for, where the client has them.
  const [types, setTypes] = useState<CardQrType[]>(() => {
    const preferred = (["review", "call"] as const).filter((type) => links[type]);
    return preferred.length > 0 ? preferred : ["maps"];
  });
  // Ticked and still possible: a code whose detail was cleared drops off the card without being unticked.
  const codes = useMemo(
    () =>
      CARD_QR_TYPES.flatMap(({ id: type }): CardCode[] => {
        if (!types.includes(type) || !links[type]) return [];
        // Level Q: a card gets creased and scuffed. The contact card holds too much for that, so
        // it gives some of it up to stay coarse enough to scan.
        const matrix = qrMatrix(links[type], type === "vcard" ? "M" : "Q");
        return matrix ? [{ type, matrix }] : [];
      }),
    [types, links],
  );
  const codeMm = cardCodeMm(back, codes.length, size);

  // Shown on the card while the name is still empty, so the layout can be judged.
  const shown: CardContent = {
    businessName: content.businessName.trim() || "Business name",
    tagline: content.tagline.trim(),
    personName: content.personName.trim(),
    jobTitle: content.jobTitle.trim(),
    phone: content.phone.trim(),
    email: content.email.trim(),
    website: content.website.trim(),
    address: content.address.trim(),
  };
  const paper = CARD_SIZES.find((option) => option.id === size) ?? CARD_SIZES[0];
  const ready = Boolean(content.businessName.trim());

  function set(key: keyof CardContent, value: string) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  // The card only follows the box once it holds a whole hex code.
  function typeAccent(text: string) {
    setAccentText(text);
    if (HEX_COLOR.test(text)) setAccent(text.toUpperCase());
  }

  async function chooseLogo(file: File | undefined) {
    if (!file) return;
    setLogoError("");
    if (!(file.type in LOGO_TYPES)) return setLogoError("The logo has to be a PNG, JPG or WebP image.");
    if (file.size > LOGO_MAX_BYTES) return setLogoError("The logo is over 2 MB. Use a smaller file.");
    try {
      setLogo(await readLogo(file));
    } catch {
      setLogoError("Could not read that image. Try another file.");
    }
  }

  async function download(side: "front" | "back", format: "png" | "svg") {
    const svg = side === "front" ? frontSvg.current : backSvg.current;
    if (!svg) return;
    setError("");
    const code = (side === "front" ? front : back).toLowerCase();
    const filename = `${slugify(content.businessName) || "business"}-visiting-card-${code}-${side}.${format}`;
    // the preview shows the card as it is cut; the file adds the margin the printer trims off
    const file = svg.cloneNode(true) as SVGSVGElement;
    file.setAttribute("viewBox", cardViewBox(size, bleed));
    try {
      if (format === "svg") downloadSvg(file, filename);
      else await downloadPng(file, filename, cardPngWidth(size, bleed));
    } catch {
      setError("Download failed. Try the other format.");
    }
  }

  const card = { content: shown, logo, accent, size };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visiting card</CardTitle>
        <CardDescription>
          A front with the business&apos;s details and a back with its QR codes, each downloaded as its own
          file for the printer.
        </CardDescription>
      </CardHeader>
      <CardBody className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-5">
          <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
            {DETAILS.map((field) => (
              <div key={field.key} className={field.key === "address" ? "sm:col-span-2" : undefined}>
                <Field label={field.label} htmlFor={`${id}-${field.key}`}>
                  <Input
                    id={`${id}-${field.key}`}
                    maxLength={field.maxLength}
                    placeholder={field.placeholder}
                    value={content[field.key]}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                </Field>
              </div>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Anything left empty stays off the card. With a person&apos;s name on it, their name and job
            title take the tagline&apos;s place.
          </p>

          <Field
            label="Logo"
            htmlFor={`${id}-logo`}
            help={
              client.logoUrl
                ? "Starts as the logo saved on the client. Another file is used for this card only."
                : "Used for this card only. Save a logo on the client's Edit tab to keep it. Without one the card shows the business's initials."
            }
          >
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-logo`}
                type="file"
                accept={Object.keys(LOGO_TYPES).join(",")}
                aria-describedby={`${id}-logo-help`}
                className="min-w-0 flex-1"
                onChange={(event) => chooseLogo(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={!logo}
                onClick={() => setLogo(null)}
              >
                Remove
              </Button>
            </div>
            {logoError && (
              <p role="alert" className="text-xs text-destructive">
                {logoError}
              </p>
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <Choices label="Print size" name={`${id}-size`} options={SIZES} value={size} onChange={setSize} />
            <p className="text-xs text-muted-foreground">
              {paper.name} is the usual size in {paper.where}. A printer elsewhere may want another: ask
              before a big run.
            </p>
          </div>
          <Label className="items-start gap-2.5 leading-normal">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={bleed}
              onChange={(event) => setBleed(event.target.checked)}
            />
            <span>
              Add bleed for the printer
              <span className="block text-xs font-normal text-muted-foreground">
                The file gets {paper.bleed} mm of extra background on every side, which the printer trims
                off. Untick for a file at the exact card size.
              </span>
            </span>
          </Label>

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
                placeholder={DEFAULT_CARD_ACCENT}
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
                disabled={accent === DEFAULT_CARD_ACCENT && accentText === DEFAULT_CARD_ACCENT}
                onClick={() => typeAccent(DEFAULT_CARD_ACCENT)}
              >
                Reset
              </Button>
            </div>
          </Field>

          <TemplatePicker
            label="Front"
            name={`${id}-front`}
            columns="grid-cols-2 sm:grid-cols-5"
            options={CARD_FRONTS}
            value={front}
            onChange={setFront}
            card={card}
          />

          <div role="group" aria-labelledby={`${id}-codes`} className="flex flex-col gap-2">
            <div id={`${id}-codes`} className="text-sm leading-none font-medium">
              QR codes on the back
            </div>
            <div className="flex flex-wrap gap-2">
              {CARD_QR_TYPES.map((option) => {
                const possible = Boolean(links[option.id]);
                const ticked = possible && types.includes(option.id);
                return (
                  <Label
                    key={option.id}
                    title={possible ? undefined : `Needs ${option.needs}`}
                    className="h-8 rounded-lg border border-input px-3 font-normal has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary has-disabled:opacity-50"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={ticked}
                      disabled={!possible || (!ticked && codes.length >= CARD_QR_LIMIT)}
                      onChange={(event) =>
                        setTypes((list) =>
                          event.target.checked ? [...list, option.id] : list.filter((type) => type !== option.id),
                        )
                      }
                    />
                    {option.label}
                  </Label>
                );
              })}
            </div>
            <p className={codes.length > 0 && codeMm < SMALL_CODE_MM ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {codes.length === 0
                ? "No codes ticked: the back is the logo alone."
                : codeMm < SMALL_CODE_MM
                  ? `Each code prints ${codeMm} mm wide on this back, which is small to scan. Tick fewer, or pick another back.`
                  : `Each code prints ${codeMm} mm wide. Up to ${CARD_QR_LIMIT} fit; only the Google review code counts its scans. A greyed-out code needs its detail filled in above.`}
            </p>
          </div>

          <TemplatePicker
            label="Back"
            name={`${id}-back`}
            columns="grid-cols-2 sm:grid-cols-3"
            options={CARD_BACKS}
            value={back}
            onChange={setBack}
            card={{ ...card, codes }}
          />
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-6">
          {(
            [
              { side: "front", template: front, ref: frontSvg },
              { side: "back", template: back, ref: backSvg },
            ] as const
          ).map(({ side, template, ref }) => (
            <div key={side} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-sm font-medium capitalize">
                {side}
                <span className="font-mono text-xs font-normal text-muted-foreground">{template}</span>
              </div>
              <VisitingCard
                ref={ref}
                template={template}
                {...card}
                codes={codes}
                className="h-auto w-full rounded-md ring-1 ring-foreground/10"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" disabled={!ready} onClick={() => download(side, "png")}>
                  <DownloadIcon />
                  PNG
                </Button>
                <Button size="sm" variant="outline" disabled={!ready} onClick={() => download(side, "svg")}>
                  <DownloadIcon />
                  SVG
                </Button>
              </div>
            </div>
          ))}
          <p role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
            {error ||
              (ready
                ? `PNG is print quality, 600 dpi at ${paper.name}${bleed ? " plus bleed" : ""}. SVG stays editable. The preview shows the card as it is cut.`
                : "Add the business name to download.")}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

// Pick-one grid of card faces, each drawn with the card's own details.
function TemplatePicker<T extends CardFront | CardBack>({
  label,
  name,
  columns,
  options,
  value,
  onChange,
  card,
}: {
  label: string;
  name: string;
  // Tailwind grid-cols classes.
  columns: string;
  options: readonly { id: T; name: string }[];
  value: T;
  onChange: (value: T) => void;
  card: Omit<React.ComponentProps<typeof VisitingCard>, "template">;
}) {
  return (
    <div role="radiogroup" aria-label={`${label} template`} className="flex flex-col gap-2">
      <div className="text-sm leading-none font-medium">{label}</div>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((option) => (
          <Label
            key={option.id}
            className="flex-col items-stretch gap-1.5 rounded-xl border border-input p-1.5 text-xs font-normal has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            <VisitingCard
              {...card}
              template={option.id}
              aria-hidden="true"
              className="h-auto w-full rounded ring-1 ring-foreground/10"
            />
            <span className="text-center">
              {option.id} {option.name}
            </span>
          </Label>
        ))}
      </div>
    </div>
  );
}
