/**
 * Mapping the address space onto a 0..1 slider.
 *
 * 52! is 226 bits wide. A native range input gives you at most a few
 * thousand addressable positions, so the slider cannot mean "index". It
 * means "where in the space are you", and the index is derived from that
 * with a fixed-point multiply in BigInt.
 *
 *     index = floor(round(position * 10^15) * 52! / 10^15)
 *
 * Doing the multiply in BigInt is the whole point. Doing it in float
 * would collapse ~112 of the 226 bits.
 *
 * A log scale is deliberately NOT used. It looks appealing for spaces this
 * large, but it makes equal screen distances mean unequal index distances
 * in a way that is confusing to actually use, and it makes the low end
 * (where decks differ most visibly) cramped. Linear was tried and kept.
 */

import { LAST_INDEX, TOTAL } from "./factorials";
import { clampIndex } from "./validation";

/**
 * Fixed-point denominator, used in BOTH directions.
 *
 * These have to match. An earlier version used 10^15 to go position->index
 * and 10^6 to go back, so a round-trip through the ruler silently lost nine
 * orders of magnitude — a test caught it. One scale, one resolution.
 *
 * 10^15 is near the limit: a double carries 53 bits, so integers below
 * ~9.0e15 are exact, and 10^15 leaves headroom for the multiply itself.
 */
const SCALE = 10n ** 15n;

/** The same value as a float, for the multiply operand. */
const SCALE_NUM = 1e15;

/** Slider position in [0, 1] -> index in [0, 52!). Clamps out-of-range input. */
export function positionToIndex(position: number): bigint {
  if (!Number.isFinite(position)) return 0n;
  const p = Math.min(Math.max(position, 0), 1);
  return clampIndex((BigInt(Math.round(p * SCALE_NUM)) * TOTAL) / SCALE);
}

/** Index in [0, 52!) -> slider position in [0, 1]. */
export function indexToPosition(index: bigint): number {
  const clamped = clampIndex(index);
  // The quotient is in [0, 10^15), which a double represents exactly.
  return Number((clamped * SCALE) / TOTAL) / SCALE_NUM;
}

/**
 * The index step one full sweep of the ruler corresponds to. The ruler
 * cannot express single-index resolution, and this is the number that says
 * so out loud — useful for labelling the ruler honestly.
 */
export function sliderStep(): bigint {
  return TOTAL / SCALE;
}
