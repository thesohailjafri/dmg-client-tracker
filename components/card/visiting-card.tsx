import { useId } from "react";
import { QrMarks } from "@/components/review/qr-code";
import { BOLD, emWidth, fitLines, fitSize, wrapLines } from "@/components/svg-text";
import { CARD_QR_TYPES, type CardQrType } from "@/lib/card-links";
import { contrast, darkEnough, HEX_COLOR, mix } from "@/lib/color";
import type { QrMatrix } from "@/lib/qr";

// Every card is 1050 units wide, which is 300 to the inch on the US size; only the height changes
// with the paper. `bleed` is how far the printer wants the background to run past the cut, in mm.
export const CARD_WIDTH = 1050;
export const CARD_SIZES = [
  { id: "us", name: "3.5 × 2 in", where: "USA, Canada, India", width: 88.9, height: 50.8, bleed: 3.175 },
  { id: "90x55", name: "90 × 55 mm", where: "Australia, India", width: 90, height: 55, bleed: 3 },
  { id: "85x55", name: "85 × 55 mm", where: "Europe", width: 85, height: 55, bleed: 3 },
  { id: "90x50", name: "90 × 50 mm", where: "South Africa, parts of the Middle East", width: 90, height: 50, bleed: 3 },
] as const;

export type CardSize = (typeof CARD_SIZES)[number]["id"];

// Dots per inch of a downloaded PNG. Print asks for 300; the small type on a card is crisper at 600.
const PNG_DPI = 600;

function sizeOf(size: CardSize) {
  return CARD_SIZES.find((option) => option.id === size) ?? CARD_SIZES[0];
}

function cardHeight(size: CardSize) {
  const paper = sizeOf(size);
  return Math.round((CARD_WIDTH * paper.height) / paper.width);
}

// The part of the drawing a card shows: the card itself, or the card and the margin round it that
// a printer trims off.
export function cardViewBox(size: CardSize, bleed: boolean) {
  const paper = sizeOf(size);
  const margin = bleed ? +((CARD_WIDTH * paper.bleed) / paper.width).toFixed(2) : 0;
  return `${-margin} ${-margin} ${CARD_WIDTH + 2 * margin} ${cardHeight(size) + 2 * margin}`;
}

// Pixel width of the PNG that prints the card at its real size, bleed included when it has one.
export function cardPngWidth(size: CardSize, bleed: boolean) {
  const paper = sizeOf(size);
  return Math.round(((paper.width + (bleed ? 2 * paper.bleed : 0)) / 25.4) * PNG_DPI);
}

// A card is a pair: one front and one back, picked apart. The code is what a download is named by.
export const CARD_FRONTS = [
  { id: "F1", name: "Classic" },
  { id: "F2", name: "Split" },
  { id: "F3", name: "Centred" },
  { id: "F4", name: "Bold" },
  { id: "F5", name: "Arc" },
  { id: "F6", name: "Dark" },
  { id: "F7", name: "Slant" },
  { id: "F8", name: "Band" },
  { id: "F9", name: "Frame" },
  { id: "F10", name: "Header" },
] as const;
export const CARD_BACKS = [
  { id: "B1", name: "Row" },
  { id: "B2", name: "Bold" },
  { id: "B3", name: "Split" },
  { id: "B4", name: "Arc" },
  { id: "B5", name: "Dark" },
  { id: "B6", name: "Paper" },
] as const;

export type CardFront = (typeof CARD_FRONTS)[number]["id"];
export type CardBack = (typeof CARD_BACKS)[number]["id"];

export type CardContent = {
  businessName: string;
  // The line under the name. Left off when the card names a person.
  tagline: string;
  // Optional: a person and their job, for a card that is one person's.
  personName: string;
  jobTitle: string;
  // As printed. An empty one is left off the card.
  phone: string;
  email: string;
  website: string;
  address: string;
};

// The business's logo as a data URL (a downloaded card has nowhere to fetch it from), and its
// width over its height.
export type CardLogo = { src: string; ratio: number };

// One QR code on the back.
export type CardCode = { type: CardQrType; matrix: QrMatrix };

// The colour a card starts in: our own blue, same as --primary.
export const DEFAULT_CARD_ACCENT = "#0066FF";

// Literal colours, not CSS variables: a downloaded card has no stylesheet to resolve them.
const INK = "#16181D";
const PAPER = "#EEF1F6";
const WHITE = "#FFFFFF";
const GREY = "#5B6474";
const RULE = "#D9DEE8";
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif';

// How far backgrounds are drawn past the edge of the card, so there is colour under the bleed.
// More than the widest bleed (37.5 units on the US size).
const OVER = 40;

// The palette a template draws with, worked out from the card's accent colour.
type Brand = {
  primary: string;
  // Text drawn on top of the primary colour.
  onPrimary: string;
  // A dark shade of the primary: decoration, and a code that still scans on white.
  deep: string;
  // The primary as text on white, darkened if it is too pale to read.
  text: string;
  // The primary as text on the dark card.
  tint: string;
};

function brandOf(accent: string): Brand {
  const primary = HEX_COLOR.test(accent) ? accent : DEFAULT_CARD_ACCENT;
  return {
    primary,
    // white unless the accent is too pale to carry it
    onPrimary: contrast(primary, WHITE) >= 2.4 ? WHITE : INK,
    deep: darkEnough(primary, 9),
    text: darkEnough(primary, 3),
    tint: mix(primary, WHITE, 0.5),
  };
}

// "OK Auto Garage" -> "OA": what stands in the logo's place when there is no logo.
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

// The whole card and its bleed, in one colour.
function Ground({ h, fill }: { h: number; fill: string }) {
  return <rect x={-OVER} y={-OVER} width={CARD_WIDTH + 2 * OVER} height={h + 2 * OVER} fill={fill} />;
}

// A bar across the foot of the card, `height` units of it inside the cut.
function FootBar({ h, height, fill }: { h: number; height: number; fill: string }) {
  return <rect x={-OVER} y={h - height} width={CARD_WIDTH + 2 * OVER} height={height + OVER} fill={fill} />;
}

// Line icons on a 24 unit grid.
const ICONS = {
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  mail: (
    <>
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M22 6l-10 7L2 6" />
    </>
  ),
  pin: (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx={12} cy={10} r={3} />
    </>
  ),
  globe: (
    <>
      <circle cx={12} cy={12} r={10} />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  chat: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  sms: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </>
  ),
};

type IconName = keyof typeof ICONS;

const QR_ICONS: Record<CardQrType, IconName> = {
  review: "star",
  call: "phone",
  whatsapp: "chat",
  maps: "pin",
  sms: "sms",
  web: "globe",
  email: "mail",
  vcard: "user",
};

// `size` units square with its top left at x, y.
function Icon({ name, x, y, size, color }: { name: IconName; x: number; y: number; size: number; color: string }) {
  return (
    <g
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(size / 24).toFixed(4)})`}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </g>
  );
}

// What the logo sits on: the card's own white, the brand colour, the dark card, or nothing it can
// be read against, where it floats on a white chip with a shadow.
type LogoGround = "light" | "color" | "dark" | "floating";

// The space the logo ends up taking inside a w x h slot. Off white it gets a white chip round it,
// since an uploaded logo can be any colour.
function logoSize(logo: CardLogo | null, w: number, h: number, ground: LogoGround) {
  if (!logo) {
    const side = Math.min(w, h);
    return { w: side, h: side, pad: 0 };
  }
  const pad = ground === "light" ? 0 : Math.min(w, h) * 0.1;
  const height = Math.min(h - 2 * pad, (w - 2 * pad) / logo.ratio);
  return { w: height * logo.ratio + 2 * pad, h: height + 2 * pad, pad };
}

type SlotProps = {
  logo: CardLogo | null;
  content: CardContent;
  brand: Brand;
  shadow: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ground: LogoGround;
  // Where in the slot a logo narrower than it sits.
  align?: "start" | "middle" | "end";
};

// The logo, as large as it goes in its slot whatever its shape. Without one, the business's initials.
function LogoSlot({ logo, content, brand, shadow, x, y, w, h, ground, align = "start" }: SlotProps) {
  const box = logoSize(logo, w, h, ground);
  const left = align === "start" ? x : align === "middle" ? x + (w - box.w) / 2 : x + w - box.w;
  const top = y + (h - box.h) / 2;
  const lift = ground === "floating" ? `url(#${shadow})` : undefined;
  if (logo) {
    return (
      <>
        {ground !== "light" && (
          <rect
            x={left}
            y={top}
            width={box.w}
            height={box.h}
            rx={Math.min(box.w, box.h) * 0.18}
            fill={WHITE}
            filter={lift}
          />
        )}
        <image
          href={logo.src}
          x={left + box.pad}
          y={top + box.pad}
          width={box.w - 2 * box.pad}
          height={box.h - 2 * box.pad}
          preserveAspectRatio="xMidYMid meet"
        />
      </>
    );
  }
  const radius = box.w / 2;
  const ring = ground === "floating" ? radius * 0.8 : radius * 0.94;
  const color = ground === "color" ? brand.onPrimary : ground === "dark" ? WHITE : brand.text;
  return (
    <>
      {ground === "floating" && <circle cx={left + radius} cy={top + radius} r={radius} fill={WHITE} filter={lift} />}
      <circle cx={left + radius} cy={top + radius} r={ring} fill="none" stroke={color} strokeWidth={ring * 0.09} />
      <text
        x={left + radius}
        y={top + radius + ring * 0.26}
        textAnchor="middle"
        fontSize={ring * 0.74}
        fontWeight={800}
        fill={color}
      >
        {initials(content.businessName)}
      </text>
    </>
  );
}

// How the business name is set in a slot `width` wide: on one line, shrunk to fit, or wrapped onto
// `lines` when one line would come out under three quarters of `max`. `extra` is the height the
// lines after the first add.
function nameBlock(content: CardContent, width: number, max: number, lines = 1, scale = BOLD) {
  const text = content.businessName;
  const single = fitSize(text, width, max, scale);
  if (lines > 1 && single < max * 0.75) {
    for (let size = max; size > single; size--) {
      const wrapped = wrapLines(text, width / scale, size);
      if (wrapped.length <= lines && wrapped.every((line) => emWidth(line) * scale * size <= width)) {
        return { size, lines: wrapped, extra: (wrapped.length - 1) * size * 1.12 };
      }
    }
  }
  return { size: single, lines: [text], extra: 0 };
}

// The business name. `y` is the baseline of its first line, of its last with from="bottom", or
// where a single line would sit with from="middle", which a second line is then spread around.
function Name({
  content,
  width,
  max,
  lines,
  from = "top",
  ...props
}: {
  content: CardContent;
  width: number;
  max: number;
  lines?: number;
  from?: "top" | "middle" | "bottom";
} & Omit<React.ComponentProps<"text">, "y"> & { y: number }) {
  const name = nameBlock(content, width, max, lines, props.fontWeight === 900 ? 1.1 : BOLD);
  const first = props.y - (from === "bottom" ? name.extra : from === "middle" ? name.extra / 2 : 0);
  return (
    <text fontSize={name.size} fontWeight={800} letterSpacing={-name.size * 0.014} {...props} y={first}>
      {name.lines.map((line, index) => (
        <tspan key={index} x={props.x} dy={index === 0 ? 0 : name.size * 1.12}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// The line under the name: the person and their job when the card names one, otherwise the tagline.
function subText(content: CardContent) {
  return content.personName ? [content.personName, content.jobTitle].filter(Boolean).join(" · ") : content.tagline;
}

function Sub({
  content,
  width,
  max = 28,
  strong,
  ...props
}: {
  content: CardContent;
  width: number;
  max?: number;
  // Colour of the person's name, which is set bolder than their job.
  strong: string;
} & React.ComponentProps<"text">) {
  const text = subText(content);
  if (!text) return null;
  return (
    <text fontSize={fitSize(text, width, max, content.personName ? BOLD : 1)} {...props}>
      {content.personName ? (
        <>
          <tspan fontWeight={700} fill={strong}>
            {content.personName}
          </tspan>
          {content.jobTitle && ` · ${content.jobTitle}`}
        </>
      ) : (
        content.tagline
      )}
    </text>
  );
}

// One contact detail: its icon, then one line, or a few for an address. `size` is set on an
// address that only fits its lines smaller than the rest.
type Row = { icon: IconName; lines: string[]; size?: number };

// The contact details that are filled in, set in one size: the largest up to `base` at which the
// longest of them still fits `width`. The address wraps under that.
function contactRows(content: CardContent, width: number, base: number, addressLines = 3) {
  const singles: [IconName, string][] = [
    ["phone", content.phone],
    ["mail", content.email],
    ["globe", content.website],
  ];
  const filled = singles.filter(([, text]) => text);
  const size = Math.max(
    Math.round(base * 0.7),
    Math.min(base, ...filled.map(([, text]) => fitSize(text, width, base))),
  );
  const rows: Row[] = filled.map(([icon, text]) => ({ icon, lines: [text] }));
  if (content.address) {
    const address = fitLines(content.address, width, size, addressLines);
    rows.push({ icon: "pin", lines: address.lines, size: address.fontSize });
  }
  return { size, rows };
}

const lineHeight = (size: number) => size * 1.27;

// How far down the next row starts.
function advance(row: Row, size: number, gap: number) {
  return gap + (row.lines.length - 1) * lineHeight(size);
}

function rowsHeight(rows: Row[], size: number, gap: number) {
  if (rows.length === 0) return 0;
  const last = rows[rows.length - 1];
  return (
    rows.slice(0, -1).reduce((sum, row) => sum + advance(row, size, gap), 0) +
    (last.lines.length - 1) * lineHeight(size) +
    size
  );
}

// The rows in two columns: the first half on the left, the rest (the address last) on the right.
function splitRows(rows: Row[]) {
  const half = Math.ceil(rows.length / 2);
  return [rows.slice(0, half), rows.slice(half)];
}

// Contact rows stacked from `top` down. `gap` is from one row's baseline to the next.
function Rows({
  rows,
  size,
  x,
  top,
  gap,
  fill,
  icon,
}: {
  rows: Row[];
  size: number;
  x: number;
  top: number;
  gap: number;
  fill: string;
  icon: string;
}) {
  return (
    <>
      {rows.map((row, index) => {
        // the first baseline, then every row above this one
        const y = top + size * 0.8 + rows.slice(0, index).reduce((sum, above) => sum + advance(above, size, gap), 0);
        return (
          <g key={index}>
            <Icon name={row.icon} x={x} y={y - size * 0.84} size={size} color={icon} />
            <text x={x + size * 1.5} y={y} fontSize={row.size ?? size} fontWeight={500} fill={fill}>
              {row.lines.map((line, at) => (
                <tspan key={at} x={x + size * 1.5} dy={at === 0 ? 0 : lineHeight(row.size ?? size)}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </>
  );
}

type FaceProps = {
  content: CardContent;
  logo: CardLogo | null;
  codes: CardCode[];
  brand: Brand;
  shadow: string;
  // Height of the card. The templates were drawn at 600 and hand the difference out themselves.
  h: number;
};

// ---- fronts ----

function Classic({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 380, 30);
  const sub = subText(content);
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <rect x={-OVER} y={-OVER} width={18 + OVER} height={h + 2 * OVER} fill={brand.primary} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={70} y={60} w={320} h={130} ground="light" />
      <Name content={content} x={70} y={sub ? h - 130 : h - 96} width={420} max={56} lines={2} from="bottom" fill={INK} />
      <Sub content={content} x={70} y={h - 86} width={420} fill={GREY} strong={INK} />
      <path d={`M520 ${h / 2 - 150}V${h / 2 + 150}`} stroke={RULE} strokeWidth={2} />
      <Rows rows={rows} size={size} x={565} top={(h - rowsHeight(rows, size, 56)) / 2} gap={56} fill={INK} icon={brand.text} />
    </>
  );
}

function SplitFront({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 480, 30);
  const sub = subText(content);
  // name, line under it, rule and details are one block, centred on the card
  const { extra } = nameBlock(content, 540, 54, 2);
  const top = (h - (46 + extra + (sub ? 44 : 0) + 66 + rowsHeight(rows, size, 54))) / 2;
  const rule = top + 46 + extra + (sub ? 44 : 0) + 36;
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <rect x={-OVER} y={-OVER} width={380 + OVER} height={h + 2 * OVER} fill={brand.primary} />
      <circle cx={60} cy={h - 30} r={190} fill={brand.deep} opacity={0.28} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={50} y={h / 2 - 120} w={280} h={240} ground="color" align="middle" />
      <Name content={content} x={440} y={top + 46} width={540} max={54} lines={2} fill={INK} />
      <Sub content={content} x={440} y={top + 90 + extra} width={540} fill={GREY} strong={INK} />
      <path d={`M443 ${rule}h58`} stroke={brand.primary} strokeWidth={6} strokeLinecap="round" />
      <Rows rows={rows} size={size} x={440} top={rule + 30} gap={54} fill={INK} icon={brand.text} />
    </>
  );
}

function Centred({ content, logo, brand, shadow, h }: FaceProps) {
  const sub = subText(content).toUpperCase();
  const details = [content.phone, content.email, content.website].filter(Boolean);
  const fit = (line: string[]) => fitSize(line.join("   •   "), 900, 28);
  // three long details on one line come out too small to read, so the last drops to a line of its own
  const detailLines = details.length < 3 || fit(details) >= 23 ? [details] : [details.slice(0, 2), details.slice(2)];
  const detailSize = Math.min(...detailLines.map(fit));
  const detailDrop = (detailLines.length - 1) * detailSize * 1.55;
  const address = fitLines(content.address, 860, 26, 2);
  const rule = sub ? 306 : 270;
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <g transform={`translate(0 ${(h - 600) / 2})`}>
        <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={275} y={44} w={500} h={120} ground="light" align="middle" />
        <Name content={content} x={525} y={232} width={900} max={52} textAnchor="middle" fill={INK} />
        {sub && (
          <text
            x={525}
            y={274}
            textAnchor="middle"
            fontSize={fitSize(sub, 700, 22, 1.25)}
            fontWeight={600}
            letterSpacing={4}
            fill={brand.text}
          >
            {sub}
          </text>
        )}
        <path d={`M497 ${rule}h56`} stroke={brand.primary} strokeWidth={4} strokeLinecap="round" />
        {detailLines.map((line, at) => (
          <text
            key={at}
            x={525}
            y={rule + 88 + at * detailSize * 1.55}
            textAnchor="middle"
            fontSize={detailSize}
            fontWeight={500}
            fill={INK}
          >
            {line.map((detail, index) => (
              <tspan key={index}>
                {index > 0 && (
                  <tspan fill={brand.text} dx={detailSize * 0.5}>
                    •
                  </tspan>
                )}
                <tspan dx={index > 0 ? detailSize * 0.5 : 0}>{detail}</tspan>
              </tspan>
            ))}
          </text>
        ))}
        <text x={525} y={rule + 136 + detailDrop} textAnchor="middle" fontSize={address.fontSize} fill={GREY}>
          {address.lines.map((line, index) => (
            <tspan key={index} x={525} dy={index === 0 ? 0 : address.fontSize * 1.3}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
      <FootBar h={h} height={14} fill={brand.primary} />
    </>
  );
}

function BoldFront({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 380, 30);
  const sub = subText(content);
  return (
    <>
      <Ground h={h} fill={brand.primary} />
      <circle cx={980} cy={30} r={300} fill={WHITE} opacity={0.07} />
      <circle cx={30} cy={h + 40} r={250} fill={brand.deep} opacity={0.3} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={60} y={56} w={300} h={110} ground="color" />
      <Name content={content} x={58} y={sub ? h - 130 : h - 96} width={930} max={68} fontWeight={900} fill={brand.onPrimary} />
      <Sub content={content} x={60} y={h - 84} width={930} fill={brand.onPrimary} strong={brand.onPrimary} opacity={0.92} />
      <Rows rows={rows} size={size} x={565} top={78} gap={56} fill={brand.onPrimary} icon={brand.onPrimary} />
    </>
  );
}

function ArcFront({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 380, 30);
  const [left, right] = splitRows(rows);
  const top = 388 + (h - 600) / 2;
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <path d={`M${-OVER} ${-OVER}H${CARD_WIDTH + OVER}V180Q525 290 ${-OVER} 180Z`} fill={brand.primary} />
      <Name content={content} x={525} y={88} width={900} max={50} textAnchor="middle" fill={brand.onPrimary} />
      <Sub content={content} x={525} y={130} width={800} max={26} textAnchor="middle" fill={brand.onPrimary} strong={brand.onPrimary} opacity={0.92} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={385} y={160} w={280} h={148} ground="floating" align="middle" />
      <Rows rows={left} size={size} x={90} top={top} gap={56} fill={INK} icon={brand.text} />
      <Rows rows={right} size={size} x={545} top={top} gap={56} fill={INK} icon={brand.text} />
      <FootBar h={h} height={16} fill={brand.primary} />
    </>
  );
}

function DarkFront({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 380, 30);
  const [left, right] = splitRows(rows);
  // the details sit on the foot of the card, the rule just above them
  const top = h - 48 - Math.max(rowsHeight(left, size, 56), rowsHeight(right, size, 56));
  const lift = (h - 600) / 2;
  return (
    <>
      <Ground h={h} fill={INK} />
      <circle cx={CARD_WIDTH} cy={0} r={230} fill={brand.primary} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={70} y={56 + lift} w={300} h={116} ground="dark" />
      <Name content={content} x={70} y={272 + lift} width={760} max={54} fill={WHITE} />
      <Sub content={content} x={70} y={314 + lift} width={760} fill={brand.tint} strong={WHITE} />
      <path d={`M70 ${top - 40}H980`} stroke={WHITE} strokeOpacity={0.16} strokeWidth={2} />
      <Rows rows={left} size={size} x={70} top={top} gap={56} fill={WHITE} icon={brand.tint} />
      <Rows rows={right} size={size} x={540} top={top} gap={56} fill={WHITE} icon={brand.tint} />
    </>
  );
}

function Slant({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 380, 30);
  // the edge of the brand block: 740 across at the top of the card, leaning left on the way down
  const edge = (y: number) => 740 - 0.3 * y;
  const [from, to] = [edge(-OVER), edge(h + OVER)];
  const { extra } = nameBlock(content, 520, 52, 2);
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <path d={`M${from} ${-OVER}H${CARD_WIDTH + OVER}V${h + OVER}H${to}Z`} fill={brand.primary} />
      <path d={`M${from - 60} ${-OVER}H${from}L${to} ${h + OVER}H${to - 60}Z`} fill={brand.deep} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={730} y={h / 2 - 100} w={250} h={200} ground="color" align="middle" />
      <Name content={content} x={60} y={140} width={520} max={52} lines={2} fill={INK} />
      <Sub content={content} x={60} y={184 + extra} width={500} fill={GREY} strong={INK} />
      <Rows
        rows={rows}
        size={size}
        x={60}
        top={Math.min(252 + (h - 600) / 2 + extra, h - 48 - rowsHeight(rows, size, 56))}
        gap={56}
        fill={INK}
        icon={brand.text}
      />
    </>
  );
}

// Height of the brand band across the foot of the Band front.
const BAND = 220;

function Band({ content, logo, brand, shadow, h }: FaceProps) {
  const sub = subText(content);
  const middle = (h - BAND) / 2;
  const nameX = 60 + logoSize(logo, 260, 150, "light").w + 36;
  const { extra } = nameBlock(content, 990 - nameX, 58, 2);
  // a column per kind of detail, the empty ones left out and the rest closed up
  const columns = [
    { head: "CALL", lines: [content.phone] },
    { head: "ONLINE", lines: [content.email, content.website] },
    { head: "VISIT", lines: fitLines(content.address, 300, 26, 3).lines },
  ]
    .map((column) => ({ ...column, lines: column.lines.filter(Boolean) }))
    .filter((column) => column.lines.length > 0)
    // each as wide as its longest line, in em
    .map((column) => ({ ...column, em: Math.max(...column.lines.map(emWidth)) }));
  // one size for every column: the largest at which they fit side by side
  const em = columns.reduce((sum, column) => sum + column.em, 0);
  const size = Math.min(27, Math.floor((930 - 44 * (columns.length - 1)) / em));
  const gap = columns.length > 1 ? Math.min(90, (930 - em * size) / (columns.length - 1)) : 0;
  return (
    <>
      <Ground h={h} fill={PAPER} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={60} y={middle - 75} w={260} h={150} ground="light" />
      <Name
        content={content}
        x={nameX}
        y={sub ? middle - 2 : middle + 20}
        width={990 - nameX}
        max={58}
        lines={2}
        from="middle"
        fill={INK}
      />
      <Sub content={content} x={nameX} y={middle + 44 + extra / 2} width={990 - nameX} fill={GREY} strong={INK} />
      <FootBar h={h} height={BAND} fill={brand.primary} />
      {columns.map((column, index) => {
        const x = 60 + columns.slice(0, index).reduce((sum, before) => sum + before.em * size + gap, 0);
        return (
          <g key={column.head} fill={brand.onPrimary}>
            <text x={x} y={h - BAND + 56} fontSize={18} fontWeight={700} letterSpacing={3} opacity={0.78}>
              {column.head}
            </text>
            {column.lines.map((line, at) => (
              <text key={at} x={x} y={h - BAND + 98 + at * 36} fontSize={size} fontWeight={500}>
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </>
  );
}

function Frame({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 480, 28);
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <path d={`M${CARD_WIDTH - OVER} ${OVER}V166L${CARD_WIDTH - 166} ${OVER}Z`} fill={brand.primary} />
      {/* the border keeps 40 units off the cut, so a card trimmed a little off still shows all of it */}
      <rect x={OVER} y={OVER} width={CARD_WIDTH - 2 * OVER} height={h - 2 * OVER} fill="none" stroke={brand.primary} strokeWidth={4} />
      <Name content={content} x={84} y={132} width={720} max={50} fill={INK} />
      <Sub content={content} x={84} y={174} width={720} max={26} fontWeight={600} fill={brand.text} strong={INK} />
      <Rows rows={rows} size={size} x={84} top={h - 84 - rowsHeight(rows, size, 50)} gap={50} fill={INK} icon={brand.text} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={666} y={h - 254} w={300} h={170} ground="light" align="end" />
    </>
  );
}

function Header({ content, logo, brand, shadow, h }: FaceProps) {
  const { size, rows } = contactRows(content, 395, 30);
  const [left, right] = splitRows(rows);
  const sub = subText(content);
  const nameX = 60 + logoSize(logo, 240, 110, "color").w + 30;
  const { extra } = nameBlock(content, 990 - nameX, 52, 2);
  // the details are centred in the white under the bar
  const top = 200 + (h - 212 - Math.max(rowsHeight(left, size, 70), rowsHeight(right, size, 70))) / 2;
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <rect x={-OVER} y={-OVER} width={CARD_WIDTH + 2 * OVER} height={200 + OVER} fill={brand.primary} />
      <circle cx={1000} cy={0} r={190} fill={WHITE} opacity={0.07} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={60} y={45} w={240} h={110} ground="color" />
      <Name
        content={content}
        x={nameX}
        y={sub ? 100 : 118}
        width={990 - nameX}
        max={52}
        lines={2}
        from="middle"
        fill={brand.onPrimary}
      />
      <Sub
        content={content}
        x={nameX}
        y={144 + extra / 2}
        width={990 - nameX}
        fill={brand.onPrimary}
        strong={brand.onPrimary}
        opacity={0.92}
      />
      <Rows rows={left} size={size} x={60} top={top} gap={70} fill={INK} icon={brand.text} />
      <Rows rows={right} size={size} x={545} top={top} gap={70} fill={INK} icon={brand.text} />
      <FootBar h={h} height={12} fill={brand.primary} />
    </>
  );
}

// ---- backs ----

// White kept round a code inside its tile, as a share of the tile: the quiet zone a reader needs.
const TILE_PAD = 0.09;

// Where a back puts its codes, on a card `h` tall. `label` is the room under each code for its
// caption, `max` the largest a tile gets.
type Region = { x: number; y: number; w: number; h: number; label?: number; max?: number };

const BACK_REGIONS: Record<CardBack, (h: number) => Region> = {
  B1: (h) => ({ x: 60, y: 150, w: 930, h: h - 198 }),
  B2: (h) => ({ x: 60, y: 168, w: 930, h: h - 216 }),
  B3: (h) => ({ x: 390, y: 36, w: 612, h: h - 72, label: 78 }),
  B4: (h) => ({ x: 60, y: 188, w: 930, h: h - 236, max: 290 }),
  B5: (h) => ({ x: 60, y: 164, w: 930, h: h - 212, label: 78 }),
  B6: (h) => ({ x: 60, y: 168, w: 930, h: h - 216 }),
};

type Cell = { x: number; y: number; size: number };

// Lays `count` square tiles out in a region, in whichever rows and columns make them largest.
function tileCells(count: number, region: Region): Cell[] {
  if (count === 0) return [];
  const gap = 44;
  const { label = 62, max = 300 } = region;
  let best = { size: 0, columns: 1, rows: count };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const size = Math.min(
      (region.w - gap * (columns - 1)) / columns,
      (region.h - gap * (rows - 1)) / rows - label,
      max,
    );
    if (size > best.size) best = { size, columns, rows };
  }
  const { size, columns, rows } = best;
  const top = region.y + (region.h - (rows * (size + label) + (rows - 1) * gap)) / 2;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    // a last row with fewer tiles is centred too
    const inRow = Math.min(columns, count - row * columns);
    const left = region.x + (region.w - (inRow * size + (inRow - 1) * gap)) / 2;
    return { x: left + (index % columns) * (size + gap), y: top + row * (size + label + gap), size };
  });
}

// How wide each code prints, in mm, with `count` of them on this back. Under about 15 a phone
// starts to struggle.
export function cardCodeMm(back: CardBack, count: number, size: CardSize) {
  const [cell] = tileCells(count, BACK_REGIONS[back](cardHeight(size)));
  return cell ? Math.round(((cell.size * (1 - 2 * TILE_PAD)) / CARD_WIDTH) * sizeOf(size).width) : 0;
}

type TileStyle = {
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  // Id of the drop shadow filter, for a tile that floats.
  shadow?: string;
  qr?: string;
  // Caption colours, or a pill behind the caption.
  label: string;
  icon: string;
  pill?: { fill: string; on: string };
};

const captionText = (type: CardQrType) => CARD_QR_TYPES.find((option) => option.id === type)?.label ?? "";
// Width of a caption's words in em, set semi-bold.
const captionEm = (type: CardQrType) => emWidth(captionText(type)) * 1.05;

// The font size the captions of a back share: the largest at which the longest of them, with its
// icon (and a pill's ends), stays about as wide as its tile.
function captionSize(codes: CardCode[], width: number, pill: boolean) {
  const widest = Math.max(...codes.map((code) => captionEm(code.type)));
  return Math.max(16, Math.min(30, Math.floor((width + 8) / (widest + 1.45 + (pill ? 1.7 : 0)))));
}

// What the code does, under its tile: an icon and two or three words.
function Caption({ type, cx, top, size, style }: { type: CardQrType; cx: number; top: number; size: number; style: TileStyle }) {
  const text = captionText(type);
  const em = captionEm(type);
  // icon, a gap, then the words
  const total = size * (em + 1.45);
  const left = cx - total / 2;
  const height = size * 1.9;
  const baseline = style.pill ? top + height / 2 + size * 0.35 : top + size * 1.05;
  const color = style.pill ? style.pill.on : style.label;
  return (
    <>
      {style.pill && (
        <rect x={left - size * 0.85} y={top} width={total + size * 1.7} height={height} rx={height / 2} fill={style.pill.fill} />
      )}
      <Icon name={QR_ICONS[type]} x={left} y={baseline - size * 0.86} size={size * 1.05} color={style.pill ? color : style.icon} />
      <text x={left + size * 1.45 + (em * size) / 2} y={baseline} textAnchor="middle" fontSize={size} fontWeight={600} fill={color}>
        {text}
      </text>
    </>
  );
}

// The codes of a back, each on a white tile with its caption.
function Tiles({ back, codes, h, style }: { back: CardBack; codes: CardCode[]; h: number; style: TileStyle }) {
  const cells = tileCells(codes.length, BACK_REGIONS[back](h));
  const caption = captionSize(codes, cells[0]?.size ?? 0, Boolean(style.pill));
  return (
    <>
      {codes.map((code, index) => {
        const { x, y, size } = cells[index];
        const pad = size * TILE_PAD;
        return (
          <g key={code.type}>
            <rect
              x={x}
              y={y}
              width={size}
              height={size}
              rx={style.radius ?? 20}
              fill={WHITE}
              stroke={style.stroke}
              strokeWidth={style.stroke ? (style.strokeWidth ?? 4) : undefined}
              filter={style.shadow ? `url(#${style.shadow})` : undefined}
            />
            <g transform={`translate(${(x + pad).toFixed(2)} ${(y + pad).toFixed(2)})`}>
              <QrMarks matrix={code.matrix} size={size - 2 * pad} color={style.qr ?? INK} />
            </g>
            <Caption type={code.type} cx={x + size / 2} top={y + size + 14} size={caption} style={style} />
          </g>
        );
      })}
    </>
  );
}

const SCAN = "Scan with your phone camera";

// Logo, name and the scan line across the top of a back.
function BackHeader({
  content,
  logo,
  brand,
  shadow,
  ground,
  name,
  scan,
}: Pick<FaceProps, "content" | "logo" | "brand" | "shadow"> & { ground: LogoGround; name: string; scan: string }) {
  const nameX = 60 + logoSize(logo, 240, 100, ground).w + 24;
  return (
    <>
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={60} y={40} w={240} h={100} ground={ground} />
      <Name content={content} x={nameX} y={104} width={640 - nameX} max={40} lines={2} from="middle" fill={name} />
      <text x={990} y={100} textAnchor="end" fontSize={24} fill={scan}>
        {SCAN}
      </text>
    </>
  );
}

function Row({ content, logo, codes, brand, shadow, h }: FaceProps) {
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={275} y={30} w={500} h={100} ground="light" align="middle" />
      <Tiles back="B1" codes={codes} h={h} style={{ stroke: brand.primary, strokeWidth: 5, radius: 22, label: INK, icon: brand.text }} />
      <FootBar h={h} height={12} fill={brand.primary} />
    </>
  );
}

function BoldBack({ content, logo, codes, brand, shadow, h }: FaceProps) {
  return (
    <>
      <Ground h={h} fill={brand.primary} />
      <circle cx={980} cy={30} r={300} fill={WHITE} opacity={0.07} />
      <circle cx={30} cy={h + 40} r={250} fill={brand.deep} opacity={0.3} />
      <BackHeader content={content} logo={logo} brand={brand} shadow={shadow} ground="color" name={brand.onPrimary} scan={brand.onPrimary} />
      <Tiles back="B2" codes={codes} h={h} style={{ radius: 22, qr: brand.deep, label: brand.onPrimary, icon: brand.onPrimary }} />
    </>
  );
}

function SplitBack({ content, logo, codes, brand, shadow, h }: FaceProps) {
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <rect x={-OVER} y={-OVER} width={340 + OVER} height={h + 2 * OVER} fill={brand.primary} />
      <circle cx={40} cy={h - 20} r={180} fill={brand.deep} opacity={0.28} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={40} y={h / 2 - 160} w={260} h={200} ground="color" align="middle" />
      <Name content={content} x={170} y={h / 2 + 96} width={280} max={30} lines={2} fontWeight={700} textAnchor="middle" fill={brand.onPrimary} />
      <Tiles back="B3" codes={codes} h={h} style={{ stroke: RULE, strokeWidth: 2, label: INK, icon: INK, pill: { fill: brand.primary, on: brand.onPrimary } }} />
    </>
  );
}

function ArcBack({ content, logo, codes, brand, shadow, h }: FaceProps) {
  return (
    <>
      <Ground h={h} fill={WHITE} />
      <path d={`M${-OVER} ${-OVER}H${CARD_WIDTH + OVER}V120Q525 205 ${-OVER} 120Z`} fill={brand.primary} />
      <LogoSlot logo={logo} content={content} brand={brand} shadow={shadow} x={385} y={32} w={280} h={132} ground="floating" align="middle" />
      <Tiles back="B4" codes={codes} h={h} style={{ radius: 22, shadow, label: INK, icon: brand.text }} />
    </>
  );
}

function DarkBack({ content, logo, codes, brand, shadow, h }: FaceProps) {
  return (
    <>
      <Ground h={h} fill={INK} />
      <BackHeader content={content} logo={logo} brand={brand} shadow={shadow} ground="dark" name={WHITE} scan={brand.tint} />
      <Tiles back="B5" codes={codes} h={h} style={{ radius: 22, label: WHITE, icon: WHITE, pill: { fill: brand.primary, on: brand.onPrimary } }} />
      <FootBar h={h} height={10} fill={brand.primary} />
    </>
  );
}

function PaperBack({ content, logo, codes, brand, shadow, h }: FaceProps) {
  return (
    <>
      <Ground h={h} fill={PAPER} />
      <BackHeader content={content} logo={logo} brand={brand} shadow={shadow} ground="light" name={INK} scan={GREY} />
      <Tiles back="B6" codes={codes} h={h} style={{ stroke: brand.primary, strokeWidth: 10, radius: 30, shadow, label: INK, icon: brand.text }} />
    </>
  );
}

// A back with no codes ticked is the logo alone, on that back's own ground.
const BACK_GROUNDS: Record<CardBack, "light" | "color" | "dark" | "paper"> = {
  B1: "light",
  B2: "color",
  B3: "color",
  B4: "light",
  B5: "dark",
  B6: "paper",
};

function LogoOnly({ back, content, logo, brand, shadow, h }: FaceProps & { back: CardBack }) {
  const ground = BACK_GROUNDS[back];
  const fill = { light: WHITE, color: brand.primary, dark: INK, paper: PAPER }[ground];
  return (
    <>
      <Ground h={h} fill={fill} />
      <LogoSlot
        logo={logo}
        content={content}
        brand={brand}
        shadow={shadow}
        x={225}
        y={h / 2 - 130}
        w={600}
        h={260}
        ground={ground === "paper" ? "light" : ground}
        align="middle"
      />
    </>
  );
}

const TEMPLATES: Record<CardFront | CardBack, (props: FaceProps) => React.ReactNode> = {
  F1: Classic,
  F2: SplitFront,
  F3: Centred,
  F4: BoldFront,
  F5: ArcFront,
  F6: DarkFront,
  F7: Slant,
  F8: Band,
  F9: Frame,
  F10: Header,
  B1: Row,
  B2: BoldBack,
  B3: SplitBack,
  B4: ArcBack,
  B5: DarkBack,
  B6: PaperBack,
};

// One side of a visiting card. Pure SVG, so the same markup is the preview and the download.
export function VisitingCard({
  template,
  content,
  logo = null,
  codes = [],
  accent = DEFAULT_CARD_ACCENT,
  size = "us",
  bleed = false,
  ...props
}: {
  // A front (F1 to F10) or a back (B1 to B6).
  template: CardFront | CardBack;
  content: CardContent;
  logo?: CardLogo | null;
  // The QR codes of a back, in the order they are drawn. A front ignores them.
  codes?: CardCode[];
  // The client's brand colour, "#rrggbb".
  accent?: string;
  size?: CardSize;
  // Draw the margin a printer trims off. The card itself stays the same size inside it.
  bleed?: boolean;
} & Omit<React.ComponentProps<"svg">, "viewBox" | "children">) {
  const shadow = useId();
  const Template = TEMPLATES[template];
  const face = { content, logo, codes, brand: brandOf(accent), shadow, h: cardHeight(size) };
  const isBack = template.startsWith("B");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={cardViewBox(size, bleed)}
      fontFamily={FONT}
      role="img"
      aria-label={`${content.businessName || "Business"} visiting card, ${isBack ? "back" : "front"}`}
      {...props}
    >
      <defs>
        <filter id={shadow} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx={0} dy={8} stdDeviation={12} floodColor="#0B1B3F" floodOpacity={0.18} />
        </filter>
      </defs>
      {isBack && codes.length === 0 ? <LogoOnly back={template as CardBack} {...face} /> : <Template {...face} />}
    </svg>
  );
}
