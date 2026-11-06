/**
 * Is the camera picture sharp enough to snap? Measured on a small grey copy of
 * the middle of each frame:
 *  - sharpness: the variance of the Laplacian (edges stand out when in focus
 *    and still; blur from focus or a moving hand flattens them);
 *  - movement: how much the picture changed since the last frame.
 * A scene's texture changes how high the sharpness can go, so it is compared
 * with the best seen lately as well as with a floor.
 */

/** Variance of the 4-neighbour Laplacian of a grey image (one byte per pixel). */
export function laplacianVariance(grey: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = grey[i - width] + grey[i + width] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Mean absolute difference between two grey images of the same size. */
export function meanAbsDiff(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let d = 0;
  for (let i = 0; i < n; i++) d += Math.abs(a[i] - b[i]);
  return d / n;
}

/** RGBA pixels to grey (Rec. 601 luma). */
export function toGrey(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  return out;
}

/** A grey image shrunk by averaging each n x n block. */
export function shrinkGrey(grey: Uint8ClampedArray, width: number, height: number, n: number): Uint8ClampedArray {
  const w = Math.floor(width / n);
  const h = Math.floor(height / n);
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) s += grey[(y * n + dy) * width + x * n + dx];
      out[y * w + x] = s / (n * n);
    }
  return out;
}

export const SHARP = {
  /** Below this nothing counts as sharp, however flat the scene. */
  floor: 30,
  /** Turning green: within this share of the best seen lately, and no more movement than this. */
  ofPeak: 0.55,
  still: 9,
  /** Staying green: a hand's natural shake or a slightly softer frame doesn't turn it red. */
  keepOfPeak: 0.35,
  keepStill: 16,
  /** Frames in a row that must pass before the shutter turns on. */
  frames: 2,
  /** Bad frames in a row that turn it red again once green. */
  dropAfter: 3,
} as const;

export interface SharpState {
  /** Best sharpness seen lately; eases down so a lucky frame doesn't set the bar for good. */
  peak: number;
  /** Frames in a row that passed. */
  run: number;
  /** Green now. */
  ready?: boolean;
  /** Bad frames in a row while green. */
  misses?: number;
}

export interface SharpReading {
  state: SharpState;
  ready: boolean;
  /** For the on-screen hint. */
  reason: "ok" | "moving" | "blurry";
}

/**
 * One frame's reading: sharpness and movement since the last frame. Turning green
 * takes a couple of good frames; once green it holds through a little shake and only
 * goes red after a few clearly bad frames, so it doesn't flicker in the hand.
 */
export function nextSharp(prev: SharpState, sharpness: number, movement: number): SharpReading {
  const peak = Math.max(sharpness, prev.peak * 0.94);
  const green = !!prev.ready;
  const moving = movement > (green ? SHARP.keepStill : SHARP.still);
  const blurry = sharpness < SHARP.floor || sharpness < peak * (green ? SHARP.keepOfPeak : SHARP.ofPeak);
  const bad = moving || blurry;
  const reason = moving ? "moving" : blurry ? "blurry" : "ok";
  if (green) {
    const misses = bad ? (prev.misses ?? 0) + 1 : 0;
    const ready = misses < SHARP.dropAfter;
    return { state: { peak, run: ready ? prev.run + 1 : 0, ready, misses: ready ? misses : 0 }, ready, reason: ready ? "ok" : reason };
  }
  const run = bad ? 0 : prev.run + 1;
  const ready = run >= SHARP.frames;
  return { state: { peak, run, ready, misses: 0 }, ready, reason };
}
