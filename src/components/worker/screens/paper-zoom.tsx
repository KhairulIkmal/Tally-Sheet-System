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
const GLIDE_MS = 280;

/** A zoom change waiting to be laid out: where `el` is on screen now, to glide from. */
interface PendingZoom {
  el: Element;
  from: DOMRect;
  fromZoom: number;
  /** Bring `el` to the middle of the view at the new zoom. */
  centre: boolean;
}

const isField = (el: Element | null, within: Element | null): el is HTMLElement => !!el && !!within?.contains(el) && el.matches(FIELD);

/**
 * The paper sheet's zoom. It sits fitted to the screen width, and on a small
 * screen tapping a field glides in on it, centred above the keyboard. It goes
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
  /** Wraps the sheet: moved and scaled for the glide. Holds no zoom, which would scale the movement too. */
  const glideRef = useRef<HTMLDivElement>(null);
  const glideAnim = useRef<Animation | null>(null);
  const zoomRef = useRef(1);
  const fitRef = useRef(1);
  const naturalRef = useRef(0);
  const pendingRef = useRef<PendingZoom | null>(null);
  /** The last thing zoomed to, kept in view on the way back out. */
  const lastRef = useRef<Element | null>(null);
  const swallowRef = useRef<Element | null>(null);
  const downOnControlRef = useRef(false);
  /** When a finger last came down or lifted on the sheet. */
  const lastDownRef = useRef(0);
  /** A finger is on the sheet: a drag closing the keyboard mustn't zoom out under it. */
  const heldRef = useRef(false);
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
      // Already on the way to a new zoom (a row, then its first field): just change where to.
      const waiting = pendingRef.current;
      if (waiting) {
        pendingRef.current = { el, from: el.getBoundingClientRect(), fromZoom: waiting.fromZoom, centre: true };
        return;
      }
      const next = fieldZoom(zoomRef.current, fitRef.current);
      if (next !== zoomRef.current) {
        pendingRef.current = { el, from: el.getBoundingClientRect(), fromZoom: zoomRef.current, centre: true };
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
    const last = lastRef.current?.isConnected ? lastRef.current : null;
    const el = last ?? sheetRef.current;
    if (el) pendingRef.current = { el, from: el.getBoundingClientRect(), fromZoom: zoomRef.current, centre: !!last };
    lastRef.current = null;
    apply(fitRef.current);
  }, [apply]);

  useLayoutEffect(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    glideAnim.current?.cancel();
    if (p.centre) centre(p.el, "auto");
    const box = glideRef.current;
    if (!box || zoom === p.fromZoom || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The new layout is in place. Start it drawn exactly where the old one was and let
    // it settle: only a transform, so the phone doesn't lay the sheet out on every frame.
    const scale = p.fromZoom / zoom;
    const origin = box.getBoundingClientRect();
    const to = p.el.getBoundingClientRect();
    const x = p.from.left - origin.left - scale * (to.left - origin.left);
    const y = p.from.top - origin.top - scale * (to.top - origin.top);
    glideAnim.current = box.animate([{ transform: `translate(${x}px, ${y}px) scale(${scale})` }, { transform: "none" }], {
      duration: GLIDE_MS,
      easing: "cubic-bezier(.2, .8, .2, 1)",
    });
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
    // The glide's wrapper, which the glide doesn't scale: the scroller's own width would count the glide.
    const laidOut = glideRef.current?.parentElement?.getBoundingClientRect().width ?? 0;
    if (!sc || zoomRef.current > fitRef.current + 0.01 || laidOut <= sc.clientWidth + 0.5) return;
    const next = fitZoom(sc.clientWidth, laidOut / zoomRef.current);
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
      // The room made for the keyboard goes with it (a drag closes it and stays zoomed).
      if (!nowOpen && scrollRef.current) scrollRef.current.style.paddingBottom = "";
      if (isField(active, scrollRef.current) && isCompact(fitRef.current)) {
        if (open && !nowOpen) release();
        else centre(active, "smooth");
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

  // Anywhere: a finger dragged off the sheet still lifts.
  useEffect(() => {
    const lift = () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      lastDownRef.current = Date.now();
    };
    window.addEventListener("pointerup", lift, true);
    window.addEventListener("pointercancel", lift, true);
    return () => {
      window.removeEventListener("pointerup", lift, true);
      window.removeEventListener("pointercancel", lift, true);
    };
  }, []);

  const scrollProps = {
    onFocus(e: React.FocusEvent<HTMLDivElement>) {
      window.clearTimeout(blurTimer.current);
      if (isCompact(fitRef.current) && e.target.matches(FIELD)) zoomTo(e.target);
    },
    onBlur() {
      window.clearTimeout(blurTimer.current);
      // The keyboard's own Done button: the field lost focus with no tap on the sheet.
      // Judged now, not when the timer runs: a delete confirm may hold the timer up for a long while.
      const fromTouch = heldRef.current || Date.now() - lastDownRef.current < TAP_MS;
      if (fromTouch) return;
      blurTimer.current = window.setTimeout(() => {
        const fittedAlready = zoomRef.current <= fitRef.current + 0.01;
        if (!fittedAlready && !isField(document.activeElement, scrollRef.current)) release();
      }, 250);
    },
    onPointerDownCapture(e: React.PointerEvent<HTMLDivElement>) {
      const target = e.target as Element;
      lastDownRef.current = Date.now();
      heldRef.current = true;
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

  return { zoom, zoomed: zoom > fit + 0.01, zoomTo, release, scrollRef, sheetRef, glideRef, scrollProps };
}
