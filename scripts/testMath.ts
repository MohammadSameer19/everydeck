/**
 * Standalone math check: `npm run test:math`
 *
 * The math core is framework-free by design, so it should be verifiable
 * without a test runner, a DOM, or a bundler. This file proves that — it
 * imports the modules directly under `tsx` and asserts the two invariants
 * that define the project.
 *
 * It is not a replacement for `npm test`; it is the one command that works
 * even when everything else is broken.
 */

import { CARD_COUNT } from "../lib/cards";
import {
  deckToIndex,
  indexToDeck,
  lehmerDigits,
  type Deck,
} from "../lib/deckMath";
import { LAST_INDEX, TOTAL, factorial } from "../lib/factorials";
import { NAMED_DECKS } from "../lib/patterns";
import { deckToNotation, notationToDeck } from "../lib/notation";
import { randomDeck, seededRandomBelow } from "../lib/random";
import {
  inShuffleOrder,
  mongeanOrder,
  outShuffleOrder,
  repeat,
  outShuffle,
} from "../lib/shuffles";

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean): void {
  if (condition) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL  ${label}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const started = performance.now();

// --- Facts -----------------------------------------------------------------
section("Facts");
check("52! has 68 digits", TOTAL.toString().length === 68);
check("52! is 226 bits", TOTAL.toString(2).length === 226);
check(
  "52! is 80658175170943878571660636856403766975289505440883277824000000000000",
  TOTAL.toString() ===
    "80658175170943878571660636856403766975289505440883277824000000000000"
);

// --- The two invariants ----------------------------------------------------
section("Invariants");

const landmarkIndices: bigint[] = [
  0n,
  1n,
  51n,
  52n,
  factorial(26),
  factorial(51),
  factorial(51) + 1n,
  TOTAL / 2n,
  TOTAL - 2n,
  LAST_INDEX,
];

for (const k of landmarkIndices) {
  check(
    `deckToIndex(indexToDeck(${k})) === ${k}`,
    deckToIndex(indexToDeck(k)) === k
  );
}

// Every named deck, measured and round-tripped.
for (const entry of NAMED_DECKS) {
  const deck = entry.build();
  check(
    `"${entry.name}" index is measured, not stored`,
    entry.index === deckToIndex(deck)
  );
  check(
    `"${entry.name}" round-trips`,
    indexToDeck(entry.index).join(",") === deck.join(",")
  );
  check(
    `"${entry.name}" notation round-trips`,
    notationToDeck(deckToNotation(deck)).join(",") === deck.join(",")
  );
}

// --- Shuffle orders (derived, never assumed) --------------------------------
section("Shuffle orders");
check(
  `out-shuffle order is 8 (computed ${outShuffleOrder()})`,
  outShuffleOrder() === 8
);
check(
  `in-shuffle order is 52 (computed ${inShuffleOrder()})`,
  inShuffleOrder() === 52
);
check(`Mongean order is 8 (computed ${mongeanOrder()})`, mongeanOrder() === 8);
check(
  "8 out-shuffles restore the sorted deck",
  repeat(outShuffle, 8)([...Array(CARD_COUNT).keys()]).join(",") ===
    [...Array(CARD_COUNT).keys()].join(",")
);

// --- Randomized sweep ------------------------------------------------------
section("Randomized sweep (500 seeds)");
let sweepOk = true;
const rng = seededRandomBelow(0x5eedn);

for (let i = 0; i < 500; i++) {
  const deck = randomDeck(rng) as Deck;
  if (deckToIndex(indexToDeck(deckToIndex(deck))) !== deckToIndex(deck))
    sweepOk = false;
  if (deck.length !== CARD_COUNT || new Set(deck).size !== CARD_COUNT)
    sweepOk = false;
  if (lehmerDigits(deck).length !== CARD_COUNT) sweepOk = false;
}
check("500 random decks all round-trip exactly", sweepOk);

// --- Report ----------------------------------------------------------------
const elapsed = performance.now() - started;
console.log(
  `\n${passed} passed, ${failures.length} failed in ${elapsed.toFixed(0)}ms`
);

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
