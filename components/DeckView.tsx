"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Card from "./Card";
import { CARD_COUNT, cardLabel } from "@/lib/cards";
import type { Deck } from "@/lib/cards";
import {
  boundsFor,
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_BOX,
  layoutFor,
  type DeckBox,
  type LayoutView,
} from "@/lib/layouts";

/**
 * The deck, laid out and animated.
 *
 * ## Why CSS transforms and not a layout library
 *
 * There are exactly 52 elements and they never reparent, so the whole deck
 * is one absolutely-positioned canvas whose children are moved with
 * `transform`. Changing the index is a `transform` change, so the
 * compositor animates it without touching layout or paint — and switching
 * layouts animates too, because both are the same property.
 *
 * ## The two-layer card
 *
 * Each card is a *position* wrapper plus two children: a shadow plate that
 * never moves, and the face that lifts off it on hover. That is the point —
 * if the shadow moved and blurred with the card, hovering would read as the
 * card smearing rather than being picked up. Only the face is ever animated
 * relative to its own slot.
 *
 * ## Cards are keyed by card ID, not by position
 *
 * That is what lets a card *travel* from where it was to where it now is,
 * instead of two cards blinking in place.
 */

interface DeckViewProps {
  deck: Deck;
  view: LayoutView;
  /** Set false to render with no transitions. */
  animated?: boolean;
  /** Milliseconds of landing delay per card, for big jumps. 0 disables it. */
  stagger?: number;
  /** Slot to ring, e.g. the inspector row under the cursor. */
  highlightSlot?: number | null;
  onHoverSlot?: (slot: number | null) => void;
}

/** How far a hovered card rises off its shadow plate. */
const HOVER_LIFT = 7;

export default function DeckView({
  deck,
  view,
  animated = true,
  stagger = 0,
  highlightSlot = null,
  onHoverSlot,
}: DeckViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<DeckBox>(DEFAULT_BOX);
  const [scale, setScale] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);

  // The fan and the piles are shaped by the space they are given: a wide
  // screen gets two hands of 26, a phone gets four rows of 13. The choice is
  // made from the measured box, but the coordinates themselves stay on the
  // fixed logical canvas.
  const slots = useMemo(() => layoutFor(view, CARD_COUNT, box), [view, box]);
  const bounds = useMemo(() => boundsFor(slots), [slots]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const measure = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (w <= 0) return;

      setBox((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );

      // Fit whichever dimension runs out first. Scaling by width alone let
      // the deck grow past the space the chrome left it, so the bottom row
      // of cards sat underneath the ruler.
      setScale(
        h > 0 ? Math.min(w / bounds.width, h / bounds.height) : w / bounds.width
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bounds.width, bounds.height]);

  // Longhand only, deliberately. The `transition` shorthand resets
  // transition-delay to 0s, so setting `transitionDelay` alongside it in the
  // same style object is a conflict React warns about — and can silently
  // drop the stagger. Every transition below names its own properties.
  //
  // Note that `animated` gates the DURATION, not just the delay. Zeroing
  // only the delay leaves the cards sliding for 460ms either way, which
  // made the FX toggle do nothing at all.
  const move = (delay: string) => ({
    transitionProperty: "transform",
    transitionDuration: animated ? "460ms" : "0ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDelay: animated ? delay : "0ms",
  });

  // The hover lift still works with FX off — it just stops easing. The
  // feedback is useful; only the motion is not.
  const lift = {
    transitionProperty: "transform",
    transitionDuration: animated ? "170ms" : "0ms",
    transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)",
    transitionDelay: "0ms",
  };

  return (
    <div
      ref={frameRef}
      data-deck-frame=""
      className="relative h-full w-full select-none"
      aria-hidden="true"
    >
      {/* Centred with translate(-50%,-50%) and scaled from its own centre,
          rather than `mx-auto` + scale: a scale() grows a centred box to
          the right, pushing it off the edge while leaving a gap on the left. */}
      <div
        className="absolute top-1/2 left-1/2 origin-center"
        style={{
          width: bounds.width,
          height: bounds.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {deck.map((card, slot) => {
          const s = slots[slot]!;
          const isHovered = hovered === slot;
          const top = hovered === null || slot <= hovered;

          // Big jumps cascade: each card lands a beat after the one before
          // it, so the eye can follow the change instead of seeing 52
          // simultaneous cuts. Capped so the last card is never late.
          const delay =
            animated && stagger > 0
              ? `${Math.min(slot * stagger, Math.min(stagger * 14, 420))}ms`
              : "0ms";

          return (
            <div
              key={card}
              data-deck-card=""
              className="absolute top-0 left-0"
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                zIndex: isHovered ? 1000 : s.z,
                transform: `translate3d(${s.x + bounds.offsetX}px, ${s.y + bounds.offsetY}px, 0) rotate(${s.rotate}deg)`,
                ...move(delay),
              }}
              onPointerEnter={() => {
                setHovered(slot);
                onHoverSlot?.(slot);
              }}
              onPointerLeave={() => {
                setHovered((h) => (h === slot ? null : h));
                onHoverSlot?.(null);
              }}
            >
              {/* Shadow plate: fixed. Never lifted, never resized. */}
              <div
                className="bg-ink/[0.06] absolute inset-0 rounded-[6px]"
                style={{ filter: "blur(2px)", transform: "translateY(2px)" }}
              />

              {/* The face. Only this layer moves relative to its slot.
                  It rotates with the slot — counter-rotating it shifted the
                  corner index out from under the next card, which is what
                  made the middle of the old 52-card fan blank. */}
              <div
                className="absolute inset-0"
                style={{
                  transform: isHovered
                    ? `translateY(-${HOVER_LIFT}px)`
                    : "none",
                  ...lift,
                }}
              >
                <Card cardId={card} />
              </div>

              {/* Held-over cards stay in shadow until you commit to them. */}
              {highlightSlot === slot && (
                <div className="ring-accent pointer-events-none absolute inset-0 rounded-[6px] ring-2 ring-offset-2 ring-offset-transparent" />
              )}

              {isHovered && (
                <div
                  className="bg-ink text-paper pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap shadow-sm"
                  style={lift}
                >
                  #{slot} {cardLabel(card)}
                </div>
              )}

              {/* A dim veil over cards hidden behind the hovered one, so the
                  fan reads as depth rather than a flat pile. */}
              {hovered !== null && !top && (
                <div className="bg-paper/65 pointer-events-none absolute inset-0 rounded-[6px]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
