import { useId } from "react";
import { QrMarks, type QrStyle } from "@/components/review/qr-code";
import { BOLD, fitLines, fitSize, HEAVY, Lines } from "@/components/svg-text";
import { contrast, darkEnough, HEX_COLOR } from "@/lib/color";
import type { QrMatrix } from "@/lib/qr";

// Every sheet is 850 units wide; only the height changes with the paper. `pngWidth` is the
// pixel width that prints it at 300 dpi (the sticker is simply 4K portrait).
export const BANNER_WIDTH = 850;
export const BANNER_SIZES = [
  { id: "a4", name: "A4", height: 1202, pngWidth: 2480 },
  { id: "letter", name: "US Letter", height: 1100, pngWidth: 2550 },
  { id: "sticker", name: "Sticker 9:16", height: 1511, pngWidth: 2160 },
] as const;

export type BannerSize = (typeof BANNER_SIZES)[number]["id"];

// The templates were drawn on the US Letter sheet and stretch from there.
const DRAWN_HEIGHT = 1100;

function bannerHeight(size: BannerSize) {
  return BANNER_SIZES.find((option) => option.id === size)?.height ?? DRAWN_HEIGHT;
}

export const BANNER_TEMPLATES = [
  { id: "paper", name: "Paper", description: "Soft grey sheet, accent colour headline, framed code." },
  { id: "bold", name: "Bold", description: "Full accent colour, left aligned, big white card." },
  { id: "arc", name: "Arc", description: "Accent colour header curving into a clean white page." },
] as const;

export type BannerTemplate = (typeof BANNER_TEMPLATES)[number]["id"];

export type BannerContent = {
  businessName: string;
  eyebrow: string;
  headline: string;
  instruction: string;
  message: string;
};

// Few words, set large: the sheet is read from a counter, at arm's length.
export const DEFAULT_BANNER_CONTENT: BannerContent = {
  businessName: "",
  eyebrow: "Leave us a",
  headline: "Review",
  instruction: "Scan with your phone camera",
  message: "It takes less than a minute. Thank you!",
};

// The colour a banner starts in: our own blue, same as --primary.
export const DEFAULT_ACCENT = "#0066FF";
// Who the "Powered by" credit at the foot of the sheet names.
export const POWERED_BY = "DoMoreGrowth";

// Literal colours, not CSS variables: a downloaded banner has no stylesheet to resolve them.
const INK = "#16181D";
const PAPER = "#EEF1F6";
const WHITE = "#FFFFFF";
const GOLD = "#FBBC05"; // the yellow of Google's own stars
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif';

// The palette a template draws with, worked out from the banner's accent colour.
type Brand = {
  // Name in the "Powered by" credit, empty when the credit is switched off.
  name: string;
  primary: string;
  // Text and stars drawn on top of the primary colour.
  onPrimary: string;
  // A dark shade of the primary: decoration, and a code that still scans on white.
  deep: string;
};

function brandOf(accent: string, poweredBy: boolean): Brand {
  const primary = HEX_COLOR.test(accent) ? accent : DEFAULT_ACCENT;
  return {
    name: poweredBy ? POWERED_BY : "",
    primary,
    // white unless the accent is too pale to carry it
    onPrimary: contrast(primary, WHITE) >= 2.4 ? WHITE : INK,
    deep: darkEnough(primary, 9),
  };
}

function starPath(cx: number, cy: number, radius: number) {
  let path = "";
  for (let point = 0; point < 10; point++) {
    const angle = (Math.PI / 5) * point - Math.PI / 2;
    const reach = point % 2 === 0 ? radius : radius * 0.5;
    path += `${point === 0 ? "M" : "L"}${(cx + reach * Math.cos(angle)).toFixed(2)} ${(cy + reach * Math.sin(angle)).toFixed(2)}`;
  }
  return `${path}Z`;
}

// Five stars in a row. `x` is the centre of the row, or its left edge with align="start".
function Stars({
  x,
  y,
  radius,
  fill,
  align = "middle",
}: {
  x: number;
  y: number;
  radius: number;
  fill: string;
  align?: "start" | "middle";
}) {
  const step = radius * 2.6;
  const first = align === "middle" ? x - step * 2 : x + radius;
  return (
    // the stroke only rounds the points off
    <g fill={fill} stroke={fill} strokeWidth={radius * 0.22} strokeLinejoin="round">
      {[0, 1, 2, 3, 4].map((index) => (
        <path key={index} d={starPath(first + step * index, y, radius)} />
      ))}
    </g>
  );
}

// Google's "G", `size` units square with its top left at x, y.
function GoogleG({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 48})`}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </g>
  );
}

// Says where the review goes: Google's mark, its name and five gold stars on one line, `size`
// being the height of the mark. Without `google` it is five plain stars in `starFill`.
// `chip` puts the line on a white pill so it reads on top of the brand colour.
function Trust({
  x,
  y,
  size,
  google,
  starFill,
  align = "middle",
  chip = false,
}: {
  x: number;
  y: number;
  size: number;
  google: boolean;
  starFill: string;
  align?: "start" | "middle";
  chip?: boolean;
}) {
  const radius = size * 0.36;
  if (!google) return <Stars x={x} y={y} radius={radius * 1.15} fill={starFill} align={align} />;

  const fontSize = size * 0.92;
  // textLength pins the word to this width, so the row stays centred whatever font is used
  const wordWidth = fontSize * 3.25;
  const padding = chip ? size * 0.6 : 0;
  const height = size * 1.7;
  const wordX = padding + size * 1.28;
  const starsX = wordX + wordWidth + size * 0.5;
  const width = starsX + radius * 12.4 + padding;
  const left = align === "middle" ? x - width / 2 : x;
  return (
    <>
      {chip && <rect x={left} y={y - height / 2} width={width} height={height} rx={height / 2} fill={WHITE} />}
      <GoogleG x={left + padding} y={y - size / 2} size={size} />
      <text
        x={left + wordX}
        y={y + fontSize * 0.34}
        fontSize={fontSize}
        fontWeight={600}
        textLength={wordWidth}
        fill={INK}
      >
        Google
      </text>
      <Stars x={left + starsX} y={y} radius={radius} fill={GOLD} align="start" />
    </>
  );
}

function ScanPill({
  x,
  y,
  width,
  height,
  brand,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  brand: Brand;
}) {
  const fontSize = height * 0.45;
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx={height / 2} fill={brand.primary} />
      <text
        x={x + width / 2 + fontSize * 0.05}
        y={y + height / 2 + fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={700}
        letterSpacing={fontSize * 0.1}
        fill={brand.onPrimary}
      >
        SCAN ME
      </text>
    </>
  );
}

// Our credit at the foot of the sheet. Nothing when it is switched off.
function PoweredBy({ brand, ...props }: { brand: Brand } & React.ComponentProps<"text">) {
  if (!brand.name) return null;
  return (
    <text fontSize={20} {...props}>
      Powered by <tspan fontWeight={700}>{brand.name}</tspan>
    </text>
  );
}

// The code, or a dashed placeholder until there is a link to encode.
function QrSlot({
  matrix,
  x,
  y,
  size,
  style,
  color,
}: {
  matrix: QrMatrix | null;
  x: number;
  y: number;
  size: number;
  style: QrStyle;
  color: string;
}) {
  if (!matrix) {
    return (
      <>
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          rx={16}
          fill="#F4F6FA"
          stroke="#B8C0CC"
          strokeWidth={2}
          strokeDasharray="10 8"
        />
        <text x={x + size / 2} y={y + size / 2 + 7} textAnchor="middle" fontSize={20} fill="#7A8494">
          Add a review link
        </text>
      </>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <QrMarks matrix={matrix} size={size} style={style} color={color} />
    </g>
  );
}

type TemplateProps = {
  content: BannerContent;
  matrix: QrMatrix | null;
  brand: Brand;
  google: boolean;
  shadow: string;
  // Height of the sheet, and how much taller that is than the 1100 the templates were drawn at.
  // Each template hands that extra height out between its blocks, and grows the code with it.
  height: number;
  extra: number;
};

// Moves a block down by a share of the extra height.
const down = (extra: number, share: number) => `translate(0 ${Math.round(extra * share)})`;

// Scales a block around the middle of its top edge (cx, top), then moves it down by `dy`.
const grow = (cx: number, top: number, scale: number, dy: number) =>
  `translate(${(cx * (1 - scale)).toFixed(2)} ${(top * (1 - scale) + dy).toFixed(2)}) scale(${scale.toFixed(4)})`;

function Paper({ content, matrix, brand, google, shadow, height, extra }: TemplateProps) {
  const headline = content.headline.toUpperCase();
  const headlineSize = fitSize(headline, 640, 140, HEAVY);
  const message = fitLines(content.message, 700, 30, 2);
  return (
    <>
      <rect width={BANNER_WIDTH} height={height} fill={PAPER} />
      <g transform={down(extra, 0.15)}>
        <text x={425} y={96} textAnchor="middle" fontSize={fitSize(content.eyebrow, 700, 36)} fill={INK}>
          {content.eyebrow}
        </text>
        <text
          x={425}
          y={220}
          textAnchor="middle"
          fontSize={headlineSize}
          fontWeight={900}
          letterSpacing={-headlineSize * 0.015}
          fill={brand.primary}
        >
          {headline}
        </text>
        <Trust x={425} y={276} size={42} google={google} starFill={brand.primary} />
      </g>

      {/* the card takes 40% of the extra height */}
      <g transform={grow(425, 330, 1 + (0.4 * extra) / 442, extra * 0.25)}>
        <rect x={205} y={330} width={440} height={442} rx={22} fill={WHITE} filter={`url(#${shadow})`} />
        <rect
          x={265}
          y={364}
          width={320}
          height={330}
          rx={36}
          fill="none"
          stroke={brand.primary}
          strokeWidth={12}
        />
        <QrSlot matrix={matrix} x={301} y={388} size={248} style="dots" color={INK} />
        {/* the tab's roof pokes up into the frame, pointing at the code */}
        <path
          d="M425 652 517 694V736H333V694Z"
          fill={brand.primary}
          stroke={brand.primary}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <text
          x={426}
          y={724}
          textAnchor="middle"
          fontSize={24}
          fontWeight={700}
          letterSpacing={1.5}
          fill={brand.onPrimary}
        >
          SCAN ME
        </text>
      </g>

      <g transform={down(extra, 0.75)}>
        <text
          x={425}
          y={836}
          textAnchor="middle"
          fontSize={fitSize(content.instruction, 720, 36, BOLD)}
          fontWeight={700}
          fill={INK}
        >
          {content.instruction}
        </text>
        <Lines
          lines={message.lines}
          lineHeight={message.lineHeight}
          x={425}
          y={884}
          textAnchor="middle"
          fontSize={message.fontSize}
          fill={INK}
        />
      </g>
      <g transform={down(extra, 0.9)}>
        <path d="M397 956H453" stroke={brand.primary} strokeWidth={4} strokeLinecap="round" />
        <text
          x={425}
          y={1012}
          textAnchor="middle"
          fontSize={fitSize(content.businessName, 700, 38, BOLD)}
          fontWeight={600}
          fill={INK}
        >
          {content.businessName}
        </text>
      </g>
      <PoweredBy brand={brand} x={425} y={height - 34} textAnchor="middle" fill={INK} opacity={0.65} />
    </>
  );
}

function Bold({ content, matrix, brand, google, shadow, height, extra }: TemplateProps) {
  const headline = content.headline.toUpperCase();
  const headlineSize = fitSize(headline, 716, 210, HEAVY);
  // On a tall sheet the card stacks: a much bigger code, with the message underneath it.
  const stacked = extra > 200;
  const message = stacked ? fitLines(content.message, 630, 34, 2) : fitLines(content.message, 280, 34, 5);
  const cardTop = 500 + Math.round(extra * (stacked ? 0.32 : 0.4));
  const cardHeight = stacked ? 668 + (message.lines.length - 1) * message.lineHeight : 410;
  // side by side: pill, gap, then the message, centred against the code
  const blockTop =
    cardTop + 205 - (48 + 30 + message.fontSize + (message.lines.length - 1) * message.lineHeight) / 2;
  return (
    <>
      <rect width={BANNER_WIDTH} height={height} fill={brand.primary} />
      <circle cx={780} cy={70} r={300} fill={WHITE} opacity={0.07} />
      <circle cx={40} cy={height + 10} r={250} fill={brand.deep} opacity={0.3} />

      <g transform={down(extra, 0.08)}>
        <Trust x={70} y={94} size={42} google={google} starFill={brand.onPrimary} align="start" chip />
      </g>
      <g transform={down(extra, 0.3)}>
        {/* the headline sits on a fixed baseline, so the eyebrow rides up as it grows */}
        <text
          x={70}
          y={370 - headlineSize * 0.72}
          fontSize={fitSize(content.eyebrow, 710, 44)}
          fontWeight={500}
          fill={brand.onPrimary}
          opacity={0.92}
        >
          {content.eyebrow}
        </text>
        <text
          x={64}
          y={400}
          fontSize={headlineSize}
          fontWeight={900}
          letterSpacing={-headlineSize * 0.015}
          fill={brand.onPrimary}
        >
          {headline}
        </text>
        <text
          x={70}
          y={462}
          fontSize={fitSize(content.instruction, 710, 34, BOLD)}
          fontWeight={600}
          fill={brand.onPrimary}
        >
          {content.instruction}
        </text>
      </g>

      <rect
        x={70}
        y={cardTop}
        width={710}
        height={cardHeight}
        rx={30}
        fill={WHITE}
        filter={`url(#${shadow})`}
      />
      {stacked ? (
        <>
          <QrSlot matrix={matrix} x={205} y={cardTop + 50} size={440} style="rounded" color={brand.deep} />
          <ScanPill x={330} y={cardTop + 520} width={190} height={52} brand={brand} />
          <Lines
            lines={message.lines}
            lineHeight={message.lineHeight}
            x={425}
            y={cardTop + 628}
            textAnchor="middle"
            fontSize={message.fontSize}
            fill={INK}
          />
        </>
      ) : (
        <>
          <QrSlot matrix={matrix} x={125} y={cardTop + 55} size={300} style="rounded" color={brand.deep} />
          <ScanPill x={470} y={blockTop} width={170} height={48} brand={brand} />
          <Lines
            lines={message.lines}
            lineHeight={message.lineHeight}
            x={470}
            y={blockTop + 78 + message.fontSize * 0.75}
            fontSize={message.fontSize}
            fill={INK}
          />
        </>
      )}

      <text
        x={70}
        y={height - 98}
        fontSize={fitSize(content.businessName, 710, 46, BOLD)}
        fontWeight={700}
        fill={brand.onPrimary}
      >
        {content.businessName}
      </text>
      <PoweredBy brand={brand} x={70} y={height - 40} fill={brand.onPrimary} opacity={0.85} />
    </>
  );
}

function Arc({ content, matrix, brand, google, shadow, height, extra }: TemplateProps) {
  const headline = content.headline.toUpperCase();
  const headlineSize = fitSize(headline, 720, 176, HEAVY);
  const message = fitLines(content.message, 680, 30, 2);
  // the curve and the card that straddles it move down together
  const drop = Math.round(extra * 0.3);
  return (
    <>
      <rect width={BANNER_WIDTH} height={height} fill={WHITE} />
      <path d={`M0 0H850V${455 + drop}Q425 ${575 + drop} 0 ${455 + drop}Z`} fill={brand.primary} />
      <circle cx={800} cy={30} r={170} fill={WHITE} opacity={0.07} />

      <g transform={down(extra, 0.2)}>
        <Trust x={425} y={90} size={42} google={google} starFill={brand.onPrimary} chip />
        <text
          x={425}
          y={190}
          textAnchor="middle"
          fontSize={fitSize(content.eyebrow, 700, 38)}
          fill={brand.onPrimary}
          opacity={0.92}
        >
          {content.eyebrow}
        </text>
        <text
          x={425}
          y={350}
          textAnchor="middle"
          fontSize={headlineSize}
          fontWeight={900}
          letterSpacing={-headlineSize * 0.015}
          fill={brand.onPrimary}
        >
          {headline}
        </text>
      </g>

      {/* the card takes 35% of the extra height */}
      <g transform={grow(425, 420, 1 + (0.35 * extra) / 340, drop)}>
        <rect x={255} y={420} width={340} height={340} rx={30} fill={WHITE} filter={`url(#${shadow})`} />
        <QrSlot matrix={matrix} x={291} y={456} size={268} style="square" color={INK} />
        <ScanPill x={345} y={738} width={160} height={44} brand={brand} />
      </g>

      <g transform={down(extra, 0.75)}>
        <text
          x={425}
          y={850}
          textAnchor="middle"
          fontSize={fitSize(content.instruction, 720, 36, BOLD)}
          fontWeight={700}
          fill={INK}
        >
          {content.instruction}
        </text>
        <Lines
          lines={message.lines}
          lineHeight={message.lineHeight}
          x={425}
          y={898}
          textAnchor="middle"
          fontSize={message.fontSize}
          fill={INK}
        />
      </g>
      <g transform={down(extra, 0.9)}>
        <path d="M397 966H453" stroke={brand.primary} strokeWidth={4} strokeLinecap="round" />
        <text
          x={425}
          y={1018}
          textAnchor="middle"
          fontSize={fitSize(content.businessName, 700, 38, BOLD)}
          fontWeight={700}
          fill={INK}
        >
          {content.businessName}
        </text>
      </g>
      {/* the closing bar is tall enough to carry the credit, and thin without one */}
      <rect y={height - (brand.name ? 48 : 18)} width={BANNER_WIDTH} height={48} fill={brand.primary} />
      <PoweredBy brand={brand} x={425} y={height - 17} textAnchor="middle" fill={brand.onPrimary} />
    </>
  );
}

const TEMPLATES = { paper: Paper, bold: Bold, arc: Arc };

// A printable "leave us a review" sheet. Pure SVG, so the same markup is the preview and the download.
export function ReviewBanner({
  template,
  content,
  matrix,
  accent = DEFAULT_ACCENT,
  poweredBy = true,
  google = true,
  size = "a4",
  ...props
}: {
  template: BannerTemplate;
  content: BannerContent;
  // The review link as a QR matrix, or null to draw a placeholder.
  matrix: QrMatrix | null;
  // The client's brand colour, "#rrggbb".
  accent?: string;
  // Print the "Powered by" credit at the foot of the sheet.
  poweredBy?: boolean;
  // Show Google's mark and gold stars. Turn off when the link goes somewhere other than Google.
  google?: boolean;
  size?: BannerSize;
} & Omit<React.ComponentProps<"svg">, "viewBox" | "children">) {
  const shadow = useId();
  const Template = TEMPLATES[template];
  const height = bannerHeight(size);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${BANNER_WIDTH} ${height}`}
      fontFamily={FONT}
      role="img"
      aria-label={`${content.businessName || "Business"} review banner`}
      {...props}
    >
      <defs>
        <filter id={shadow} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx={0} dy={12} stdDeviation={16} floodColor="#0B1B3F" floodOpacity={0.16} />
        </filter>
      </defs>
      <Template
        content={content}
        matrix={matrix}
        brand={brandOf(accent, poweredBy)}
        google={google}
        shadow={shadow}
        height={height}
        extra={height - DRAWN_HEIGHT}
      />
    </svg>
  );
}
