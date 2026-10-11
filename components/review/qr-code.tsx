import type { QrMatrix } from "@/lib/qr";

export type QrStyle = "square" | "rounded" | "dots";

// Modules of white kept around a standalone code. The QR spec asks for four.
const QUIET_ZONE = 4;
// The three corner markers are 7x7 modules.
const FINDER = 7;

const fixed = (value: number) => +value.toFixed(3);

function inFinder(row: number, col: number, count: number) {
  return (
    (row < FINDER && col < FINDER) ||
    (row < FINDER && col >= count - FINDER) ||
    (row >= count - FINDER && col < FINDER)
  );
}

function roundRect(x: number, y: number, size: number, radius: number) {
  const r = fixed(radius);
  const side = fixed(size - 2 * radius);
  return (
    `M${fixed(x + radius)} ${fixed(y)}h${side}a${r} ${r} 0 0 1 ${r} ${r}v${side}a${r} ${r} 0 0 1 -${r} ${r}` +
    `h-${side}a${r} ${r} 0 0 1 -${r} -${r}v-${side}a${r} ${r} 0 0 1 ${r} -${r}z`
  );
}

// Centres of the 5x5 alignment patterns, the small bullseyes readers use to correct for skew.
// The smallest code has none; each larger size has a fixed grid of them.
function alignmentCentres(count: number) {
  const version = (count - 17) / 4;
  if (version < 2) return [];
  const perSide = Math.floor(version / 7) + 2;
  const last = count - FINDER;
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (perSide - 1) / 2) * 2;
  const axis = [6];
  for (let position = last; axis.length < perSide; position -= step) axis.splice(1, 0, position);
  return axis
    .flatMap((row) => axis.map((col) => ({ row, col })))
    .filter(({ row, col }) => !inFinder(row, col, count));
}

// Ring, gap, eye. Drawn with fill-rule evenodd, so the middle path cuts the gap out.
// The corners stay well short of a circle: readers lose a finder whose eye is fully round.
function finderPath(row: number, col: number, style: QrStyle) {
  const dots = style === "dots";
  return (
    roundRect(col, row, 7, dots ? 2.2 : 1.6) +
    roundRect(col + 1, row + 1, 5, dots ? 1.3 : 0.8) +
    roundRect(col + 2, row + 2, 3, dots ? 1 : 0.7)
  );
}

function alignmentPath(row: number, col: number, style: QrStyle) {
  const dots = style === "dots";
  return (
    roundRect(col - 2, row - 2, 5, dots ? 1.5 : 1) +
    roundRect(col - 1, row - 1, 3, dots ? 0.9 : 0.5) +
    roundRect(col, row, 1, dots ? 0.5 : 0.3)
  );
}

// The finder and alignment patterns of the styled codes, drawn as whole shapes. Left as loose
// dots, they are the first thing a reader fails to find.
function patternsPath(count: number, style: QrStyle) {
  const last = count - FINDER;
  return (
    finderPath(0, 0, style) +
    finderPath(0, last, style) +
    finderPath(last, 0, style) +
    alignmentCentres(count)
      .map(({ row, col }) => alignmentPath(row, col, style))
      .join("")
  );
}

function modulesPath(matrix: QrMatrix, style: QrStyle) {
  const count = matrix.length;
  const centres = style === "square" ? [] : alignmentCentres(count);
  const inPattern = (row: number, col: number) =>
    inFinder(row, col, count) ||
    centres.some((centre) => Math.abs(centre.row - row) <= 2 && Math.abs(centre.col - col) <= 2);
  let path = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!matrix[row][col]) continue;
      if (style === "square") {
        // One rectangle per run, a hair taller than a module so rows leave no seam when rasterised.
        let end = col;
        while (end + 1 < count && matrix[row][end + 1]) end++;
        const length = end - col + 1;
        path += `M${col} ${row}h${length}v1.02h-${length}z`;
        col = end;
      } else if (inPattern(row, col)) {
        continue;
      } else if (style === "dots") {
        // full-width dots, touching their neighbours
        path += `M${col} ${row + 0.5}a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0z`;
      } else {
        path += roundRect(col + 0.04, row + 0.04, 0.92, 0.28);
      }
    }
  }
  return path;
}

// The code itself, `size` units square with its top left at the origin. For use inside a larger SVG.
export function QrMarks({
  matrix,
  size,
  style = "square",
  color = "#000000",
}: {
  matrix: QrMatrix;
  size: number;
  style?: QrStyle;
  color?: string;
}) {
  const count = matrix.length;
  return (
    <g transform={`scale(${fixed(size / count)})`} fill={color}>
      <path d={modulesPath(matrix, style)} />
      {style !== "square" && <path fillRule="evenodd" d={patternsPath(count, style)} />}
    </g>
  );
}

// A standalone, scannable code: the marks on a background with the quiet zone around them.
export function QrCode({
  matrix,
  style,
  color,
  background = "#ffffff",
  size = 512,
  ...props
}: {
  matrix: QrMatrix;
  style?: QrStyle;
  color?: string;
  background?: string;
  size?: number;
} & Omit<React.ComponentProps<"svg">, "viewBox" | "children">) {
  const inner = (size * matrix.length) / (matrix.length + 2 * QUIET_ZONE);
  const offset = fixed((size - inner) / 2);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} role="img" {...props}>
      <rect width={size} height={size} fill={background} />
      <g transform={`translate(${offset} ${offset})`}>
        <QrMarks matrix={matrix} size={inner} style={style} color={color} />
      </g>
    </svg>
  );
}
