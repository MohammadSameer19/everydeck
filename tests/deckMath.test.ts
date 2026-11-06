import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CARD_COUNT,
  IDENTITY_DECK,
  cardCode,
  cardLabel,
  parseCardCode,
} from "@/lib/cards";
import { LAST_INDEX, TOTAL, factorial } from "@/lib/factorials";
import {
  cycleDecomposition,
  deckFromDigits,
  deckToIndex,
  indexToDeck,
  isIdentityDeck,
  lehmerDigits,
  permutationParity,
  type Deck,
} from "@/lib/deckMath";
import { DeckError } from "@/lib/validation";

/** A deterministic shuffle for building test decks — never production code. */
function seededDeck(seed: number): Deck {
  const deck: Deck = [...IDENTITY_DECK];
  let state = BigInt(seed) | 1n;
  for (let i = deck.length - 1; i > 0; i--) {
    state =
      (state * 6364136223846793005n + 1442695040888963407n) &
      ((1n << 64n) - 1n);
    const j = Number(state % BigInt(i + 1));
    const tmp = deck[i] as number;
    deck[i] = deck[j] as number;
    deck[j] = tmp;
  }
  return deck;
}

const validIndex = fc.bigInt({ min: 0n, max: LAST_INDEX });

const validDeck: fc.Arbitrary<Deck> = fc
  .array(fc.integer({ min: 0, max: CARD_COUNT - 1 }), {
    minLength: CARD_COUNT,
    maxLength: CARD_COUNT,
  })
  .map((cards) => {
    // Deduplicate then pad with the unused cards, producing a true
    // permutation without needing a shrinking generator.
    const used = [...new Set(cards)].slice(0, CARD_COUNT);
    const missing = (IDENTITY_DECK as number[]).filter(
      (c) => !used.includes(c)
    );
    return [...used, ...missing];
  });

describe("cards", () => {
  it("maps card IDs to compact codes and back", () => {
    for (let id = 0; id < CARD_COUNT; id++) {
      expect(parseCardCode(cardCode(id))).toBe(id);
      expect(parseCardCode(cardCode(id).toLowerCase())).toBe(id);
    }
  });

  it("names the canonical first and last cards", () => {
    expect(cardCode(0)).toBe("S2");
    expect(cardLabel(0)).toBe("2♠");
    expect(cardCode(51)).toBe("CA");
    expect(cardLabel(51)).toBe("A♣");
  });

  it("rejects junk codes instead of guessing", () => {
    expect(parseCardCode("")).toBeNull();
    expect(parseCardCode("S")).toBeNull();
    expect(parseCardCode("SX")).toBeNull();
    expect(parseCardCode("ZZ")).toBeNull();
    expect(parseCardCode("S1")).toBeNull();
  });
});

describe("indexToDeck", () => {
  it("puts the sorted deck at index 0", () => {
    expect(indexToDeck(0n)).toEqual([...IDENTITY_DECK]);
    expect(isIdentityDeck(indexToDeck(0n))).toBe(true);
  });

  it("puts the reversed deck at the last index", () => {
    const reversed = [...IDENTITY_DECK].reverse();
    expect(indexToDeck(LAST_INDEX)).toEqual(reversed);
  });

  it("always yields 52 distinct cards in range", () => {
    for (const k of [0n, 1n, 51n, 52n, 1_000_000n, factorial(26), LAST_INDEX]) {
      const deck = indexToDeck(k);
      expect(deck.length).toBe(CARD_COUNT);
      expect(new Set(deck).size).toBe(CARD_COUNT);
      expect(
        deck.every((c) => Number.isInteger(c) && c >= 0 && c < CARD_COUNT)
      ).toBe(true);
    }
  });

  it("changes only the tail at small indices — the 'gentle beginning'", () => {
    // The Lehmer digit at position 0 carries weight 51!, so the very first
    // card cannot move until index 51!, which is 1.55e66. We cannot sweep
    // up to it, so we check the boundary from both sides instead.
    const firstMoved = indexToDeck(factorial(51));
    expect(firstMoved[0]).not.toBe(0);
    expect(deckToIndex(firstMoved)).toBe(factorial(51));

    // Sample well below the boundary: the first card stays put.
    for (const k of [
      0n,
      1n,
      2n,
      1000n,
      1_000_000n,
      factorial(50) - 1n,
      factorial(50),
    ]) {
      expect(indexToDeck(k)[0], `index ${k}`).toBe(0);
    }

    // And the converse: any deck whose first card is not 2♠ lives at or
    // above 51!.
    for (const seed of [1, 2, 3, 4, 5]) {
      const deck = seededDeck(seed);
      if (deck[0] !== 0) {
        expect(deckToIndex(deck) >= factorial(51), `seed ${seed}`).toBe(true);
      }
    }
  });

  it("refuses indices outside the address space", () => {
    expect(() => indexToDeck(-1n)).toThrow(DeckError);
    expect(() => indexToDeck(TOTAL)).toThrow(DeckError);
    expect(() => indexToDeck(TOTAL * 2n)).toThrow(DeckError);
    try {
      indexToDeck(TOTAL);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as DeckError).code).toBe("RANGE");
    }
  });
});

describe("deckToIndex", () => {
  it("ranks the sorted deck 0 and the reversed deck 52!-1", () => {
    expect(deckToIndex([...IDENTITY_DECK])).toBe(0n);
    expect(deckToIndex([...IDENTITY_DECK].reverse())).toBe(LAST_INDEX);
  });

  it("rejects malformed decks with a specific reason", () => {
    const expectCode = (deck: unknown, code: string) => {
      try {
        deckToIndex(deck as Deck);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(DeckError);
        expect((err as DeckError).code).toBe(code);
      }
    };

    expectCode("not a deck", "NOT_A_DECK");
    expectCode([1, 2, 3], "INCOMPLETE");

    const duplicated = [...IDENTITY_DECK] as Deck;
    duplicated[0] = duplicated[1] as number;
    expectCode(duplicated, "DUPLICATE");

    const outOfRange = [...IDENTITY_DECK] as Deck;
    outOfRange[0] = 52;
    expectCode(outOfRange, "INVALID_CARD");

    const fractional = [...IDENTITY_DECK] as Deck;
    fractional[0] = 1.5;
    expectCode(fractional, "INVALID_CARD");
  });
});

describe("Lehmer code", () => {
  it("ranks with sum(digits[i] * (51 - i)!)", () => {
    for (const seed of [1, 7, 99, 12345, 987654321]) {
      const deck = seededDeck(seed);
      const digits = lehmerDigits(deck);

      expect(digits.length).toBe(CARD_COUNT);
      expect(digits[CARD_COUNT - 1]).toBe(0);

      let manual = 0n;
      for (let i = 0; i < CARD_COUNT; i++) {
        manual += BigInt(digits[i] as number) * factorial(CARD_COUNT - 1 - i);
      }
      expect(manual).toBe(deckToIndex(deck));
    }
  });

  it("digits are within their radix", () => {
    for (const seed of [2, 3, 4, 5, 6]) {
      const digits = lehmerDigits(seededDeck(seed));
      for (let i = 0; i < CARD_COUNT; i++) {
        expect(digits[i]).toBeGreaterThanOrEqual(0);
        expect(digits[i]).toBeLessThan(CARD_COUNT - i);
      }
    }
  });

  it("deckFromDigits inverts lehmerDigits", () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const deck = seededDeck(seed);
      expect(deckFromDigits(lehmerDigits(deck))).toEqual(deck);
    }
  });

  it("rejects out-of-radix digits", () => {
    const digits = lehmerDigits([...IDENTITY_DECK] as Deck);
    digits[0] = CARD_COUNT;
    expect(() => deckFromDigits(digits)).toThrow(RangeError);
    expect(() => deckFromDigits(digits.slice(1))).toThrow(RangeError);
  });
});

describe("the round-trip invariant", () => {
  it("deckToIndex(indexToDeck(k)) === k  (property)", () => {
    fc.assert(
      fc.property(validIndex, (k) => deckToIndex(indexToDeck(k)) === k),
      { numRuns: 400 }
    );
  });

  it("indexToDeck(deckToIndex(p)) === p  (property)", () => {
    fc.assert(
      fc.property(validDeck, (deck) => {
        const recovered = indexToDeck(deckToIndex(deck));
        return (
          recovered.length === deck.length &&
          recovered.every((c, i) => c === deck[i])
        );
      }),
      { numRuns: 400 }
    );
  });

  it("survives the very ends of the space", () => {
    for (const k of [0n, 1n, TOTAL - 2n, LAST_INDEX]) {
      expect(deckToIndex(indexToDeck(k))).toBe(k);
    }
  });

  it("distinguishes adjacent indices by exactly one swap", () => {
    for (const k of [0n, 1000n, 1_000_000_000_000n, LAST_INDEX - 1n]) {
      const a = indexToDeck(k);
      const b = indexToDeck(k + 1n);
      const differing = a.filter((c, i) => c !== b[i]).length;
      expect(differing, `index ${k}`).toBe(2);
    }
  });

  it("is injective across many random indices", () => {
    const seen = new Set<string>();
    for (let i = 0n; i < 2000n; i++) {
      const k = (i * 7_919_515_777_131n) % TOTAL;
      const deck = indexToDeck(k);
      const key = deck.join(",");
      expect(seen.has(key), `collision at ${k}`).toBe(false);
      seen.add(key);
    }
  });
});

describe("permutation structure", () => {
  it("the sorted deck is even, one big transposition is odd", () => {
    expect(permutationParity([...IDENTITY_DECK] as Deck)).toBe(0);

    const swapped = [...IDENTITY_DECK] as Deck;
    [swapped[0], swapped[1]] = [swapped[1] as number, swapped[0] as number];
    expect(permutationParity(swapped)).toBe(1);
  });

  it("decomposes the sorted deck into 52 fixed points", () => {
    const cycles = cycleDecomposition([...IDENTITY_DECK] as Deck);
    expect(cycles.length).toBe(CARD_COUNT);
    expect(cycles.every((c) => c.length === 1)).toBe(true);
  });

  it("every card belongs to exactly one cycle, and all cycles are covered", () => {
    for (const seed of [5, 55, 555, 5555]) {
      const deck = seededDeck(seed);
      const cycles = cycleDecomposition(deck);
      const members = cycles.flatMap((c) => c.members);

      expect(members.length).toBe(CARD_COUNT);
      expect(new Set(members).size).toBe(CARD_COUNT);
      expect(members.every((m) => m >= 0 && m < CARD_COUNT)).toBe(true);
    }
  });

  it("parity matches the number of even-length cycles minus one", () => {
    for (const seed of [8, 88, 888]) {
      const deck = seededDeck(seed);
      const cycles = cycleDecomposition(deck);
      const evenCycles = cycles.filter((c) => c.length % 2 === 0).length;
      // parity = (n - numberOfCycles) mod 2
      expect(permutationParity(deck)).toBe(
        ((CARD_COUNT - cycles.length) % 2) as 0 | 1
      );
      expect(evenCycles).toBeGreaterThanOrEqual(0);
    }
  });
});
