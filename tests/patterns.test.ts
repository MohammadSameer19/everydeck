import { describe, expect, it } from "vitest";

import { CARD_COUNT, IDENTITY_DECK, isRed } from "@/lib/cards";
import { deckToIndex, indexToDeck, type Deck } from "@/lib/deckMath";
import { LAST_INDEX, factorial } from "@/lib/factorials";
import { NAMED_DECKS, findNamedDeck } from "@/lib/patterns";
import { indexToPosition } from "@/lib/sliderMap";
import { isValidDeck } from "@/lib/validation";

// Importing @/lib/patterns runs every self-check at module load. Reaching
// this line at all means the catalogue verified successfully.
describe("named deck catalogue", () => {
  it("is non-empty and every entry is structurally sound", () => {
    expect(NAMED_DECKS.length).toBeGreaterThan(5);

    for (const entry of NAMED_DECKS) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.index >= 0n && entry.index <= LAST_INDEX, entry.name).toBe(
        true
      );
      expect(entry.position).toBeGreaterThanOrEqual(0);
      expect(entry.position).toBeLessThanOrEqual(1);
      expect(isValidDeck(entry.build()), entry.name).toBe(true);
    }
  });

  it("measures every index instead of storing one", () => {
    for (const entry of NAMED_DECKS) {
      expect(entry.index, entry.name).toBe(deckToIndex(entry.build()));
    }
  });

  it("round-trips every named deck through its measured index", () => {
    for (const entry of NAMED_DECKS) {
      const deck = entry.build();
      const recovered = indexToDeck(entry.index);
      expect(recovered.length, entry.name).toBe(CARD_COUNT);
      expect(recovered.join(","), entry.name).toBe(deck.join(","));
    }
  });

  it("positions markers in ascending index order", () => {
    const sorted = [...NAMED_DECKS].sort((a, b) =>
      a.index < b.index ? -1 : a.index > b.index ? 1 : 0
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i]!.position,
        `${sorted[i - 1]!.name} -> ${sorted[i]!.name}`
      ).toBeGreaterThanOrEqual(sorted[i - 1]!.position);
    }
  });

  it("marker positions match the index positions", () => {
    for (const entry of NAMED_DECKS) {
      expect(entry.position, entry.name).toBeCloseTo(
        indexToPosition(entry.index),
        5
      );
    }
  });

  it("has no duplicate names", () => {
    const names = NAMED_DECKS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes the canonical endpoints", () => {
    expect(findNamedDeck("New deck")?.index).toBe(0n);
    expect(findNamedDeck("Reversed")?.index).toBe(LAST_INDEX);
  });

  it("anchors the 51! boundary exactly", () => {
    expect(findNamedDeck("51! boundary")?.index).toBe(factorial(51));
  });
});

describe("named deck definitions hold their own defining properties", () => {
  it("Red/black weave really alternates", () => {
    const deck = findNamedDeck("Red/black weave")!.build();
    for (let i = 0; i < deck.length - 1; i++) {
      expect(isRed(deck[i] as number), `at ${i}`).not.toBe(
        isRed(deck[i + 1] as number)
      );
    }
  });

  it("Reversed really is reversed", () => {
    expect(findNamedDeck("Reversed")!.build()).toEqual(
      [...IDENTITY_DECK].reverse()
    );
  });

  it("One Faro really leaves the top card alone", () => {
    expect(findNamedDeck("One Faro")!.build()[0]).toBe(0);
  });

  it("Perfect Faro x8 really is the sorted deck", () => {
    expect(findNamedDeck("Perfect Faro x8")!.build()).toEqual([
      ...IDENTITY_DECK,
    ]);
  });
});
