import type { Metadata } from "next";
import "./globals.css";

// Link previews need full addresses for their image. Without NEXT_PUBLIC_APP_URL, Next.js works
// the address out from the deployment by itself.
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  ...(appUrl && URL.canParse(appUrl) && { metadataBase: new URL(appUrl) }),
  title: "DMG Client Tracker",
  description: "Internal client reporting tool.",
  robots: { index: false, follow: false },
  // the image itself is app/opengraph-image.tsx
  openGraph: { title: "DMG Client Tracker", siteName: "DMG Client Tracker", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
