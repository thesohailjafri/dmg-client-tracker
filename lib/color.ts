// Small helpers for deriving a palette from one brand colour. Colours are "#rrggbb" strings.

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function channels(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

function luminance(hex: string) {
  const [red, green, blue] = channels(hex).map((channel) => {
    const share = channel / 255;
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// WCAG contrast ratio, 1 (identical) to 21 (black on white).
export function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// `amount` of the way from `from` to `to`, 0 to 1.
export function mix(from: string, to: string, amount: number) {
  const target = channels(to);
  return `#${channels(from)
    .map((channel, index) => Math.round(channel + (target[index] - channel) * amount))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

// The colour itself if it already has `ratio` contrast against white, otherwise the lightest
// darkened version that does. A QR code or text in the result stays readable on white.
export function darkEnough(color: string, ratio: number) {
  for (let amount = 0; amount < 1; amount += 0.05) {
    const shade = mix(color, "#000000", amount);
    if (contrast(shade, "#ffffff") >= ratio) return shade;
  }
  return "#000000";
}
