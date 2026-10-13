import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview images: one for the app, one for a client's shared graphs, and one for a
// client's review link. The first two are the same card with different words on it; the third goes
// to the business's customers, so it carries the business and nothing of ours.

export const OG_SIZE = { width: 1200, height: 630 };

// The colours of the wordmark itself, which is a flat image on white: the card has to be white too.
const INK = "#121212";
const BLUE = "#1659FF";
const MUTED = "#6e6e73";

// The DoMoreGrowth wordmark, 782 x 184. It never changes, so it is read once.
const wordmark = readFile(join(process.cwd(), "assets/domoregrowth.png")).then(
  (file) => `data:image/png;base64,${file.toString("base64")}`,
);

// The slanted bars of the wordmark's arrow, large and faint, in the bottom right corner.
function Bars() {
  return (
    <div style={{ position: "absolute", right: -40, bottom: -70, display: "flex", transform: "rotate(-45deg)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        {[300, 440, 360].map((width, index) => (
          <div
            key={index}
            style={{ width, height: 54, borderRadius: 27, background: BLUE, opacity: 0.07, marginLeft: index * 30 }}
          />
        ))}
      </div>
    </div>
  );
}

function card(children: React.ReactNode, headers?: Record<string, string>) {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "72px 80px 84px",
        background: "#ffffff",
        color: INK,
      }}
    >
      <Bars />
      {children}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: BLUE }} />
    </div>,
    { ...OG_SIZE, headers },
  );
}

// The app's own preview: the wordmark and what the tool is.
export async function brandImage(headers?: Record<string, string>) {
  return card(
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn into an image, not a page */}
      <img src={await wordmark} width={612} height={144} alt="" />
      <div style={{ display: "flex", marginTop: 12, fontSize: 46, color: MUTED }}>Client Tracker</div>
    </div>,
    headers,
  );
}

// A client's shared graphs: the business name is the headline. Long names get smaller type and
// wrap, and anything past three lines is cut.
export async function reportImage(name: string, agency: string, headers?: Record<string, string>) {
  const fontSize = name.length <= 22 ? 92 : name.length <= 44 ? 72 : 56;
  return card(
    // a real element, not a fragment: the image renderer lays a fragment's children out in a row
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn into an image, not a page */}
      <img src={await wordmark} width={323} height={76} alt="" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 5, color: BLUE }}>GROWTH REPORT</div>
        <div
          style={{
            display: "block",
            marginTop: 18,
            maxWidth: 940,
            fontSize,
            lineHeight: 1.12,
            letterSpacing: -1.5,
            lineClamp: 3,
          }}
        >
          {name}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
        Website and Google profile growth, by {agency}
      </div>
    </div>,
    headers,
  );
}

// Google's review-star yellow.
const GOLD = "#FBBC04";

function Star({ size, opacity = 1 }: { size: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ opacity }}>
      <path
        fill={GOLD}
        d="M12 1.8l3.15 6.38 7.05 1.03-5.1 4.97 1.2 7.02L12 17.88 5.7 21.2l1.2-7.02-5.1-4.97 7.05-1.03z"
      />
    </svg>
  );
}

// A client's review link: five stars, the business name as the headline, and what a tap does. Long
// names get smaller type and wrap, and anything past three lines is cut. No Google logo: the word
// and the stars say it, and the logo is not ours to put on a card.
export async function reviewImage(name: string, headers?: Record<string, string>) {
  const fontSize = name.length <= 22 ? 92 : name.length <= 44 ? 72 : 56;
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "72px 80px 84px",
        background: "#ffffff",
        color: INK,
      }}
    >
      <div style={{ position: "absolute", right: -90, bottom: -110, display: "flex", transform: "rotate(-14deg)" }}>
        <Star size={520} opacity={0.12} />
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} size={76} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "block", maxWidth: 940, fontSize, lineHeight: 1.12, letterSpacing: -1.5, lineClamp: 3 }}>
          {name}
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 46, color: MUTED }}>Rate us on Google</div>
      </div>
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            padding: "16px 36px",
            borderRadius: 999,
            background: INK,
            color: "#ffffff",
            fontSize: 30,
          }}
        >
          Tap to leave a review
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: GOLD }} />
    </div>,
    { ...OG_SIZE, headers },
  );
}
