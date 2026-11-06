"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, RefreshCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PalletPhoto } from "@/lib/tally/draft";
import { getPhoto, putPhoto, shrinkPhoto } from "./photo-store";
import { CameraCapture } from "./camera-capture";

/** Over everything: outside the paper sheet, which is zoomed and would shrink it too. */
function OnTop({ children }: { children: React.ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

/** An object URL for a stored photo, released when it changes or the component goes. */
export function usePhotoUrl(key: string | undefined): string | null {
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    let made: string | null = null;
    void getPhoto(key).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl({ key, url: made });
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [key]);
  return key && url?.key === key ? url.url : null;
}

/**
 * Takes a pallet photo with the app's own camera, which only lets the worker snap once
 * the picture is sharp. Where that camera can't open, the phone's camera is used
 * (`capture`; a photo from the gallery isn't evidence of today).
 */
export function useTakePhoto(keyPrefix: string, onTaken: (photo: PalletPhoto) => void, title = "Pallet photo") {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);

  async function save(photo: Blob) {
    setBusy(true);
    setError("");
    try {
      const blob = await shrinkPhoto(photo);
      const takenAt = new Date().toISOString();
      const key = `${keyPrefix}/${Date.now()}`;
      await putPhoto(key, blob);
      onTaken({ key, takenAt });
    } catch {
      setError("Couldn't save the photo on this phone. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      aria-hidden
      tabIndex={-1}
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) await save(file);
      }}
    />
  );
  const input = (
    <>
      {fileInput}
      {camera ? (
        <OnTop>
          <CameraCapture
            title={title}
            onClose={() => setCamera(false)}
            onCapture={(blob) => {
              setCamera(false);
              void save(blob);
            }}
            onUsePhoneCamera={() => {
              setCamera(false);
              inputRef.current?.click();
            }}
          />
        </OnTop>
      ) : null}
    </>
  );
  const canUseOwnCamera = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
  return { open: () => (canUseOwnCamera() ? setCamera(true) : inputRef.current?.click()), input, busy, error };
}

/** The photo full size, with Retake and Remove. Over the sheet, which keeps its zoom. */
export function PhotoViewer({
  photoKey,
  title,
  onRetake,
  onRemove,
  onClose,
}: {
  photoKey: string;
  title: string;
  onRetake: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const url = usePhotoUrl(photoKey);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={title} data-keep-zoom>
      <div className="flex items-center justify-between px-3 py-2 text-white">
        <span className="text-base font-bold">{title}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-lg hover:bg-white/10">
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a photo stored on the phone (blob: URL)
          <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-white/70">Loading…</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onRemove}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-white/40 font-bold text-white"
        >
          <Trash2 className="size-5" /> Remove
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-ink"
        >
          <RefreshCw className="size-5" /> Retake
        </button>
      </div>
    </div>
  );
}

/**
 * The photo of one pallet in the step-by-step: Add photo, or a thumbnail to
 * open, retake or remove. Optional.
 */
export function PalletPhotoField({
  photo,
  keyPrefix,
  palletNo,
  onChange,
}: {
  photo: PalletPhoto | undefined;
  keyPrefix: string;
  palletNo: number;
  onChange: (photo: PalletPhoto | undefined) => void;
}) {
  const [viewing, setViewing] = useState(false);
  const take = useTakePhoto(
    keyPrefix,
    (p) => {
      setViewing(false);
      onChange(p);
    },
    `Pallet ${palletNo}`,
  );
  const thumb = usePhotoUrl(photo?.key);
  return (
    <div className="flex flex-col gap-1">
      {take.input}
      {photo ? (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label={`Pallet ${palletNo} photo. Tap to view`}
            className="size-14 flex-none overflow-hidden rounded-[10px] border-[1.5px] border-field bg-canvas"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- a photo stored on the phone (blob: URL)
              <img src={thumb} alt="" className="size-full object-cover" />
            ) : null}
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-bold text-success">Photo added</span>
            <span className="text-xs font-medium text-muted">Not printed. The office can view it.</span>
          </div>
          <button
            type="button"
            onClick={take.open}
            disabled={take.busy}
            className="flex h-11 flex-none items-center gap-1.5 rounded-[10px] border-[1.5px] border-field px-3 text-sm font-bold text-primary"
          >
            <RefreshCw className="size-4" /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={take.open}
          disabled={take.busy}
          className="flex h-12 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-field text-[15px] font-bold text-primary disabled:opacity-60"
        >
          <Camera className="size-5" /> {take.busy ? "Saving photo…" : "Add photo (optional)"}
        </button>
      )}
      {take.error ? <span className="text-xs font-semibold text-danger">{take.error}</span> : null}
      {viewing && photo ? (
        <OnTop>
          <PhotoViewer
            photoKey={photo.key}
            title={`Pallet ${palletNo}`}
            onClose={() => setViewing(false)}
            onRetake={take.open}
            onRemove={() => {
              setViewing(false);
              onChange(undefined);
            }}
          />
        </OnTop>
      ) : null}
    </div>
  );
}

/** The camera button in a paper-view row: takes a photo, or opens the one taken. */
export function PalletPhotoButton({
  photo,
  keyPrefix,
  palletNo,
  onChange,
}: {
  photo: PalletPhoto | undefined;
  keyPrefix: string;
  palletNo: number;
  onChange: (photo: PalletPhoto | undefined) => void;
}) {
  const [viewing, setViewing] = useState(false);
  const take = useTakePhoto(
    keyPrefix,
    (p) => {
      setViewing(false);
      onChange(p);
    },
    `Pallet ${palletNo}`,
  );
  return (
    <>
      {take.input}
      <button
        type="button"
        aria-label={photo ? `Pallet ${palletNo}: view photo` : `Pallet ${palletNo}: take a photo`}
        title={photo ? "View photo" : "Take a photo (optional)"}
        disabled={take.busy}
        onClick={() => (photo ? setViewing(true) : take.open())}
        className={cn("relative grid size-9 place-items-center rounded-md hover:bg-primary-soft", photo ? "text-success" : "text-muted")}
      >
        <Camera className="size-4" />
        {photo ? <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full bg-success" /> : null}
      </button>
      {viewing && photo ? (
        <OnTop>
          <PhotoViewer
            photoKey={photo.key}
            title={`Pallet ${palletNo}`}
            onClose={() => setViewing(false)}
            onRetake={take.open}
            onRemove={() => {
              setViewing(false);
              onChange(undefined);
            }}
          />
        </OnTop>
      ) : null}
    </>
  );
}
