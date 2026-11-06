/**
 * The named decks the ruler marks and can jump to.
 *
 * ## The rule
 *
 * Every entry declares a `build()` that constructs the deck from its
 * *definition*. No index is ever written down. The index is measured with
 * `deckToIndex(build())`, and then the whole catalogue is checked at module
 * load:
 *
 *   - the build produced a valid deck,
 *   - the measured index unranks back to the same deck,
 *   - and any extra assertion the entry wants to make about its own
 *     defining property holds.
 *
 * A failure throws during import, which takes down the app immediately. That
 * is the point. A wrong "Perfect Faro" marker that quietly points at some
 * unrelated deck is worse than no marker at all — the reader trusts these
 * names. If a transform or the canonical card order ever changes, the app
 * dies loudly instead of serving confident nonsense.
 */

import { CARD_COUNT, IDENTITY_DECK, isRed } from "./cards";
import { deckToIndex, indexToDeck, type Deck } from "./deckMath";
import { LAST_INDEX, factorial } from "./factorials";
import { indexToPosition } from "./sliderMap";
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
} from "./shuffles";
import { isValidDeck } from "./validation";

export interface NamedDeck {
  name: string;
  /** One line, shown on hover. Why anyone would want to look at it. */
  description: string;
  /** Position of the marker on the 0..1 ruler. */
  position: number;
  /** The address, measured — never hand-written. */
  index: bigint;
  /** Reconstruct the deck from its definition. */
  build: () => Deck;
  /** Extra check on the deck's defining property. Runs at module load. */
  verify?: (deck: Deck) => void;
}

const identity = (): Deck => [...IDENTITY_DECK];
const reversed = (): Deck => [...IDENTITY_DECK].reverse();

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`patterns: ${message}`);
}

function sameDeck(a: Deck, b: Deck): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/** 52 cards, eight perfect out-shuffles, original order restored. */
function perfectFaro8(): Deck {
  return repeat(outShuffle, outShuffleOrder())(identity());
}

const DEFS: readonly Omit<NamedDeck, "index" | "position">[] = [
  {
    name: "New deck",
    description: "The sorted deck. Index zero — where every space begins.",
    build: identity,
    verify: (d) => assert(sameDeck(d, identity()), "New deck should be sorted"),
  },
  {
    name: "Reversed",
    description: `The sorted deck backwards. The very last address: 52! - 1.`,
    build: reversed,
    verify: (d) => assert(sameDeck(d, reversed()), "Reversed deck mismatch"),
  },
  {
    name: "One Faro",
    description: "A single perfect out-shuffle. The top card never moves.",
    build: () => outShuffle(identity()),
    verify: (d) => {
      assert(d[0] === 0, "out-shuffle should leave the top card at the top");
      assert(sameDeck(d, outShuffle(identity())), "one-Faro mismatch");
    },
  },
  {
    name: "Perfect Faro x8",
    description: `Eight out-shuffles — the known order for a 52-card deck (computed: ${outShuffleOrder()}).`,
    build: perfectFaro8,
    verify: (d) => {
      assert(
        outShuffleOrder() === 8,
        `expected out-shuffle order 8, computed ${outShuffleOrder()}`
      );
      assert(
        sameDeck(d, identity()),
        "8 out-shuffles should restore the sorted deck"
      );
    },
  },
  {
    name: "Mongean x1",
    description:
      "Cut in half, dealt alternately onto a new pile. Same order as the faro, different fixed cards.",
    build: () => mongeanShuffle(identity()),
    verify: (d) => {
      // The Mongean fixes cards 17 and 34, where the faro fixes 0 and 51 —
      // that is what makes it a genuinely different deck, not a relabelling.
      assert(d[17] === 17, "Mongean should fix card 17");
      assert(d[34] === 34, "Mongean should fix card 34");
      assert(d[0] === 51, "Mongean should send the top card to the bottom");
    },
  },
  {
    name: "Mongean x8",
    description: `Eight Mongean shuffles restore a 52-card deck (computed: ${mongeanOrder()}).`,
    build: () => repeat(mongeanShuffle, mongeanOrder())(identity()),
    verify: (d) => {
      assert(
        mongeanOrder() === 8,
        `expected Mongean order 8, computed ${mongeanOrder()}`
      );
      assert(
        sameDeck(d, identity()),
        "8 Mongean shuffles should restore the sorted deck"
      );
    },
  },
  {
    name: "Reverse Faro",
    description: `Fifty-two in-shuffles — the weave that moves both ends (computed: ${inShuffleOrder()}).`,
    build: () => repeat(inShuffle, inShuffleOrder())(identity()),
    verify: (d) => {
      assert(
        inShuffleOrder() === 52,
        `expected in-shuffle order 52, computed ${inShuffleOrder()}`
      );
      assert(
        sameDeck(d, identity()),
        "52 in-shuffles should restore the sorted deck"
      );
    },
  },
  {
    name: "Mirror weave",
    description: "First card, last card, second card, second-to-last...",
    build: () => mirrorInterleave(identity()),
  },
  {
    name: "Red/black weave",
    description:
      "Every red card followed by every black card, in the same order.",
    build: () => redBlackAlternating(identity()),
    verify: (d) => {
      for (let i = 0; i < d.length; i++) {
        assert(
          isRed(d[i] as number) !== isRed(d[i + 1] as number),
          `cards ${i}/${i + 1} share a colour`
        );
      }
    },
  },
  {
    name: "Suit blocks",
    description: "All spades, then hearts, then diamonds, then clubs.",
    build: () => suitClustered(identity()),
  },
  {
    name: "Round-robin deal",
    description: "Dealt into four piles one card at a time, then stacked back.",
    build: () => dealAndStack(identity(), 4),
  },
  {
    name: "Half-turn",
    description:
      "The deck rotated by 26 — dealt to two players and handed back.",
    build: () => rotate(identity(), CARD_COUNT / 2),
  },
  {
    name: "51! boundary",
    description:
      "The first index at which the top card can move at all. Everything below " +
      "this only permutes the tail of the deck.",
    build: () => indexToDeck(factorial(51)),
    verify: (d) =>
      assert(d[0] !== 0, "the 51! boundary should move the top card"),
  },
  {
    name: "Quarter turn",
    description:
      "Three quarters through the space — deep enough that nothing stays put.",
    build: () => indexToDeck((factorial(51) * 3n) / 4n),
  },
];

function buildCatalogue(): NamedDeck[] {
  return DEFS.map((def) => {
    const deck = def.build();

    if (!isValidDeck(deck)) {
      throw new Error(`patterns: "${def.name}" did not build a valid deck`);
    }

    const index = deckToIndex(deck);
    if (index < 0n || index > LAST_INDEX) {
      throw new Error(
        `patterns: "${def.name}" landed outside the address space at ${index}`
      );
    }

    // Round-trip: the measured address must reconstruct the exact deck.
    if (!sameDeck(indexToDeck(index), deck)) {
      throw new Error(`patterns: "${def.name}" failed its index round-trip`);
    }

    // And the definition's own property, if it declares one.
    def.verify?.(deck);

    return { ...def, index, position: indexToPosition(index) };
  });
}

/**
 * Built once, on import. Throws rather than returning a half-verified list.
 */
export const NAMED_DECKS: readonly NamedDeck[] = buildCatalogue();

/** Look up a named deck by its label. */
export function findNamedDeck(name: string): NamedDeck | undefined {
  return NAMED_DECKS.find((d) => d.name === name);
}
