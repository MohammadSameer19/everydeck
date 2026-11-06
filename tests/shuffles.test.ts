import { describe, expect, it } from "vitest";

import { CARD_COUNT, IDENTITY_DECK, isRed } from "@/lib/cards";
import type { Deck } from "@/lib/deckMath";
import {
  dealAndStack,
  inShuffle,
  inShuffleOrder,
  mirrorInterleave,
  mongeanOrder,
  mongeanShuffle,
  outShuffle,
  outShuffleOrder,
  redBlackAlternating,
  repeat,
  rotate,
  suitClustered,
} from "@/lib/shuffles";
import { DeckError } from "@/lib/validation";

const identity = (): Deck => [...IDENTITY_DECK];
const isPermutation = (d: number[]) => new Set(d).size === CARD_COUNT;

describe("outShuffle", () => {
  it("leaves the top and bottom cards in place", () => {
    const out = outShuffle(identity());
    expect(out[0]).toBe(0);
    expect(out[CARD_COUNT - 1]).toBe(CARD_COUNT - 1);
    expect(isPermutation(out)).toBe(true);
  });

  it("weaves the two halves together", () => {
    const half = CARD_COUNT / 2;
    expect(outShuffle(identity())[1]).toBe(half);
    expect(outShuffle(identity())[2]).toBe(1);
    expect(outShuffle(identity())[3]).toBe(half + 1);
  });

  it("has order 8 on a 52-card deck", () => {
    expect(outShuffleOrder()).toBe(8);
    expect(repeat(outShuffle, 8)(identity())).toEqual(identity());
  });

  it("is not order 7 — the classic near-miss", () => {
    const seven = repeat(outShuffle, 7)(identity());
    expect(seven).not.toEqual(identity());
    // Seven is *almost* there: it leaves only the two fixed cards correct,
    // so 50 of 52 positions are wrong. This is why 8, not 7, is the trick.
    expect(seven.filter((c, i) => c !== i).length).toBe(50);
  });

  it("rejects decks that are not 52 cards", () => {
    // assertValidDeck runs before the even-length guard, so a short deck is
    // reported as an invalid deck rather than an odd one.
    expect(() => outShuffle([0, 1, 2] as unknown as Deck)).toThrow(DeckError);
  });
});

describe("inShuffle", () => {
  it("moves both ends — that is what makes it an 'in' shuffle", () => {
    const out = inShuffle(identity());
    expect(out[0]).toBe(CARD_COUNT / 2); // bottom half's first card comes up top
    expect(out[CARD_COUNT - 1]).toBe(CARD_COUNT / 2 - 1); // top half's last card goes to the bottom
    expect(out[1]).toBe(0); // the old top card is now second
    expect(isPermutation(out)).toBe(true);
  });

  it("is a single 52-cycle, so its order is 52", () => {
    expect(inShuffleOrder()).toBe(52);
    expect(repeat(inShuffle, inShuffleOrder())(identity())).toEqual(identity());
    // And 51 is not enough.
    expect(repeat(inShuffle, 51)(identity())).not.toEqual(identity());
  });
});

describe("mongeanShuffle", () => {
  it("deals onto the top of a new pile", () => {
    const out = mongeanShuffle(identity());
    expect(out[0]).toBe(CARD_COUNT - 1); // last dealt card ends up on top
    expect(out[CARD_COUNT - 1]).toBe(0); // first dealt card ends up on the bottom
    expect(isPermutation(out)).toBe(true);
  });

  it("fixes cards 17 and 34, where the faro fixes 0 and 51", () => {
    const mongean = mongeanShuffle(identity());
    const faro = outShuffle(identity());
    expect(mongean[17]).toBe(17);
    expect(mongean[34]).toBe(34);
    expect(faro[17]).not.toBe(17);
    expect(mongean).not.toEqual(faro);
  });

  it("is not the inverse of the out-shuffle", () => {
    // Both have order 8 and the same cycle structure, but they fix
    // different cards, so neither composes to the identity.
    expect(mongeanShuffle(outShuffle(identity()))).not.toEqual(identity());
    expect(outShuffle(mongeanShuffle(identity()))).not.toEqual(identity());
  });

  it("has order 8 on a 52-card deck", () => {
    expect(mongeanOrder()).toBe(8);
    expect(repeat(mongeanShuffle, 8)(identity())).toEqual(identity());
  });

  it("produces a permutation", () => {
    expect(isPermutation(mongeanShuffle(identity()))).toBe(true);
  });
});

describe("dealAndStack", () => {
  it("with one pile is the identity", () => {
    expect(dealAndStack(identity(), 1)).toEqual(identity());
  });

  it("with two piles puts even positions first", () => {
    const out = dealAndStack(identity(), 2);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(2);
    expect(out[CARD_COUNT / 2]).toBe(1);
    expect(isPermutation(out)).toBe(true);
  });

  it("rejects impossible pile counts", () => {
    expect(() => dealAndStack(identity(), 0)).toThrow(RangeError);
    expect(() => dealAndStack(identity(), 53)).toThrow(RangeError);
    expect(() => dealAndStack(identity(), 1.5)).toThrow(RangeError);
  });
});

describe("mirrorInterleave", () => {
  it("alternates from each end", () => {
    const out = mirrorInterleave(identity());
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(CARD_COUNT - 1);
    expect(out[2]).toBe(1);
    expect(out[3]).toBe(CARD_COUNT - 2);
    expect(isPermutation(out)).toBe(true);
  });
});

describe("redBlackAlternating", () => {
  it("strictly alternates colour", () => {
    const out = redBlackAlternating(identity());
    expect(isPermutation(out)).toBe(true);
    for (let i = 0; i < out.length - 1; i++) {
      expect(isRed(out[i] as number), `positions ${i}/${i + 1}`).not.toBe(
        isRed(out[i + 1] as number)
      );
    }
  });

  it("starts with whatever colour the deck started with", () => {
    const out = redBlackAlternating(identity());
    expect(isRed(out[0] as number)).toBe(isRed(0));
  });
});

describe("suitClustered", () => {
  it("is already clustered for the sorted deck", () => {
    expect(suitClustered(identity())).toEqual(identity());
  });

  it("groups by suit in the requested order", () => {
    const out = suitClustered([...IDENTITY_DECK].reverse(), [3, 2, 1, 0]);
    for (let i = 0; i < CARD_COUNT - 1; i++) {
      expect(Math.floor(out[i]! / 13), `at ${i}`).toBeGreaterThanOrEqual(
        Math.floor(out[i + 1]! / 13)
      );
    }
  });
});

describe("rotate", () => {
  it("rotates left by n", () => {
    expect(rotate(identity(), 1)[0]).toBe(1);
    expect(rotate(identity(), 0)).toEqual(identity());
    expect(rotate(identity(), CARD_COUNT)).toEqual(identity());
  });

  it("handles negative rotation", () => {
    expect(rotate(identity(), -1)).toEqual(rotate(identity(), CARD_COUNT - 1));
  });
});

describe("repeat", () => {
  it("rejects negative and fractional counts", () => {
    expect(() => repeat(outShuffle, -1)).toThrow(RangeError);
    expect(() => repeat(outShuffle, 1.5)).toThrow(RangeError);
  });
});
