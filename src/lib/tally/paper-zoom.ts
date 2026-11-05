/** Sizing for the worker's paper sheet: fitted to the screen, zoomed in on the field being filled. */

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 1.6;
/** The sheet's own size, where its text is comfortable to read and tap. */
const READING_ZOOM = 1;
/** Fitted smaller than this, the sheet is too small to fill in without zooming in. */
const COMPACT_BELOW = 0.85;

export function clampZoom(zoom: number, min: number = ZOOM_MIN): number {
  return Math.min(ZOOM_MAX, Math.max(min, Math.round(zoom * 100) / 100));
}

/** The level at which the whole sheet fits the width available; never larger than its own size. */
export function fitZoom(available: number, natural: number): number {
  if (available <= 0 || natural <= 0) return 1;
  // Rounded down: rounding up would leave a sliver of sideways scroll.
  return clampZoom(Math.floor(Math.min(1, available / natural) * 100) / 100);
}

export function isCompact(fit: number): boolean {
  return fit < COMPACT_BELOW;
}

/** The level for filling in a field. Already zoomed further by hand stays as it is. */
export function fieldZoom(current: number, fit: number): number {
  return isCompact(fit) ? Math.max(current, READING_ZOOM) : current;
}

/**
 * Where to scroll one axis so an item sits in the middle of the view. Positions
 * are relative to the view's start; `covered` is what sticks over the start of
 * the view. An item too big to fit lines up with the start instead.
 */
export function centredScroll(scroll: number, itemStart: number, itemSize: number, viewSize: number, covered = 0): number {
  const room = viewSize - covered;
  const target = itemSize >= room ? scroll + itemStart - covered : scroll + itemStart + itemSize / 2 - (viewSize + covered) / 2;
  return Math.max(0, target);
}
