/**
 * Canonical card identity for Every Deck.
 *
 * Every card has a permanent integer ID in [0, 52):
 *
 *     cardId = 13 * suitIndex + rankIndex
 *
 * The suit/rank ordering here is a design choice, but it MUST stay fixed
 * for the life of the project: it is what makes an index mean one
 * specific deck and only one, in every browser, forever. Changing it
 * silently invalidates every link anyone has ever shared.
 */

/** Suit indices. Order is part of the canonical encoding. */
export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

/** Rank indices. 0 = "2" (lowest), 12 = "A" (highest). */
export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
export type Rank = (typeof RANKS)[number];

export const SUIT_COUNT = 4;
export const RANK_COUNT = 13;
export const CARD_COUNT = SUIT_COUNT * RANK_COUNT; // 52

/** Pip glyphs for rendering. */
export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

/** Single ASCII letter per suit, used by the URL notation. */
export const SUIT_CODE: Record<Suit, string> = {
  spades: "S",
  hearts: "H",
  diamonds: "D",
  clubs: "C",
};

/** Single ASCII char per rank, used by the URL notation ("10" becomes "T"). */
export const RANK_CODE = "23456789TJQKA";

export const SUIT_RED: Record<Suit, boolean> = {
  spades: false,
  hearts: true,
  diamonds: true,
  clubs: false,
};

/**
 * A deck is a permutation of the 52 card IDs: 52 distinct integers in
 * [0, 52), in deal order.
 *
 * This lives here, in the leaf module, because both the math core and the
 * validators need it and neither can own it without an import cycle.
 */
export type Deck = number[];

const SUIT_BY_CODE: Record<string, Suit> = {
  S: "spades",
  H: "hearts",
  D: "diamonds",
  C: "clubs",
};

/** ID -> 2-character compact code, e.g. 0 -> "S2" (two of spades). */
export const CARD_CODE: readonly string[] = Array.from(
  { length: CARD_COUNT },
  (_, id) => {
    const suit = SUITS[Math.floor(id / RANK_COUNT)] as Suit;
    const rank = RANK_CODE[id % RANK_COUNT] as string;
    return SUIT_CODE[suit] + rank;
  }
);

/** The natural sorted deck: 2♠ 3♠ ... A♠ 2♥ ... A♣. Index 0 lives here. */
export const IDENTITY_DECK: readonly number[] = Array.from(
  { length: CARD_COUNT },
  (_, i) => i
);

export function cardId(suitIndex: number, rankIndex: number): number {
  return RANK_COUNT * suitIndex + rankIndex;
}

export function suitOf(id: number): Suit {
  return SUITS[Math.floor(id / RANK_COUNT)] as Suit;
}

export function rankOf(id: number): number {
  return id % RANK_COUNT;
}

export function rankLabel(id: number): string {
  return RANKS[rankOf(id)] as string;
}

/** Human-readable label, e.g. "A♠". */
export function cardLabel(id: number): string {
  return `${rankLabel(id)}${SUIT_SYMBOL[suitOf(id)]}`;
}

/** Compact 2-character code, e.g. "AS". Inverse of {@link CARD_CODE}. */
export function cardCode(id: number): string {
  return CARD_CODE[id] as string;
}

export function isRed(id: number): boolean {
  return SUIT_RED[suitOf(id)];
}

/**
 * Parse a 2-character compact card code ("AS", "2H", "TD"). Returns null
 * if the code is not exactly one valid card. Case-insensitive on input so
 * hand-typed URLs are forgiving; output is always upper-case canonical.
 */
export function parseCardCode(code: string): number | null {
  if (code.length !== 2) return null;
  const suit = SUIT_BY_CODE[code[0]!.toUpperCase()];
  if (!suit) return null;
  const rankIndex = RANK_CODE.indexOf(code[1]!.toUpperCase());
  if (rankIndex < 0) return null;
  return cardId(SUITS.indexOf(suit), rankIndex);
}
