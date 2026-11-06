"use client";

import { useMemo } from "react";

import { cardCode, cardLabel } from "@/lib/cards";
import type { Deck } from "@/lib/cards";
import {
  cycleDecomposition,
  lehmerDigits,
  permutationParity,
} from "@/lib/deckMath";
import { factorial } from "@/lib/factorials";
import { formatIndex, formatScientific } from "@/lib/format";

/**
 * The mathematical inspector.
 *
 * The point of Every Deck is that the deck is *addressable*, and this is
 * where that stops being a slogan. It shows the Lehmer code the index is
 * actually made of, position by position: which digit was read, what it
 * selected out of the remaining cards, and what that was worth.
 *
 * Every number here comes from the same code the renderer used, so if the
 * explanation and the deck ever disagreed, the panel would be visibly wrong
 * rather than subtly wrong.
 *
 * It slides over the deck rather than pushing the page down, because the
 * page no longer scrolls — the deck owns the viewport.
 */

interface PermutationInspectorProps {
  deck: Deck;
  index: bigint;
  onHoverSlot: (slot: number | null) => void;
}

export default function PermutationInspector({
  deck,
  index,
  onHoverSlot,
}: PermutationInspectorProps) {
  const digits = useMemo(() => lehmerDigits(deck), [deck]);
  const parity = useMemo(() => permutationParity(deck), [deck]);
  const cycles = useMemo(() => cycleDecomposition(deck), [deck]);

  // Replay the unranking to show, for each position, the pool of cards the
  // digit chose from. This *is* the algorithm, not a description of it.
  const rows = useMemo(() => {
    const remaining = Array.from({ length: deck.length }, (_, i) => i);
    return digits.map((digit, position) => {
      const poolSize = remaining.length;
      const chosen = remaining.splice(digit, 1)[0]!;
      const weight = factorial(deck.length - 1 - position);
      return {
        position,
        digit,
        weight,
        contribution: BigInt(digit) * weight,
        chosen,
        poolSize,
      };
    });
  }, [digits, deck.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted mb-3 font-serif text-[12px] leading-relaxed">
        A deck ordering is a permutation, and a permutation can be written as a{" "}
        <strong className="text-ink font-medium">mixed-radix number</strong>. At
        each position we write down{" "}
        <em>how many still-unplaced cards were smaller</em> than the one we
        chose. That digit, times that position&rsquo;s factorial weight, is its
        contribution. Sum them and you have the index.
      </p>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat
          label="index"
          value={
            index > 9_999_999n ? formatScientific(index) : formatIndex(index)
          }
          title={formatIndex(index)}
        />
        <Stat label="parity" value={parity === 0 ? "even" : "odd"} />
        <Stat
          label="cycles"
          value={`${cycles.length}, longest ${Math.max(...cycles.map((c) => c.length))}`}
        />
      </div>

      <div
        className="border-rule bg-raised min-h-0 flex-1 overflow-y-auto border"
        data-scroll-region
      >
        <table className="w-full text-left font-mono text-[10px] [font-variant-numeric:tabular-nums]">
          <thead className="bg-raised text-muted sticky top-0">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">#</th>
              <th className="px-2.5 py-1.5 font-medium">digit</th>
              <th className="px-2.5 py-1.5 font-medium">from</th>
              <th className="px-2.5 py-1.5 font-medium">card</th>
              <th className="px-2.5 py-1.5 text-right font-medium">
                contribution
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.position}
                onMouseEnter={() => onHoverSlot(row.position)}
                onMouseLeave={() => onHoverSlot(null)}
                className="border-rule hover:bg-accent-soft/60 cursor-default border-t transition-colors"
              >
                <td className="text-muted px-2.5 py-1">{row.position}</td>
                <td className="text-accent px-2.5 py-1 font-medium">
                  {row.digit}
                </td>
                <td className="text-muted px-2.5 py-1">{row.poolSize}</td>
                <td className="text-ink px-2.5 py-1">
                  {cardLabel(row.chosen)}{" "}
                  <span className="text-muted/60">{cardCode(row.chosen)}</span>
                </td>
                {/* 51 x 51! is 68 digits. Written out it makes the table
                    three times wider than the panel; the magnitude is what
                    this column is for, and the exact value is in the title. */}
                <td
                  className="text-muted px-2.5 py-1 text-right"
                  title={formatIndex(row.contribution)}
                >
                  {row.contribution > 9_999_999n
                    ? formatScientific(row.contribution)
                    : formatIndex(row.contribution)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted mt-3 shrink-0 font-serif text-[11px] leading-relaxed">
        The last digit is always <code className="text-accent">0</code> — by
        then one card is left, so there is nothing to choose between. That is
        why the effective radices run 52 down to 2, and why the space is exactly
        52!.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="border-rule min-w-0 border px-2.5 py-1.5">
      <div className="text-muted text-[8px] font-semibold tracking-[0.16em] uppercase">
        {label}
      </div>
      <div
        className="text-ink mt-0.5 truncate font-mono text-[11px]"
        title={title ?? value}
      >
        {value}
      </div>
    </div>
  );
}
