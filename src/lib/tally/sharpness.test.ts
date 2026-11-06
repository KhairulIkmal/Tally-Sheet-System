import { describe, expect, it } from "vitest";
import { SHARP, laplacianVariance, meanAbsDiff, nextSharp, toGrey } from "./sharpness";

const W = 64;
const H = 64;

/** A checkerboard: lots of hard edges, like a sharp label. */
function checker(cell: number): Uint8ClampedArray {
  const g = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? 230 : 20;
  return g;
}

/** A simple box blur, as an out-of-focus picture. */
function blur(src: Uint8ClampedArray, r: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const yy = Math.min(H - 1, Math.max(0, y + dy));
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          s += src[yy * W + xx];
          n++;
        }
      out[y * W + x] = s / n;
    }
  return out;
}

describe("sharpness", () => {
  it("is much higher for a sharp picture than a blurred one", () => {
    const sharp = laplacianVariance(checker(4), W, H);
    const soft = laplacianVariance(blur(checker(4), 3), W, H);
    expect(sharp).toBeGreaterThan(SHARP.floor * 10);
    expect(soft).toBeLessThan(sharp / 10);
  });

  it("is nil for a flat picture", () => {
    expect(laplacianVariance(new Uint8ClampedArray(W * H).fill(128), W, H)).toBe(0);
  });

  it("turns RGBA into grey", () => {
    expect([...toGrey(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))]).toEqual([255, 0]);
  });

  it("measures movement between frames", () => {
    const a = checker(4);
    expect(meanAbsDiff(a, a)).toBe(0);
    expect(meanAbsDiff(a, checker(5))).toBeGreaterThan(SHARP.still);
  });
});

describe("ready to snap", () => {
  const run = (frames: [number, number][]) => {
    let state = { peak: 0, run: 0 };
    let last;
    for (const [s, m] of frames) {
      last = nextSharp(state, s, m);
      state = last.state;
    }
    return last!;
  };

  it("after a few sharp, still frames in a row", () => {
    expect(run([[500, 1]]).ready).toBe(false);
    expect(
      run([
        [500, 1],
        [500, 1],
        [500, 1],
      ]).ready,
    ).toBe(true);
  });

  it("not while the phone is moving", () => {
    const r = run([
      [500, 1],
      [500, 1],
      [500, 20],
    ]);
    expect(r.ready).toBe(false);
    expect(r.reason).toBe("moving");
  });

  it("not when the picture has gone soft compared with a moment ago", () => {
    const r = run([
      [500, 1],
      [500, 1],
      [500, 1],
      [150, 1],
    ]);
    expect(r.ready).toBe(false);
    expect(r.reason).toBe("blurry");
  });

  it("never for a picture with no detail at all", () => {
    expect(
      run([
        [5, 0],
        [5, 0],
        [5, 0],
        [5, 0],
      ]).ready,
    ).toBe(false);
  });
});
