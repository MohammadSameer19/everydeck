/**
 * Random decks.
 *
 * Two rules, enforced by the shape of this module:
 *
 *  1. Randomness is *never* used to compute an index. A random deck is
 *     always produced, then measured with deckToIndex. That keeps the
 *     deterministic path (index -> deck) the only path that produces a
 *     deck from a number, so a bug can never make a random deck unreproducible.
 *
 *  2. Every RNG is injectable. Tests and shareable seeds pass their own;
 *     only the default argument touches the real entropy source.
 *
 * Nothing here is cryptographically meaningful beyond "not obviously
 * biased". Rejection sampling keeps it uniform, which is what a shuffle
 * needs, but this is not a source of secrets.
 */

import { CARD_COUNT, IDENTITY_DECK } from "./cards";
import type { Deck } from "./deckMath";
import { TOTAL } from "./factorials";
import { assertValidDeck } from "./validation";

/** A source of uniformly distributed integers below a bound. */
export type RandomBelow = (bound: bigint) => bigint;

/**
 * Uniform integer in [0, bound), from `crypto.getRandomValues`, by
 * rejection sampling.
 *
 * Rejection is required: taking `randomBytes(k) mod bound` is biased
 * whenever bound does not divide 2^(8k), and 52! divides nothing.
 */
export const cryptoRandomBelow: RandomBelow = (bound) => {
  if (bound <= 0n)
    throw new RangeError(`randomBelow: bound must be positive, got ${bound}`);
  if (bound === 1n) return 0n;

  const bits = bound.toString(2).length;
  const byteLength = Math.ceil(bits / 8);
  const mask = (1n << BigInt(bits)) - 1n;

  for (;;) {
    const buffer = new Uint8Array(byteLength);
    crypto.getRandomValues(buffer);

    let value = 0n;
    for (const byte of buffer) value = (value << 8n) | BigInt(byte);
    value &= mask;

    if (value < bound) return value;
  }
};

/**
 * A deterministic, seedable stand-in for {@link cryptoRandomBelow}, built on
 * SplitMix64. Good enough for reproducible shuffles and tests; never used
 * for anything that needs unpredictability.
 */
export function seededRandomBelow(seed: bigint): RandomBelow {
  const MASK = (1n << 64n) - 1n;
  let state = seed & MASK;

  const next = (): bigint => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return (z ^ (z >> 31n)) & MASK;
  };

  return (bound) => {
    if (bound <= 0n)
      throw new RangeError(`randomBelow: bound must be positive, got ${bound}`);
    if (bound === 1n) return 0n;

    const bits = bound.toString(2).length;
    const byteLength = Math.ceil(bits / 8);
    const mask = (1n << BigInt(bits)) - 1n;

    for (;;) {
      let value = 0n;
      for (let i = 0; i < byteLength; i++)
        value = (value << 8n) | ((next() >> 32n) & 0xffn);
      value &= mask;
      if (value < bound) return value;
    }
  };
}

/** Fisher-Yates. Uniform over all n! permutations, and never mutates input. */
export function shuffle<T>(
  items: readonly T[],
  randomBelow: RandomBelow = cryptoRandomBelow
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Number(randomBelow(BigInt(i + 1)));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** A uniformly random deck. Independent of the current index by construction. */
export function randomDeck(randomBelow: RandomBelow = cryptoRandomBelow): Deck {
  const deck = shuffle(IDENTITY_DECK, randomBelow);
  assertValidDeck(deck);
  return deck;
}

/** A uniformly random index in [0, 52!). */
export function randomIndex(
  randomBelow: RandomBelow = cryptoRandomBelow
): bigint {
  return randomBelow(TOTAL);
}
