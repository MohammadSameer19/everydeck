/**
 * Named shuffles, built from their definitions rather than from remembered
 * results.
 *
 * Each transform is a from-scratch implementation of a real card-handling
 * operation. `lib/patterns.ts` composes these into the named decks the app
 * jumps to, and verifies each one against an independent property — not
 * against a memorized index.
 */

import { CARD_COUNT, IDENTITY_DECK } from "./cards";
import type { Deck } from "./deckMath";
import { assertValidDeck } from "./validation";

/**
 * Out-shuffle (the one that leaves the top card alone): deal the deck into
 * two equal halves, then weave them together starting with the top card.
 *
 * Index 0 stays put, which makes it the classic "52 cards, 8 shuffles,
 * back in order" trick.
 */
export function outShuffle(deck: Deck): Deck {
  assertValidDeck(deck);
  if (deck.length % 2 !== 0)
    throw new RangeError("outShuffle: deck length must be even");

  const half = deck.length / 2;
  const out: number[] = new Array<number>(deck.length);
  let top = 0;
  let bottom = half;

  for (let i = 0; i < deck.length; i++) {
    out[i] = i % 2 === 0 ? (deck[top++] as number) : (deck[bottom++] as number);
  }
  return out;
}

/**
 * In-shuffle: the same weave, but starting with the second card. The top
 * card ends up at the bottom. 52 in-shuffles return the deck to order.
 */
export function inShuffle(deck: Deck): Deck {
  assertValidDeck(deck);
  if (deck.length % 2 !== 0)
    throw new RangeError("inShuffle: deck length must be even");

  const half = deck.length / 2;
  const out: number[] = new Array<number>(deck.length);
  let top = 0;
  let bottom = half;

  for (let i = 0; i < deck.length; i++) {
    out[i] = i % 2 === 0 ? (deck[bottom++] as number) : (deck[top++] as number);
  }
  return out;
}

/** Repeat a transform n times. Rejects negative n. */
export function repeat<T>(
  transform: (deck: Deck) => Deck,
  n: number
): (deck: Deck) => Deck {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`repeat: n must be a non-negative integer, got ${n}`);
  }
  return (deck) => {
    let current = deck;
    for (let i = 0; i < n; i++) current = transform(current);
    return current;
  };
}

/**
 * Mongean shuffle: cut the deck in half, then deal cards alternately from
 * the two halves onto the TOP of a new pile, so the last card dealt ends up
 * on top. This is what a real Mongean does, and it is genuinely distinct
 * from the Faro weaves: like the out-shuffle it has order 8, but it fixes
 * cards 17 and 34 rather than 0 and 51, so neither composes to the identity.
 */
export function mongeanShuffle(deck: Deck): Deck {
  assertValidDeck(deck);
  if (deck.length % 2 !== 0)
    throw new RangeError("mongeanShuffle: deck length must be even");

  const half = deck.length / 2;
  const out: number[] = new Array<number>(deck.length);

  for (let i = 0; i < deck.length; i++) {
    const card =
      i % 2 === 0
        ? (deck[i / 2] as number)
        : (deck[half + (i - 1) / 2] as number);
    out[deck.length - 1 - i] = card; // last dealt ends up on top
  }
  return out;
}

/**
 * Deal the deck into piles by position modulo the pile count, then stack
 * the piles back together. `piles = 1` is the identity; `piles = 2` puts
 * all even positions then all odd positions.
 */
export function dealAndStack(deck: Deck, piles: number): Deck {
  assertValidDeck(deck);
  if (!Number.isInteger(piles) || piles < 1 || piles > deck.length) {
    throw new RangeError(
      `dealAndStack: piles must be an integer in [1, ${deck.length}]`
    );
  }

  const out: number[] = new Array<number>(deck.length);
  let write = 0;
  for (let pile = 0; pile < piles; pile++) {
    for (let i = pile; i < deck.length; i += piles) {
      out[write++] = deck[i] as number;
    }
  }
  return out;
}

/**
 * Interleave the deck with its own reverse: card 0, card 51, card 1,
 * card 50, ... The most visually extreme deck that still stays reversible.
 */
export function mirrorInterleave(deck: Deck): Deck {
  assertValidDeck(deck);
  if (deck.length % 2 !== 0) {
    throw new RangeError("mirrorInterleave: deck length must be even");
  }

  const out: number[] = new Array<number>(deck.length);
  for (let i = 0; i < deck.length / 2; i++) {
    out[i * 2] = deck[i] as number;
    out[i * 2 + 1] = deck[deck.length - 1 - i] as number;
  }
  return out;
}

/** Alternate red and black cards, reds taken from the front of each pile. */
export function redBlackAlternating(deck: Deck): Deck {
  assertValidDeck(deck);

  const red = deck.filter((c) => isRedCard(c));
  const black = deck.filter((c) => !isRedCard(c));
  if (red.length !== black.length) {
    throw new RangeError(
      "redBlackAlternating: deck must have equal red and black halves"
    );
  }

  const out: number[] = new Array<number>(deck.length);
  const startWithRed = deck[0]! % 4 === 1 || deck[0]! % 4 === 2;
  let r = 0;
  let b = 0;
  for (let i = 0; i < deck.length; i++) {
    const wantRed = (i % 2 === 0) === startWithRed;
    out[i] = wantRed ? (red[r++] as number) : (black[b++] as number);
  }
  return out;
}

/** Group all cards of one suit together, in the given suit order. */
export function suitClustered(
  deck: Deck,
  suitOrder: readonly number[] = [0, 1, 2, 3]
): Deck {
  assertValidDeck(deck);

  const buckets: number[][] = [[], [], [], []];
  for (const card of deck) buckets[Math.floor(card / 13)]!.push(card);

  return suitOrder.flatMap((suit) => buckets[suit] as number[]);
}

function isRedCard(card: number): boolean {
  const suit = Math.floor(card / 13);
  return suit === 1 || suit === 2; // hearts, diamonds
}

/** Rotate the deck left by `n` positions. */
export function rotate(deck: Deck, n: number): Deck {
  assertValidDeck(deck);
  if (!Number.isInteger(n))
    throw new RangeError("rotate: n must be an integer");

  const len = deck.length;
  const shift = ((n % len) + len) % len;
  return [...deck.slice(shift), ...deck.slice(0, shift)];
}

/**
 * How many times a transform must be applied before the deck returns to its
 * starting order. Derived by simulation, never written down — see
 * `lib/patterns.ts` for why that distinction matters.
 */
function orderOf(transform: (deck: Deck) => Deck): number {
  const start = [...IDENTITY_DECK];
  let current = start;
  for (let i = 1; i <= CARD_COUNT * 100; i++) {
    current = transform(current);
    if (current.every((c, k) => c === start[k])) return i;
  }
  throw new Error(
    `shuffles: ${transform.name} has no order within ${CARD_COUNT * 100} steps`
  );
}

/** The card at the top of the deck after a perfect out-shuffle index. */
export function outShuffleOrder(): number {
  return orderOf(outShuffle);
}

/** The number of perfect out-shuffles that restore a 52-card deck: 8. */
export function inShuffleOrder(): number {
  return orderOf(inShuffle);
}

/** The number of Mongean shuffles that restore a 52-card deck: 8. */
export function mongeanOrder(): number {
  return orderOf(mongeanShuffle);
}
