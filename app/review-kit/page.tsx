import { QrGenerator } from "@/components/review/qr-generator";
import { ReviewBannerGenerator } from "@/components/review/review-banner-generator";
import { Shell } from "@/components/shell";

// Nothing here reads data, so there is no session check beyond the one in proxy.ts.
export default function ReviewKitPage() {
  return (
    <Shell title="Review kit" description="Printable review banners and QR codes for a client's review link.">
      <ReviewBannerGenerator />
      <QrGenerator />
    </Shell>
  );
}
