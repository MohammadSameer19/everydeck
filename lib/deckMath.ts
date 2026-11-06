/**
 * The permutation core: the bijective map between a 226-bit integer and a
 * 52-card deck.
 *
 * This module is deliberately free of React, Next.js, and every
 * browser/DOM API. If it ever needs one, the design is wrong.
 *
 * ## The encoding
 *
 * A deck is a permutation p of 0..51. For each position i, let c_i be the
 * number of *still-unplaced* cards with an ID smaller than p_i — i.e. the
 * position of p_i within the remaining sorted list. Those digits are the
 * Lehmer code of the permutation, and they are a mixed-radix numeral with
 * radices 52, 51, ..., 2, 1:
 *
 *     rank(p) = sum over i of  c_i * (51 - i)!
 *
 * Because position 51 always has exactly one card left, c_51 is always 0
 * and its weight 0! never matters; the effective radices run 52 down to 2,
 * whose product is exactly 52!. The code is therefore a bijection, and
 * unranking is just reading the mixed-radix digits back out.
 *
 * ## Why this ordering
 *
 * Ranking the sorted deck as 0 means the low end of the index space is
 * *gentle*: index 1 only swaps the final two cards, index 51! is the first
 * index that can move the very first card. Walking the index in order
 * explores nearby decks first, which is what makes scroll navigation feel
 * sane. See docs in `lib/patterns.ts` for what that looks like in practice.
 *
 * ## The invariant
 *
 *     deckToIndex(indexToDeck(k)) === k            for all k in [0, 52!)
 *     indexToDeck(deckToIndex(p)) === p            for all p
 *
 * Everything else in this project is downstream of these two lines.
 */

import { CARD_COUNT, IDENTITY_DECK, type Deck } from "./cards";
import { lehmerWeight } from "./factorials";
import { assertValidDeck, assertValidIndex } from "./validation";

export type { Deck };

/**
 * The Lehmer code of a deck: `digits[i]` is how many still-unplaced cards
 * were smaller than `deck[i]` at the moment it was placed.
 *
 * Always exactly CARD_COUNT digits; `digits[CARD_COUNT - 1]` is always 0.
 */
export function lehmerDigits(deck: Deck): number[] {
  assertValidDeck(deck);

  const remaining: number[] = [...IDENTITY_DECK];
  const digits: number[] = new Array<number>(CARD_COUNT);

  for (let i = 0; i < CARD_COUNT; i++) {
    // `remaining` stays sorted ascending because we only ever remove, so
    // the index of the target *is* the count of smaller remaining cards.
    const pick = remaining.indexOf(deck[i] as number);
    digits[i] = pick;
    remaining.splice(pick, 1);
  }

  return digits;
}

/** Inverse of {@link lehmerDigits}. */
export function deckFromDigits(digits: readonly number[]): Deck {
  if (!Array.isArray(digits) || digits.length !== CARD_COUNT) {
    throw new RangeError(
      `deckFromDigits: expected ${CARD_COUNT} digits, got ${digits?.length}`
    );
  }

  const remaining: number[] = [...IDENTITY_DECK];
  const deck: number[] = new Array<number>(CARD_COUNT);

  for (let i = 0; i < CARD_COUNT; i++) {
    const pick = digits[i] as number;
    const radix = CARD_COUNT - i;
    if (!Number.isInteger(pick) || pick < 0 || pick >= radix) {
      throw new RangeError(
        `deckFromDigits: digit ${i} must be an integer in [0, ${radix - 1}], got ${pick}`
      );
    }
    deck[i] = remaining.splice(pick, 1)[0] as number;
  }

  return deck;
}

/**
 * Address of a deck: its position in the permutation space.
 *
 *   deckToIndex(indexToDeck(k)) === k
 */
export function deckToIndex(deck: Deck): bigint {
  assertValidDeck(deck);

  const remaining: number[] = [...IDENTITY_DECK];
  let index = 0n;

  for (let i = 0; i < CARD_COUNT; i++) {
    const pick = remaining.indexOf(deck[i] as number);
    remaining.splice(pick, 1);
    index += BigInt(pick) * lehmerWeight(i);
  }

  return index;
}

/**
 * The deck at a given index.
 *
 *   indexToDeck(deckToIndex(p)) === p
 *
 * Throws {@link DeckError} if `index` is outside [0, 52!).
 */
export function indexToDeck(index: bigint): Deck {
  assertValidIndex(index);

  const remaining: number[] = [...IDENTITY_DECK];
  const deck: number[] = new Array<number>(CARD_COUNT);
  let remainder = index;

  for (let i = 0; i < CARD_COUNT; i++) {
    const weight = lehmerWeight(i);
    const quotient = remainder / weight;
    remainder = remainder % weight;

    // The one legitimate Number() conversion in this project. `quotient`
    // is bounded by radix - 1, i.e. at most 51, so it cannot lose
    // precision no matter how large `index` is.
    const pick = Number(quotient);
    deck[i] = remaining.splice(pick, 1)[0] as number;
  }

  return deck;
}

/** How many cards from the end can vary at this index — see the module note. */
export function isIdentityDeck(deck: Deck): boolean {
  for (let i = 0; i < CARD_COUNT; i++) {
    if (deck[i] !== i) return false;
  }
  return true;
}

/** Parity of the permutation: 0 = even, 1 = odd. */
export function permutationParity(deck: Deck): 0 | 1 {
  let inversions = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      if ((deck[i] as number) > (deck[j] as number)) inversions++;
    }
  }
  return (inversions % 2) as 0 | 1;
}

export interface Cycle {
  /** Card IDs in traversal order, e.g. [7, 30, 12]. */
  members: number[];
  /** Always >= 1; a card in its original place is a 1-cycle. */
  length: number;
}

/**
 * Cycle decomposition: every deck is a set of disjoint cycles, and reading
 * them is often a clearer picture of what a deck *did* than the raw Lehmer
 * digits are.
 */
export function cycleDecomposition(deck: Deck): Cycle[] {
  assertValidDeck(deck);

  const seen = new Array<boolean>(CARD_COUNT).fill(false);
  const cycles: Cycle[] = [];

  for (let start = 0; start < CARD_COUNT; start++) {
    if (seen[start]) continue;

    const members: number[] = [];
    let current = start;
    while (!seen[current]) {
      seen[current] = true;
      members.push(current);
      current = deck[current] as number;
    }

    cycles.push({ members, length: members.length });
  }

  return cycles;
}
