// Fitting text into a drawing that is exported as SVG. It is set in whatever system font the
// machine has, so text is fitted with a margin instead of measured.

// How much wider than regular text the heavier weights set.
export const HEAVY = 1.04;
export const BOLD = 1.06;

// Rough advance width in em.
export function emWidth(text: string) {
  let width = 0;
  for (const char of text) {
    if (" .,:;'!|iIjl".includes(char)) width += 0.28;
    else if ("mwMW@%&".includes(char)) width += 0.9;
    else if (char >= "a" && char <= "z") width += 0.5;
    else width += 0.64;
  }
  return width;
}

// Largest font size up to `max` that keeps one line of `text` inside `width`.
export function fitSize(text: string, width: number, max: number, scale = 1) {
  const em = emWidth(text) * scale;
  return em > 0 ? Math.min(max, Math.floor(width / em)) : max;
}

export function wrapLines(text: string, width: number, size: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && emWidth(next) * size > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Wraps `text` into at most `maxLines`, stepping the font size down from `size` until it fits.
export function fitLines(text: string, width: number, size: number, maxLines: number) {
  const smallest = Math.round(size * 0.68);
  for (let fontSize = size; ; fontSize--) {
    const lines = wrapLines(text, width, fontSize);
    if (lines.length <= maxLines || fontSize <= smallest) {
      return { fontSize, lineHeight: fontSize * 1.36, lines: lines.slice(0, maxLines) };
    }
  }
}

export function Lines({
  lines,
  lineHeight,
  ...props
}: { lines: string[]; lineHeight: number } & React.ComponentProps<"text">) {
  return (
    <text {...props}>
      {lines.map((line, index) => (
        <tspan key={index} x={props.x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
