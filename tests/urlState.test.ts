import { describe, expect, it } from "vitest";

import { CARD_COUNT, IDENTITY_DECK } from "@/lib/cards";
import { deckToIndex, indexToDeck, type Deck } from "@/lib/deckMath";
import { LAST_INDEX, TOTAL } from "@/lib/factorials";
import { deckToNotation } from "@/lib/notation";
import { randomDeck, seededRandomBelow } from "@/lib/random";
import {
  buildShareUrl,
  parseDeckParam,
  parseIndexHash,
  parseIndexHashLenient,
  resolveState,
  shouldWriteUrl,
  toDeckParam,
  toIndexHash,
} from "@/lib/urlState";
import { DeckError } from "@/lib/validation";

const identity: Deck = indexToDeck(0n);

describe("parseDeckParam", () => {
  it("decodes a valid notation", () => {
    expect(parseDeckParam(deckToNotation(identity))).toEqual(identity);
  });

  it("returns null when absent or empty", () => {
    expect(parseDeckParam(undefined)).toBeNull();
    expect(parseDeckParam(null)).toBeNull();
    expect(parseDeckParam("")).toBeNull();
  });

  it("throws a readable error on garbage", () => {
    expect(() => parseDeckParam("nope")).toThrow(DeckError);
    try {
      parseDeckParam("A".repeat(103));
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toMatch(/exactly 104/);
    }
  });
});

describe("parseIndexHash", () => {
  it("accepts plain digits with an optional leading #", () => {
    expect(parseIndexHash("#0")).toBe(0n);
    expect(parseIndexHash("123")).toBe(123n);
    expect(parseIndexHash(LAST_INDEX.toString())).toBe(LAST_INDEX);
  });

  it("returns null for empty input", () => {
    expect(parseIndexHash(undefined)).toBeNull();
    expect(parseIndexHash("")).toBeNull();
    expect(parseIndexHash("#")).toBeNull();
  });

  it("rejects signs, separators and letters", () => {
    for (const bad of ["-1", "+5", "1e5", "1,234", "12a", " 12 34", "0x10"]) {
      expect(() => parseIndexHash(bad), bad).toThrow(DeckError);
    }
  });

  it("rejects an out-of-range index with a RANGE error", () => {
    try {
      parseIndexHash(TOTAL.toString());
      expect.unreachable();
    } catch (err) {
      expect((err as DeckError).code).toBe("RANGE");
    }
  });

  it("lenient mode clamps instead of throwing", () => {
    expect(parseIndexHashLenient("-5")).toBeNull();
    expect(parseIndexHashLenient("abc")).toBeNull();
    expect(parseIndexHashLenient(TOTAL.toString())).toBe(LAST_INDEX);
    expect(parseIndexHashLenient("#42")).toBe(42n);
  });
});

describe("resolveState", () => {
  it("defaults to the sorted deck at index 0", () => {
    const state = resolveState({});
    expect(state.index).toBe(0n);
    expect(state.deck).toEqual(identity);
    expect(state.source).toBe("default");
    expect(state.view).toBe("grid");
  });

  it("prefers ?deck= over #index", () => {
    const deck = randomDeck(seededRandomBelow(11n));
    const state = resolveState({ deck: deckToNotation(deck), hash: "#777" });
    expect(state.source).toBe("param");
    expect(state.deck).toEqual(deck);
    expect(state.index).toBe(deckToIndex(deck));
  });

  it("falls back to #index", () => {
    const state = resolveState({ hash: "#500" });
    expect(state.source).toBe("hash");
    expect(state.index).toBe(500n);
    expect(state.deck).toEqual(indexToDeck(500n));
  });

  it("reads the view, falling back on nonsense", () => {
    expect(resolveState({ view: "fan" }).view).toBe("fan");
    expect(resolveState({ view: "FAN" }).view).toBe("fan");
    expect(resolveState({ view: "nonsense" }).view).toBe("grid");
  });

  it("a malformed param still throws rather than silently defaulting", () => {
    expect(() => resolveState({ deck: "garbage" })).toThrow(DeckError);
  });

  it("round-trips every URL form back to the same deck", () => {
    const rng = seededRandomBelow(0xabcn);
    for (let i = 0; i < 50; i++) {
      const deck = randomDeck(rng);
      const index = deckToIndex(deck);

      const byDeck = resolveState({ deck: toDeckParam(deck) });
      const byIndex = resolveState({ hash: toIndexHash(index) });

      expect(byDeck.deck).toEqual(deck);
      expect(byIndex.deck).toEqual(deck);
      expect(byDeck.index).toBe(index);
      expect(byIndex.index).toBe(index);
    }
  });
});

describe("buildShareUrl", () => {
  const base = { origin: "https://everydeck.app", pathname: "/" };

  it("builds a deck URL by default", () => {
    const url = buildShareUrl({ ...base, index: 42n, deck: identity });
    expect(url.startsWith("https://everydeck.app/?deck=")).toBe(true);
    expect(decodeURIComponent(url.split("deck=")[1]!)).toBe(
      deckToNotation(identity)
    );
  });

  it("builds an index URL on request", () => {
    const url = buildShareUrl({
      ...base,
      index: 42n,
      deck: identity,
      form: "index",
    });
    expect(url).toBe("https://everydeck.app/#42");
  });

  it("keeps index 0 clean", () => {
    expect(toIndexHash(0n)).toBe("");
    expect(
      buildShareUrl({ ...base, index: 0n, deck: identity, form: "index" })
    ).toBe("https://everydeck.app/");
  });

  it("includes a non-default view, and omits the default", () => {
    expect(
      buildShareUrl({ ...base, index: 0n, deck: identity, view: "fan" })
    ).toContain("view=fan");
    expect(
      buildShareUrl({ ...base, index: 0n, deck: identity, view: "grid" })
    ).not.toContain("view=");
  });

  it("its own output parses back to the same deck", () => {
    const deck = randomDeck(seededRandomBelow(3n));
    const url = buildShareUrl({ ...base, index: deckToIndex(deck), deck });

    const parsed = new URL(url);
    const state = resolveState({
      deck: parsed.searchParams.get("deck"),
      view: parsed.searchParams.get("view"),
    });
    expect(state.deck).toEqual(deck);
  });
});

describe("shouldWriteUrl", () => {
  it("is false when nothing changed", () => {
    expect(
      shouldWriteUrl(
        { deck: deckToNotation(identity), view: "grid" },
        { index: 0n, deck: identity, view: "grid" }
      )
    ).toBe(false);
  });

  it("is true when the deck changes", () => {
    const next = indexToDeck(1n);
    expect(
      shouldWriteUrl(
        { deck: deckToNotation(identity) },
        { index: 1n, deck: next, view: "grid" }
      )
    ).toBe(true);
  });

  it("is true when only the view changes", () => {
    expect(
      shouldWriteUrl(
        { deck: deckToNotation(identity), view: "grid" },
        { index: 0n, deck: identity, view: "fan" }
      )
    ).toBe(true);
  });

  it("compares indices when the URL holds a hash", () => {
    expect(
      shouldWriteUrl(
        { hash: "#5" },
        { index: 5n, deck: identity, view: "grid" }
      )
    ).toBe(false);
    expect(
      shouldWriteUrl(
        { hash: "#5" },
        { index: 6n, deck: identity, view: "grid" }
      )
    ).toBe(true);
  });

  it("defaults an absent hash to index 0", () => {
    expect(
      shouldWriteUrl({}, { index: 0n, deck: identity, view: "grid" })
    ).toBe(false);
  });
});

describe("the canonical card ordering is stable", () => {
  it("still defines the sorted deck as 2S..AS then 2H..AH then 2D..AD then 2C..AC", () => {
    const notation = deckToNotation([...IDENTITY_DECK] as Deck);
    // Two characters per card, thirteen cards per suit, so each suit block
    // is 26 characters.
    expect(notation.length).toBe(CARD_COUNT * 2);
    expect(notation.slice(0, 4)).toBe("S2S3");
    expect(notation.slice(24, 26)).toBe("SA");
    expect(notation.slice(26, 30)).toBe("H2H3");
    expect(notation.slice(52, 56)).toBe("D2D3");
    expect(notation.slice(78, 82)).toBe("C2C3");
    expect(notation.slice(102, 104)).toBe("CA");
  });
});
