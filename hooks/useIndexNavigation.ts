"use client";

import { useEffect, useRef } from "react";

import { LAST_INDEX } from "@/lib/factorials";
import { clampIndex } from "@/lib/validation";

/**
 * Scroll and drag as index movement.
 *
 * One wheel notch — about 120px of travel, whatever the device reports as a
 * "line" — moves the index by exactly `step` arrangements. Sub-notch deltas
 * accumulate so a slow, precise scroll is not lost to rounding.
 *
 * ## Why this is on the window, not the deck
 *
 * An earlier version attached the listener to the deck element alone. That
 * was a mistake: the deck occupied only ~57% of the viewport height, so
 * scrolling over the header or the controls did nothing at all. It was worse
 * than that — in the grid layout the cards filled their band so the pointer
 * naturally landed inside it, but in the fan and pile layouts the deck sat
 * small in the middle of the band and the pointer landed outside, making it
 * look as though those two views had lost scroll entirely.
 *
 * So the whole surface drives the index, and instead we protect the regions
 * that genuinely need to scroll — the inspector's table, the named-deck
 * strip. If the wheel lands inside something that can actually scroll, we
 * leave it alone.
 */

/** Pixels of travel per wheel notch. */
const NOTCH_PX = 120;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    "input, button, a, select, textarea, [role='slider']"
  );
}

/**
 * True when the wheel is over something that can scroll, and so should.
 *
 * Walks up looking for an ancestor that has its own scrollbar *and* has
 * content beyond its box — checking `scrollHeight` matters, because an empty
 * scroll container would otherwise swallow every wheel event on the page.
 */
function isScrollableRegion(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  // Opt-out marker for anything known to scroll.
  if (target.closest("[data-scroll-region]")) return true;

  let node: HTMLElement | null = target.closest<HTMLElement>("*");
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function useIndexNavigation(
  onDelta: (update: (n: bigint) => bigint) => void,
  step: bigint
) {
  const callbackRef = useRef(onDelta);
  callbackRef.current = onDelta;

  const stepRef = useRef(step);
  stepRef.current = step;

  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let accumulated = 0;

    // Coalesce deltas into one index update per animation frame. Dragging
    // fast can fire dozens of wheel events between frames; running the unrank
    // once per frame instead of once per event is what keeps this at 60fps.
    const schedule = (pixels: number) => {
      accumulated += pixels;
      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const notches = Math.trunc(accumulated / NOTCH_PX);
        accumulated -= notches * NOTCH_PX;
        if (notches === 0) return;

        const delta = BigInt(notches) * stepRef.current;
        callbackRef.current((n) => clampIndex(n + delta));
      });
    };

    const onWheel = (e: WheelEvent) => {
      // Over something that scrolls: let it.
      if (isScrollableRegion(e.target)) return;
      // Over a control: the control owns the wheel.
      if (isInteractiveTarget(e.target)) return;

      e.preventDefault();
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; // lines, pages, px
      schedule(e.deltaY * scale);
    };

    let dragging = false;
    let lastTouchY = 0;

    const onTouchStart = (e: TouchEvent) => {
      dragging =
        e.touches.length === 1 &&
        !isInteractiveTarget(e.target) &&
        !isScrollableRegion(e.target);
      if (dragging) lastTouchY = e.touches[0]!.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) {
        dragging = false;
        return;
      }
      e.preventDefault();
      const y = e.touches[0]!.clientY;
      schedule(lastTouchY - y);
      lastTouchY = y;
    };

    const onTouchEnd = () => {
      dragging = false;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
}

/**
 * Keyboard navigation. Arrow keys move by the step; PageUp/PageDown jump
 * 100x; Home/End go to the very ends of the space.
 */
export function useIndexKeyboard(
  onChange: (update: (n: bigint) => bigint) => void,
  enabled: boolean
) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  return (e: KeyboardEvent) => {
    if (!enabled) return;
    if (isInteractiveTarget(e.target)) return;

    const apply = (update: (n: bigint) => bigint) => {
      e.preventDefault();
      callbackRef.current(update);
    };

    switch (e.key) {
      case "ArrowRight":
        apply((n) => clampIndex(n + 1n));
        break;
      case "ArrowLeft":
        apply((n) => clampIndex(n - 1n));
        break;
      case "PageDown":
        apply((n) => clampIndex(n + 100n));
        break;
      case "PageUp":
        apply((n) => clampIndex(n - 100n));
        break;
      case "Home":
        apply(() => 0n);
        break;
      case "End":
        apply(() => LAST_INDEX);
        break;
    }
  };
}
