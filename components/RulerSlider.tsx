"use client";

import { useState } from "react";

import { NAMED_DECKS } from "@/lib/patterns";
import { indexToPosition, positionToIndex, sliderStep } from "@/lib/sliderMap";
import { formatIndex, formatScientific } from "@/lib/format";

/**
 * The ruler: coarse navigation across the whole space.
 *
 * A slider cannot address 52! positions. It addresses *whereabouts*, and the
 * honest thing is to say so on the control itself — hence the tick labels
 * and the footnote saying what one tick is worth.
 *
 * Drawn as a hairline scale straight onto the paper. No floating panel: the
 * ruler is a measuring mark, not a card.
 *
 * The named-deck markers sit on the same ruler, which is the point: they are
 * other addresses in the same space, not a separate list.
 */

const RESOLUTION = 1_000_000;

const TICK_COUNT = 80;
const MAJOR_EVERY = 20;

interface RulerSliderProps {
  index: bigint;
  onChange: (index: bigint) => void;
  showPatterns?: boolean;
}

/**
 * Patterns sharing an address get stacked into lanes.
 *
 * This is not cosmetic. In the natural Lehmer ordering the whole low end of
 * the space is one neighbourhood, so "New deck", "Perfect Faro x8" and
 * "Mongean x8" are *literally the same deck* at index 0, and a dozen more
 * crowd into the first thousand. Without lanes they render as one unreadable
 * blob at the left edge.
 */
const COLLISION_EPSILON = 0.006;

/**
 * How high to stack each marker, in the same order as the input array.
 *
 * The lane is the number of neighbours within the collision radius, so a
 * marker alone at its address sits on the track and a crowded one climbs.
 * Deeper stacks are capped: the ruler only reserves so much height above
 * the track, and a marker that cannot be separated is still reachable from
 * the named-deck strip below.
 */
function laneAssignment(patterns: readonly { position: number }[]): number[] {
  return patterns.map((p) => {
    const crowded = patterns.filter(
      (q) => Math.abs(q.position - p.position) < COLLISION_EPSILON
    ).length;
    return Math.min(crowded - 1, 4);
  });
}

const LABELS: { pos: number; text: string }[] = [
  { pos: 0, text: "0" },
  { pos: 0.25, text: "2.0×10⁶⁷" },
  { pos: 0.5, text: "4.0×10⁶⁷" },
  { pos: 0.75, text: "6.0×10⁶⁷" },
  { pos: 1, text: "8.1×10⁶⁷" },
];

export default function RulerSlider({
  index,
  onChange,
  showPatterns = true,
}: RulerSliderProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const position = indexToPosition(index);
  const step = sliderStep();

  return (
    <div className="border-rule border-t pt-8">
      <div className="relative h-9">
        <input
          type="range"
          min={0}
          max={RESOLUTION}
          step={1}
          value={Math.round(position * RESOLUTION)}
          aria-label="Position in the address space"
          onChange={(e) =>
            onChange(positionToIndex(Number(e.target.value) / RESOLUTION))
          }
          className="peer absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
            const major = i % MAJOR_EVERY === 0;
            return (
              <div
                key={i}
                className={
                  "absolute bottom-0 -translate-x-1/2 " +
                  (major ? "bg-muted h-[14px] w-px" : "bg-rule h-[7px] w-px")
                }
                style={{ left: `${(i / TICK_COUNT) * 100}%` }}
              />
            );
          })}
          <div className="bg-rule absolute bottom-0 h-px w-full" />
        </div>

        <div
          className="bg-ink peer-focus-visible:ring-accent/45 peer-focus-visible:ring-offset-paper pointer-events-none absolute bottom-0 h-7 w-[2px] -translate-x-1/2 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
          style={{ left: `${position * 100}%` }}
        />

        {showPatterns &&
          laneAssignment(NAMED_DECKS).map((lane, i) => {
            const p = NAMED_DECKS[i]!;
            return (
              <button
                key={p.name}
                type="button"
                title={`${p.name} — index ${formatIndex(p.index)}`}
                aria-label={`Jump to ${p.name}`}
                onClick={() => onChange(p.index)}
                onMouseEnter={() => setHovered(p.name)}
                onMouseLeave={() => setHovered(null)}
                className="group absolute z-20 -translate-x-1/2 cursor-pointer touch-auto"
                style={{ left: `${p.position * 100}%`, top: -lane * 7 }}
              >
                <span className="bg-accent ring-paper block h-[6px] w-[6px] rotate-45 ring-1 transition-transform group-hover:scale-125" />
                <span
                  className={
                    "bg-ink text-paper pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-medium whitespace-nowrap shadow-sm transition-opacity " +
                    (hovered === p.name
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100")
                  }
                >
                  {p.name}
                </span>
              </button>
            );
          })}
      </div>

      <div className="text-muted pointer-events-none relative mt-1 h-4 font-mono text-[9px] tracking-[0.04em] [font-variant-numeric:tabular-nums] select-none">
        {LABELS.map((l) => (
          <span
            key={l.pos}
            className="absolute"
            style={
              l.pos === 0
                ? { left: 0 }
                : l.pos === 1
                  ? { right: 0 }
                  : { left: `${l.pos * 100}%`, transform: "translateX(-50%)" }
            }
          >
            {l.text}
          </span>
        ))}
      </div>

      {/* Say out loud what the ruler cannot do. */}
      <div className="text-muted mt-0.5 mb-1 font-mono text-[9px] tracking-[0.04em] [font-variant-numeric:tabular-nums]">
        One Tick ≈ {formatScientific(step)} Arrangements
      </div>
    </div>
  );
}
