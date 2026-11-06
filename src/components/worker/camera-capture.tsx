"use client";

import { useEffect, useRef, useState } from "react";
import { Flashlight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { laplacianVariance, meanAbsDiff, nextSharp, shrinkGrey, toGrey, type SharpState } from "@/lib/tally/sharpness";

/** After this long without a sharp picture (a bare wall, poor light), the worker may snap anyway. */
const ANYWAY_AFTER_MS = 4000;
const CHECK_EVERY_MS = 120;
/** Width of the grey copy measured each check. */
const PROBE_W = 480;

type Status = "starting" | "moving" | "blurry" | "ok";

const HINT: Record<Status, string> = {
  starting: "Starting the camera…",
  moving: "Hold the phone still…",
  blurry: "Focusing… hold still",
  ok: "Sharp ✓ Take the photo",
};

/**
 * The app's own camera, for pallet photos: the shutter only turns on once the
 * picture is sharp and still, so a blurred photo can't be taken by mistake.
 * If the camera can't be opened here (permission refused, old phone), the
 * worker is offered the phone's own camera instead.
 */
export function CameraCapture({
  title,
  onCapture,
  onUsePhoneCamera,
  onClose,
}: {
  title: string;
  onCapture: (photo: Blob) => void;
  /** Called from a tap, so the phone's camera may open straight away. */
  onUsePhoneCamera: () => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [anyway, setAnyway] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [snapping, setSnapping] = useState(false);

  // Open the back camera.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean };
        // Keep refocusing as the phone moves, where the phone allows it.
        if (caps.focusMode?.includes("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        }
        if (caps.torch) setTorch(false);
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
      } catch (e) {
        if (!alive) return;
        const name = e instanceof DOMException ? e.name : "";
        setFailed(
          name === "NotAllowedError"
            ? "Camera permission was refused. Use the phone's camera instead, or allow the camera for this site."
            : "This phone's camera can't be opened here. Use the phone's camera instead.",
        );
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Measure sharpness and movement a few times a second.
  useEffect(() => {
    const probe = document.createElement("canvas");
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    let state: SharpState = { peak: 0, run: 0 };
    let prev: Uint8ClampedArray | null = null;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const v = videoRef.current;
      if (!ctx || !v || v.readyState < 2 || !v.videoWidth) return;
      // Most of the picture: the whole pallet is photographed, only the very edges are left out.
      const sw = v.videoWidth * 0.8;
      const sh = v.videoHeight * 0.8;
      const w = PROBE_W;
      const h = Math.max(1, Math.round((sh / sw) * w));
      probe.width = w;
      probe.height = h;
      ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
      const grey = toGrey(ctx.getImageData(0, 0, w, h).data);
      // Movement on a quarter-size copy: the camera's own grain doesn't count as a shaking hand.
      const small = shrinkGrey(grey, w, h, 4);
      const reading = nextSharp(state, laplacianVariance(grey, w, h), prev ? meanAbsDiff(prev, small) : 99);
      prev = small;
      state = reading.state;
      setStatus(reading.reason);
      setReady(reading.ready);
      if (Date.now() - started > ANYWAY_AFTER_MS) setAnyway(true);
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || snapping) return;
    setSnapping(true);
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    setSnapping(false);
    if (blob) onCapture(blob);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    const next = !torch;
    await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }).catch(() => {});
    setTorch(next);
  }

  const canSnap = ready || anyway;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: camera`}
      data-keep-zoom
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-base font-bold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the camera"
          className="grid size-11 place-items-center rounded-lg hover:bg-white/10"
        >
          <X className="size-6" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-base font-semibold">{failed}</p>
            <button type="button" onClick={onUsePhoneCamera} className="h-12 rounded-xl bg-white px-5 font-bold text-ink">
              Use the phone&apos;s camera
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" aria-label="Camera" />
            {/* The whole picture is the sign: a coloured edge, green when sharp, red when not. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 border-[6px] transition-colors duration-200",
                ready ? "border-success" : status === "starting" ? "border-transparent" : "border-danger/80",
              )}
            />
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap shadow-lg",
                ready ? "bg-success text-white" : status === "starting" ? "bg-black/60" : "bg-danger text-white",
              )}
            >
              {ready ? HINT.ok : HINT[status === "ok" ? "blurry" : status]}
            </div>
          </>
        )}
      </div>

      {!failed ? (
        <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid w-full grid-cols-3 items-center">
            <span />
            <button
              type="button"
              onClick={snap}
              disabled={!canSnap || snapping}
              aria-label={
                ready ? "Take the photo" : anyway ? "Take the photo anyway (not sharp)" : "Take the photo (waiting for a sharp picture)"
              }
              className={cn(
                "mx-auto grid size-[76px] place-items-center rounded-full border-4 transition-colors",
                ready ? "border-success" : canSnap ? "border-warning" : "border-white/30",
              )}
            >
              <span className={cn("size-[58px] rounded-full", ready ? "bg-white" : canSnap ? "bg-white/70" : "bg-white/20")} />
            </button>
            {torch !== null ? (
              <button
                type="button"
                onClick={toggleTorch}
                aria-pressed={torch}
                aria-label="Torch"
                className={cn("ml-auto grid size-12 place-items-center rounded-full", torch ? "bg-white text-ink" : "bg-white/15")}
              >
                <Flashlight className="size-6" />
              </button>
            ) : (
              <span />
            )}
          </div>
          {!ready && anyway ? (
            <span className="text-center text-xs font-semibold text-white/80">
              Not sharp yet. Move closer to the label, or use the torch. You can take it anyway.
            </span>
          ) : (
            <button type="button" onClick={onUsePhoneCamera} className="text-xs font-semibold text-white/60 underline">
              Use the phone&apos;s camera instead
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
