"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { centredScroll, clampZoom, fieldZoom, fitZoom, isCompact } from "@/lib/tally/paper-zoom";

const FIELD = "input,select,textarea";
/** Tapping any of these isn't a tap on the blank part of the sheet. */
const CONTROL = `${FIELD},button,label,a,[data-zoom-pass]`;
/** How much the screen must shrink to count as the on-screen keyboard. */
const KEYBOARD_MIN = 120;
/** A field losing focus this soon after a tap on the sheet was that tap's doing, not the keyboard closing. */
const TAP_MS = 800;

const isField = (el: Element | null, within: Element | null): el is HTMLElement => !!el && !!within?.contains(el) && el.matches(FIELD);

/**
 * The paper sheet's zoom. It sits fitted to the screen width, and on a small
 * screen tapping a field zooms in on it, centred above the keyboard. It goes
 * back to fitted with Done, a tap on a blank part of the sheet or the keyboard
 * closing. Two-finger pinch and Ctrl + wheel still work.
 *
 * While fitted on a small screen the sheet's small buttons (same, +B, delete)
 * are too small to aim at, so a first tap only zooms in on them.
 */
export function usePaperZoom() {
  const [zoom, setZoomState] = useState(1);
  const [fit, setFit] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const fitRef = useRef(1);
  const naturalRef = useRef(0);
  /** To centre once the new zoom has been laid out. */
  const pendingRef = useRef<Element | null>(null);
  /** The last thing zoomed to, kept in view on the way back out. */
  const lastRef = useRef<Element | null>(null);
  const swallowRef = useRef<Element | null>(null);
  const downOnControlRef = useRef(false);
  const lastDownRef = useRef(0);
  const blurTimer = useRef(0);

  const apply = useCallback((z: number) => {
    zoomRef.current = z;
    setZoomState(z);
  }, []);

  const setZoom = useCallback((z: number) => apply(clampZoom(z, fitRef.current)), [apply]);

  /** Scrolls an element to the middle of the part of the sheet the keyboard leaves showing. */
  const centre = useCallback((el: Element, behavior: ScrollBehavior) => {
    const sc = scrollRef.current;
    if (!sc) return;
    const view = sc.getBoundingClientRect();
    const vv = window.visualViewport;
    const bottom = vv ? Math.min(view.bottom, vv.offsetTop + vv.height) : view.bottom;
    const hidden = Math.max(0, view.bottom - bottom);
    // Room to bring the last rows up above the keyboard.
    sc.style.paddingBottom = hidden ? `${hidden + 16}px` : "";
    const box = el.getBoundingClientRect();
    const sticky = el.closest("table")?.querySelector("th.sticky")?.getBoundingClientRect().width ?? 0;
    sc.scrollTo({
      top: centredScroll(sc.scrollTop, box.top - view.top, box.height, bottom - view.top),
      left: centredScroll(sc.scrollLeft, box.left - view.left, box.width, sc.clientWidth, sticky),
      behavior,
    });
  }, []);

  /** Zooms in on an element if the sheet is too small to read, and centres it. */
  const zoomTo = useCallback(
    (el: Element) => {
      lastRef.current = el;
      const next = fieldZoom(zoomRef.current, fitRef.current);
      if (next !== zoomRef.current) {
        pendingRef.current = el;
        apply(next);
      } else centre(el, "smooth");
    },
    [apply, centre],
  );

  /** Back to the whole sheet. */
  const release = useCallback(() => {
    const active = document.activeElement;
    if (isField(active, scrollRef.current)) active.blur();
    const sc = scrollRef.current;
    if (sc) sc.style.paddingBottom = "";
    if (lastRef.current?.isConnected) pendingRef.current = lastRef.current;
    lastRef.current = null;
    apply(fitRef.current);
  }, [apply]);

  useLayoutEffect(() => {
    const el = pendingRef.current;
    if (!el) return;
    pendingRef.current = null;
    centre(el, "auto");
  }, [zoom, centre]);

  // Fit to the width now and whenever it changes (turning the phone). Measured at
  // its own size, as browsers disagree on how the size of a zoomed element reads.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const sheet = sheetRef.current;
    if (!sc || !sheet) return;
    const measure = () => {
      if (zoomRef.current === 1) naturalRef.current = sheet.getBoundingClientRect().width;
      const next = fitZoom(sc.clientWidth, naturalRef.current);
      const wasFitted = zoomRef.current <= fitRef.current + 0.01;
      fitRef.current = next;
      setFit(next);
      if (wasFitted) apply(next);
      else if (zoomRef.current < next) apply(next);
    };
    measure();
    let width = sc.clientWidth;
    const ro = new ResizeObserver(() => {
      // The keyboard only changes the height.
      if (sc.clientWidth === width) return;
      width = sc.clientWidth;
      measure();
    });
    ro.observe(sc);
    return () => ro.disconnect();
  }, [apply]);

  // Borders don't shrink evenly with the zoom, so a fitted sheet can still come out
  // a few pixels too wide. Step down until it really fits.
  const settleFit = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc || zoomRef.current > fitRef.current + 0.01 || sc.scrollWidth <= sc.clientWidth) return;
    const next = fitZoom(sc.clientWidth, sc.scrollWidth / zoomRef.current);
    if (next >= zoomRef.current) return;
    fitRef.current = next;
    setFit(next);
    apply(next);
  }, [apply]);

  useLayoutEffect(() => {
    // Only once this zoom is on screen: until then the width is the old zoom's.
    if (zoom === zoomRef.current) settleFit();
  }, [zoom, settleFit]);

  // Keep the field above the keyboard as it opens, and zoom out when it closes,
  // including Android's back button, which closes it with the field still focused.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let open = false;
    const onResize = () => {
      const nowOpen = window.innerHeight - vv.height > KEYBOARD_MIN;
      const active = document.activeElement;
      if (isField(active, scrollRef.current) && isCompact(fitRef.current)) {
        if (open && !nowOpen) release();
        else centre(active, "auto");
      }
      open = nowOpen;
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [centre, release]);

  // Pinch and Ctrl + wheel, down to no smaller than the fitted sheet.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pinch: { dist: number; zoom: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { dist: dist(e.touches), zoom: zoomRef.current };
    };
    const onMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        setZoom(pinch.zoom * (dist(e.touches) / pinch.dist));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [setZoom]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const scrollProps = {
    onFocus(e: React.FocusEvent<HTMLDivElement>) {
      window.clearTimeout(blurTimer.current);
      if (isCompact(fitRef.current) && e.target.matches(FIELD)) zoomTo(e.target);
    },
    onBlur() {
      window.clearTimeout(blurTimer.current);
      // The keyboard's own Done button: the field lost focus with no tap on the sheet.
      blurTimer.current = window.setTimeout(() => {
        const fittedAlready = zoomRef.current <= fitRef.current + 0.01;
        const tapped = Date.now() - lastDownRef.current < TAP_MS;
        if (!fittedAlready && !tapped && !isField(document.activeElement, scrollRef.current)) release();
      }, 250);
    },
    onPointerDownCapture(e: React.PointerEvent<HTMLDivElement>) {
      const target = e.target as Element;
      lastDownRef.current = Date.now();
      downOnControlRef.current = !!target.closest(CONTROL);
      swallowRef.current = null;
      const fitted = zoomRef.current <= fitRef.current + 0.01;
      const button = target.closest("button");
      if (button && fitted && isCompact(fitRef.current) && !target.closest("[data-zoom-pass]")) {
        // Stops a hold-and-drag from starting; the click below does the zooming.
        swallowRef.current = button;
        e.stopPropagation();
      }
    },
    onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
      const el = swallowRef.current;
      swallowRef.current = null;
      // detail 0 is a keyboard press, which has already aimed at the button.
      if (!el || e.detail === 0) return;
      e.preventDefault();
      e.stopPropagation();
      zoomTo(el.closest("td") ?? el);
    },
    onClick(e: React.MouseEvent<HTMLDivElement>) {
      if (downOnControlRef.current || (e.target as Element).closest(CONTROL)) return;
      if (zoomRef.current > fitRef.current + 0.01) release();
    },
  };

  return { zoom, zoomed: zoom > fit + 0.01, zoomTo, release, scrollRef, sheetRef, scrollProps };
}
