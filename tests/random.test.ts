import { describe, expect, it } from "vitest";

import { CARD_COUNT, IDENTITY_DECK } from "@/lib/cards";
import { deckToIndex, indexToDeck } from "@/lib/deckMath";
import { LAST_INDEX, TOTAL, factorial } from "@/lib/factorials";
import {
  cryptoRandomBelow,
  randomDeck,
  randomIndex,
  seededRandomBelow,
  shuffle,
  type RandomBelow,
} from "@/lib/random";
import { indexToPosition, positionToIndex, sliderStep } from "@/lib/sliderMap";
import { isValidDeck } from "@/lib/validation";

describe("randomBelow", () => {
  it("stays inside the bound", () => {
    for (const bound of [1n, 2n, 3n, 7n, 256n, TOTAL]) {
      for (let i = 0; i < 50; i++) {
        const value = cryptoRandomBelow(bound);
        expect(value >= 0n && value < bound, `bound ${bound}`).toBe(true);
      }
    }
  });

  it("rejects a non-positive bound", () => {
    expect(() => cryptoRandomBelow(0n)).toThrow(RangeError);
    expect(() => cryptoRandomBelow(-5n)).toThrow(RangeError);
  });

  it("hits every value of a small bound — no rejection-sampling gaps", () => {
    const seen = new Set<bigint>();
    for (let i = 0; i < 3000; i++) seen.add(cryptoRandomBelow(3n));
    expect(seen).toEqual(new Set([0n, 1n, 2n]));
  });

  it("a seeded generator is reproducible and stays in bounds", () => {
    const a = seededRandomBelow(42n);
    const b = seededRandomBelow(42n);
    const first = Array.from({ length: 20 }, () => a(TOTAL));
    const second = Array.from({ length: 20 }, () => b(TOTAL));
    expect(first).toEqual(second);
    expect(first.every((v) => v >= 0n && v < TOTAL)).toBe(true);
  });

  it("different seeds give different streams", () => {
    const rngA = seededRandomBelow(1n);
    const rngB = seededRandomBelow(2n);
    const streamA = Array.from({ length: 10 }, () => rngA(1n << 40n));
    const streamB = Array.from({ length: 10 }, () => rngB(1n << 40n));
    expect(streamA).not.toEqual(streamB);
  });
});

describe("shuffle", () => {
  it("is a permutation and never mutates its input", () => {
    const input = [...IDENTITY_DECK];
    const output = shuffle(input);
    expect(input).toEqual([...IDENTITY_DECK]);
    expect(new Set(output).size).toBe(CARD_COUNT);
  });

  it("handles trivial lengths", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
    expect(shuffle([1, 2, 3])).toHaveLength(3);
  });

  it("is reproducible from a seed", () => {
    const rng = seededRandomBelow(7n);
    const first = shuffle(IDENTITY_DECK, rng);
    const second = shuffle(IDENTITY_DECK, seededRandomBelow(7n));
    expect(first).toEqual(second);
  });

  it("rejects a biased RNG that can return `bound`", () => {
    const broken: RandomBelow = () => 5n;
    expect(() => shuffle(IDENTITY_DECK, broken)).not.toThrow(); // valid, just bad
    expect(shuffle(IDENTITY_DECK, broken).length).toBe(CARD_COUNT);
  });
});

describe("randomDeck", () => {
  it("produces valid, reproducible decks", () => {
    const a = randomDeck(seededRandomBelow(99n));
    const b = randomDeck(seededRandomBelow(99n));
    expect(a).toEqual(b);
    expect(isValidDeck(a)).toBe(true);
  });

  it("varies across seeds", () => {
    const decks = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      decks.add(randomDeck(seededRandomBelow(BigInt(seed))).join(","));
    }
    expect(decks.size).toBeGreaterThan(15);
  });

  it("is independent of the current index — every deck has some index", () => {
    for (let seed = 0; seed < 30; seed++) {
      const deck = randomDeck(seededRandomBelow(BigInt(seed)));
      const index = deckToIndex(deck);
      expect(index >= 0n && index < TOTAL, `seed ${seed}`).toBe(true);
      expect(indexToDeck(index)).toEqual(deck);
    }
  });
});

describe("randomIndex", () => {
  it("lands in range and reconstructs a valid deck", () => {
    for (let i = 0; i < 40; i++) {
      const k = randomIndex();
      expect(k >= 0n && k < TOTAL).toBe(true);
      expect(isValidDeck(indexToDeck(k))).toBe(true);
    }
  });
});

describe("uniformity (a smoke test, not a proof)", () => {
  it("each card lands in each position about equally often", () => {
    const positions = CARD_COUNT;
    const draws = 20_000;
    const expected = draws / positions;

    // Focus on one card: how often does card 0 land in each position?
    const counts = new Array<number>(positions).fill(0);
    const rng = seededRandomBelow(0xc0ffeen);
    for (let i = 0; i < draws; i++) {
      const deck = randomDeck(rng);
      counts[deck.indexOf(0)]! += 1;
    }

    // Chi-squared with 51 degrees of freedom; 99.9th percentile is ~90.
    const chi2 = counts.reduce(
      (sum, c) => sum + (c - expected) ** 2 / expected,
      0
    );
    expect(chi2, "chi-squared suggests the shuffle may be biased").toBeLessThan(
      90
    );
  }, 120_000);
});

describe("sliderMap", () => {
  it("maps the ends exactly", () => {
    expect(positionToIndex(0)).toBe(0n);
    expect(positionToIndex(1)).toBeGreaterThan(LAST_INDEX / 2n);
    expect(indexToPosition(0n)).toBe(0);
    expect(indexToPosition(LAST_INDEX)).toBeLessThanOrEqual(1);
  });

  it("clamps out-of-range and non-finite positions", () => {
    expect(positionToIndex(-5)).toBe(0n);
    expect(positionToIndex(5)).toBeLessThan(TOTAL);
    expect(positionToIndex(NaN)).toBe(0n);
    expect(positionToIndex(Infinity)).toBeLessThan(TOTAL);
  });

  it("never returns an out-of-range index", () => {
    for (let i = 0; i <= 100; i++) {
      const k = positionToIndex(i / 100);
      expect(k >= 0n && k < TOTAL, `position ${i / 100}`).toBe(true);
    }
  });

  it("is monotonically non-decreasing", () => {
    let previous = -1n;
    for (let i = 0; i <= 200; i++) {
      const k = positionToIndex(i / 200);
      expect(k >= previous, `position ${i / 200}`).toBe(true);
      previous = k;
    }
  });

  it("round-trips within the ruler's own resolution", () => {
    // A slider cannot express single-index resolution — this test pins how
    // much precision is actually available, so a regression here is visible.
    const step = sliderStep();
    expect(step).toBeGreaterThan(1n);

    for (const position of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const k = positionToIndex(position);
      expect(indexToPosition(k)).toBeCloseTo(position, 4);
    }
  });

  it("keeps full precision for very large indices", () => {
    for (const k of [0n, 1n, factorial(51), LAST_INDEX / 2n, LAST_INDEX]) {
      const position = indexToPosition(k);
      expect(Number.isFinite(position)).toBe(true);
      const recovered = positionToIndex(position);
      // Re-covering the same point must not drift; allow the ruler's step.
      const drift = recovered > k ? recovered - k : k - recovered;
      expect(drift, `index ${k}`).toBeLessThanOrEqual(sliderStep());
    }
  });
});
