import { describe, expect, it } from "vitest";
import { centredScroll, clampZoom, fieldZoom, fitZoom, isCompact, ZOOM_MAX, ZOOM_MIN } from "./paper-zoom";

describe("fitZoom", () => {
  it("fits a phone, rounding down so nothing scrolls sideways", () => {
    expect(fitZoom(390, 924)).toBe(0.42);
    expect(fitZoom(360, 1108)).toBe(0.32);
  });

  it("never goes above the sheet's own size", () => {
    expect(fitZoom(1400, 924)).toBe(1);
  });

  it("stays at its own size before anything can be measured", () => {
    expect(fitZoom(0, 924)).toBe(1);
    expect(fitZoom(390, 0)).toBe(1);
  });

  it("keeps to the lowest level on a very narrow view", () => {
    expect(fitZoom(100, 1108)).toBe(ZOOM_MIN);
  });
});

describe("clampZoom", () => {
  it("keeps within the limits", () => {
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(0.3, 0.42)).toBe(0.42);
  });
});

describe("fieldZoom", () => {
  it("zooms a small sheet in to reading size", () => {
    expect(isCompact(0.42)).toBe(true);
    expect(fieldZoom(0.42, 0.42)).toBe(1);
  });

  it("keeps a level already zoomed further", () => {
    expect(fieldZoom(1.4, 0.42)).toBe(1.4);
  });

  it("leaves a sheet that is already readable alone", () => {
    expect(isCompact(0.9)).toBe(false);
    expect(fieldZoom(0.9, 0.9)).toBe(0.9);
  });
});

describe("centredScroll", () => {
  it("puts the item in the middle of the view", () => {
    // Item 500px down, 40 tall, 400 view: its centre (520) goes to 200.
    expect(centredScroll(0, 500, 40, 400)).toBe(320);
  });

  it("works from the current scroll", () => {
    expect(centredScroll(100, 400, 40, 400)).toBe(320);
  });

  it("centres in what the sticky column leaves visible", () => {
    expect(centredScroll(0, 500, 100, 400, 48)).toBe(326);
  });

  it("lines a too-wide item up after the sticky column", () => {
    expect(centredScroll(50, 20, 900, 400, 48)).toBe(22);
  });

  it("doesn't scroll before the start", () => {
    expect(centredScroll(0, 10, 40, 400)).toBe(0);
  });
});
