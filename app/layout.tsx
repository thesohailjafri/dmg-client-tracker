import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DMG Client Tracker",
  description: "Internal client reporting tool.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
