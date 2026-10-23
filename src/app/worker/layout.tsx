import type { Viewport } from "next";
import { NoBrowserZoom } from "@/components/worker/no-browser-zoom";

// The worker app zooms the paper sheet itself (paper-zoom.tsx). Pinching the whole
// page instead throws off the bars and the sheet on small phones, so it is locked here.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NoBrowserZoom />
      {children}
    </>
  );
}
