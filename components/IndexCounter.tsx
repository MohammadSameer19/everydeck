"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { formatIndex, formatScientific } from "@/lib/format";
import { TOTAL } from "@/lib/factorials";

/**
 * The current index, as a number you can edit in place.
 *
 * The number is 68 digits wide, so this is deliberately *not* a labelled
 * input with a border and a button next to it. It is a heading that becomes
 * its own input when clicked: same type, same position, no chrome
 * appearing.
 *
 * Sizing is the hard part. A `clamp()` in vw units is wrong here — the digit
 * count changes with the index, so "3" and "80,658,…,999" want wildly
 * different sizes. Instead we measure the available width and solve for the
 * font size that makes the current number fit.
 */

const MIN_FONT_PX = 9;
const MAX_FONT_PX = 34;

interface IndexCounterProps {
  index: bigint;
  onCommit: (index: bigint) => void;
  /** Rendered beside the number — usually the copy-link control. */
  action?: React.ReactNode;
  /** Widest label underneath; used as the width budget reference. */
  className?: string;
}

export default function IndexCounter({
  index,
  onCommit,
  action,
  className = "w-full",
}: IndexCounterProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [fontPx, setFontPx] = useState(MAX_FONT_PX);

  const columnRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLButtonElement | null>(null);

  const commit = () => {
    if (draft === null) return;
    const digits = draft.replace(/[^0-9]/g, "");
    setDraft(null);
    if (!digits) return;
    onCommit(BigInt(digits));
  };

  // Solve for the largest font size at which the number fits the column.
  useLayoutEffect(() => {
    const column = columnRef.current;
    const text = textRef.current;
    if (!column || !text) return;

    const fit = () => {
      // The number's own column, not the whole row: the named-deck strip
      // and the copy control sit beside it, and measuring the row would
      // overestimate the width and push the last digit under the scrollbar.
      const available = column.clientWidth;
      const textWidth = text.offsetWidth;
      if (available <= 0 || textWidth <= 0) return;

      // Current size -> what the same glyph run needs to fit 94% of the
      // column. The other 6% pays for the red № prefix, which sits outside
      // the measured button; solving against the full width would push the
      // last digit against the edge.
      const budget = available * 0.94;
      const currentSize = parseFloat(getComputedStyle(text).fontSize);
      setFontPx(
        Math.max(
          MIN_FONT_PX,
          Math.min(MAX_FONT_PX, (currentSize * budget) / textWidth)
        )
      );
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(column);
    return () => observer.disconnect();
  }, [index, draft]);

  return (
    <div className={`select-none ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* The label sits beside the number rather than above it. Two lines
            of chrome cost the deck ~15px of height at every viewport. */}
        <span className="text-muted hidden shrink-0 self-start pt-1 font-mono text-[9px] font-semibold tracking-[0.18em] uppercase sm:block">
          Arrangement
        </span>

        {/* min-w-0 + overflow-x-auto is the last-resort safety net: on a very
            narrow phone 68 digits cannot be shown at a legible size, and
            silently clipping them would be worse than letting them scroll. */}
        {/* On a phone the number takes the full row and the controls wrap
            underneath. Sharing the row left the 68-digit index with ~160px,
            so thirty of the digits were hidden behind a horizontal scroll.
            Full width fits all of them at a legible size. */}
        <div
          ref={columnRef}
          className="legible-num text-ink w-full min-w-0 overflow-x-auto font-serif font-medium tracking-tight [font-variant-numeric:tabular-nums] sm:w-auto sm:flex-1"
        >
          <div style={{ fontSize: fontPx }}>
            <span className="text-accent mr-1 align-baseline">№</span>

            {draft === null ? (
              <button
                ref={textRef}
                type="button"
                title="Click to type an index"
                onClick={() => setDraft(index.toString())}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDraft(null);
                }}
                className="hover:text-accent focus-visible:ring-accent/45 cursor-text appearance-none rounded-sm border-0 bg-transparent p-0 text-left font-[inherit] tracking-[inherit] whitespace-nowrap text-inherit [font-variant-numeric:inherit] [text-shadow:inherit] focus-visible:ring-2 focus-visible:outline-none"
              >
                {formatIndex(index)}
              </button>
            ) : (
              <input
                autoFocus
                inputMode="numeric"
                value={draft}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setDraft(null);
                }}
                aria-label="Deck index"
                className="w-full min-w-0 border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-inherit [font-variant-numeric:inherit] outline-none [text-shadow:inherit]"
              />
            )}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 pb-0.5 sm:ml-0">
          {action}
          {/* Scientific, not the full 68 digits: written out here it wraps
              into three lines and competes with the number it describes. */}
          <span
            className="text-muted font-mono text-[9px] tracking-[0.08em] whitespace-nowrap [font-variant-numeric:tabular-nums]"
            title={`of ${TOTAL.toString()} arrangements`}
          >
            of {formatScientific(TOTAL)}
          </span>
        </div>
      </div>
    </div>
  );
}
