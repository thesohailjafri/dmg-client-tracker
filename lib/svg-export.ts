// Browser only: turns an on-page <svg> into a downloaded file.

// A standalone copy at an explicit pixel size, without the classes that sized it on the page.
function serialize(svg: SVGSVGElement, width: number, height: number) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.removeAttribute("class");
  copy.removeAttribute("style");
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  return new XMLSerializer().serializeToString(copy);
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // let the download start before the URL goes away
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function heightFor(svg: SVGSVGElement, width: number) {
  const box = svg.viewBox.baseVal;
  return Math.round((width * box.height) / box.width);
}

// File-name-safe version of a business name, e.g. "OK Auto & Tyre" -> "ok-auto-tyre".
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function downloadSvg(svg: SVGSVGElement, filename: string) {
  const box = svg.viewBox.baseVal;
  save(new Blob([serialize(svg, box.width, box.height)], { type: "image/svg+xml" }), filename);
}

// Rasterises at `width` pixels wide, height following the viewBox.
export async function downloadPng(svg: SVGSVGElement, filename: string, width: number) {
  const height = heightFor(svg, width);
  const url = URL.createObjectURL(new Blob([serialize(svg, width, height)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the image."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not render the image.");
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not render the image.");
    save(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
