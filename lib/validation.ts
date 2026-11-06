/**
 * Input validation. Everything reaching the math core from the outside
 * world — URL segments, typed input, localStorage — is untrusted and must
 * pass through here first.
 */

import { CARD_COUNT, type Deck } from "./cards";
import { LAST_INDEX, TOTAL } from "./factorials";

export type DeckErrorCode =
  | "RANGE" // index outside [0, 52!)
  | "MALFORMED" // unparseable, wrong length, illegal characters
  | "DUPLICATE" // same card listed twice
  | "INCOMPLETE" // some card from 0..51 is missing
  | "INVALID_CARD" // element is not an integer in [0, 52)
  | "NOT_A_DECK"; // not an array at all

export class DeckError extends Error {
  readonly code: DeckErrorCode;
  /** The offending value, when there is a sensible one to show the user. */
  readonly detail?: unknown;

  constructor(code: DeckErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "DeckError";
    this.code = code;
    this.detail = detail;
  }
}

/** True when `index` addresses a real deck. */
export function isValidIndex(index: bigint): boolean {
  return index >= 0n && index < TOTAL;
}

/** Clamp `index` into the addressable range. Never throws. */
export function clampIndex(index: bigint): bigint {
  if (index < 0n) return 0n;
  if (index > LAST_INDEX) return LAST_INDEX;
  return index;
}

/** Throwing counterpart of {@link isValidIndex}. */
export function assertValidIndex(index: bigint): void {
  if (typeof index !== "bigint") {
    throw new DeckError("MALFORMED", "Index must be a BigInt.", index);
  }
  if (index < 0n) {
    throw new DeckError(
      "RANGE",
      `Index ${index} is negative. Indices start at 0.`,
      index
    );
  }
  if (index > LAST_INDEX) {
    throw new DeckError(
      "RANGE",
      `Index ${index} is past the end of the address space (max ${LAST_INDEX}).`,
      index
    );
  }
}

/** Non-throwing structural check for a deck. */
export function isValidDeck(value: unknown): value is Deck {
  if (!Array.isArray(value) || value.length !== CARD_COUNT) return false;
  const seen = new Set<number>();
  for (const card of value) {
    if (typeof card !== "number" || !Number.isInteger(card)) return false;
    if (card < 0 || card >= CARD_COUNT) return false;
    if (seen.has(card)) return false;
    seen.add(card);
  }
  return true;
}

/** Throwing counterpart of {@link isValidDeck}, with a specific reason. */
export function assertValidDeck(value: unknown): asserts value is Deck {
  if (!Array.isArray(value)) {
    throw new DeckError(
      "NOT_A_DECK",
      "Deck must be an array of 52 card IDs.",
      value
    );
  }
  if (value.length !== CARD_COUNT) {
    throw new DeckError(
      "INCOMPLETE",
      `Deck must have exactly ${CARD_COUNT} cards, got ${value.length}.`,
      value.length
    );
  }

  const seen = new Set<number>();
  for (let i = 0; i < value.length; i++) {
    const card: unknown = value[i];
    if (typeof card !== "number" || !Number.isInteger(card)) {
      throw new DeckError(
        "INVALID_CARD",
        `Position ${i} is not an integer card ID.`,
        card
      );
    }
    if (card < 0 || card >= CARD_COUNT) {
      throw new DeckError(
        "INVALID_CARD",
        `Position ${i} holds card ID ${card}; valid IDs are 0-${CARD_COUNT - 1}.`,
        card
      );
    }
    if (seen.has(card)) {
      throw new DeckError(
        "DUPLICATE",
        `Card ${card} appears more than once.`,
        card
      );
    }
    seen.add(card);
  }
}

/** Narrow an unknown to a Deck without validating it. For pre-validated data. */
export function asDeck(value: number[]): Deck {
  return value;
}
