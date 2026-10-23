"use client";

import { useEffect } from "react";

/**
 * iPhone Safari ignores user-scalable=no, so page pinch is stopped here as well,
 * and touch-action turns off double-tap zoom. A pinch on the paper sheet still zooms the sheet: its own
 * listener (usePaperZoom) runs first and handles it.
 */
export function NoBrowserZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const pinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "0"].includes(e.key)) e.preventDefault();
    };
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("touchmove", pinch, { passive: false });
    document.addEventListener("keydown", keys);
    document.addEventListener("wheel", wheel, { passive: false });
    // No double-tap zoom and no page pinch; scrolling still works.
    document.documentElement.style.touchAction = "pan-x pan-y";
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("touchmove", pinch);
      document.removeEventListener("keydown", keys);
      document.removeEventListener("wheel", wheel);
      document.documentElement.style.touchAction = "";
    };
  }, []);
  return null;
}
