import qrcode from "qrcode-generator";

// Rows of modules, true = dark. No quiet zone: whoever draws it adds the margin.
export type QrMatrix = boolean[][];

// Share of the code that can be damaged and still scan: L 7%, M 15%, Q 25%, H 30%.
export type QrLevel = "L" | "M" | "Q" | "H";

// Null when there is nothing to encode, or the text is too long for a QR code at this level.
export function qrMatrix(value: string, level: QrLevel = "M"): QrMatrix | null {
  if (!value) return null;
  // The library keeps one byte per character, so hand it UTF-8 bytes as a binary string.
  const bytes = Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join("");
  try {
    const qr = qrcode(0, level);
    qr.addData(bytes, "Byte");
    qr.make();
    const count = qr.getModuleCount();
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
    );
  } catch {
    return null;
  }
}
