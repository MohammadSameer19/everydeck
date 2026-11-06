import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { CARD_COUNT, IDENTITY_DECK, cardCode } from "@/lib/cards";
import { deckToIndex, indexToDeck, type Deck } from "@/lib/deckMath";
import {
  NOTATION_LENGTH,
  deckToNotation,
  formatNotation,
  isValidNotation,
  notationToDeck,
} from "@/lib/notation";
import { DeckError } from "@/lib/validation";

describe("deckToNotation", () => {
  it("is 104 characters: 52 cards x 2", () => {
    expect(NOTATION_LENGTH).toBe(104);
    expect(deckToNotation([...IDENTITY_DECK] as Deck).length).toBe(104);
    expect(deckToNotation(indexToDeck(12345678901234567890n)).length).toBe(104);
  });

  it("writes the sorted deck as ascending ranks within each suit", () => {
    expect(deckToNotation([...IDENTITY_DECK] as Deck)).toBe(
      "S2S3S4S5S6S7S8S9STSJSQSKSA" +
        "H2H3H4H5H6H7H8H9HTHJHQHKHA" +
        "D2D3D4D5D6D7D8D9DTDJDQDKDA" +
        "C2C3C4C5C6C7C8C9CTCJCQCKCA"
    );
  });

  it("contains each of the 52 codes exactly once", () => {
    const notation = deckToNotation(indexToDeck(987654321n));
    const codes = notation.match(/../g)!;
    expect(codes.length).toBe(CARD_COUNT);
    expect(new Set(codes).size).toBe(CARD_COUNT);
    for (let id = 0; id < CARD_COUNT; id++) {
      expect(codes).toContain(cardCode(id));
    }
  });
});

describe("notationToDeck", () => {
  it("round-trips notation losslessly", () => {
    for (const k of [0n, 1n, 999n, 123456789012345678901234567890n]) {
      const deck = indexToDeck(k);
      expect(notationToDeck(deckToNotation(deck))).toEqual(deck);
    }
  });

  it("is case-insensitive", () => {
    const notation = deckToNotation([...IDENTITY_DECK] as Deck);
    expect(notationToDeck(notation.toLowerCase())).toEqual([...IDENTITY_DECK]);
  });

  it("agrees with the index — notation and index name the same deck", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 1_000_000_000n }), (k) => {
        const deck = indexToDeck(k);
        return deckToIndex(notationToDeck(deckToNotation(deck))) === k;
      }),
      { numRuns: 150 }
    );
  });

  it("rejects the wrong length", () => {
    expect(() => notationToDeck("S2H3")).toThrow(DeckError);
    expect(() => notationToDeck("")).toThrow(DeckError);
    expect(() => notationToDeck("A".repeat(103))).toThrow(/exactly 104/);
    expect(() => notationToDeck("A".repeat(105))).toThrow(/exactly 104/);
  });

  it("rejects illegal characters and names the position", () => {
    const notation = deckToNotation([...IDENTITY_DECK] as Deck);
    const broken = notation.slice(0, 10) + "ZZ" + notation.slice(12);
    try {
      notationToDeck(broken);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DeckError);
      expect((err as DeckError).code).toBe("MALFORMED");
      expect((err as Error).message).toMatch(/Card 6/);
    }
  });

  it("rejects a repeated card", () => {
    const notation =
      "S2" + deckToNotation([...IDENTITY_DECK] as Deck).slice(0, 102);
    try {
      notationToDeck(notation);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as DeckError).code).toBe("DUPLICATE");
      expect((err as Error).message).toMatch(/Card 2/);
    }
  });

  it("isValidNotation never throws", () => {
    expect(isValidNotation(deckToNotation([...IDENTITY_DECK] as Deck))).toBe(
      true
    );
    expect(isValidNotation("nope")).toBe(false);
    expect(isValidNotation("")).toBe(false);
    expect(isValidNotation(undefined as unknown as string)).toBe(false);
    expect(isValidNotation(null as unknown as string)).toBe(false);
  });
});

describe("formatNotation", () => {
  it("groups for display without changing meaning", () => {
    const notation = deckToNotation([...IDENTITY_DECK] as Deck);
    const formatted = formatNotation(notation);
    expect(formatted.replace(/\s/g, "")).toBe(notation);
    expect(formatted.split(" ")[0]).toBe("S2S3");
  });
});
