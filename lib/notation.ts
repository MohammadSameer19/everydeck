/**
 * Deck notation: a 104-character, human-readable, human-typeable alias for
 * a 226-bit index.
 *
 *     S2H3D4C5S6H7D8C9S...   (52 two-character cards, 104 characters total)
 *
 * ## Why this exists
 *
 * The decimal address of a deck is 68 digits long. That is a fine
 * *address* but a terrible thing to hand to another person. The deck
 * itself is the same information in a form a person can read, eyeball for
 * tampering, and retype.
 *
 * This is deliberately NOT a Feistel network or any other scrambling
 * scheme. The deck string is the deck; it is already canonical, already
 * human-meaningful, and already lossless. Scrambling it would throw away
 * the only property worth having.
 *
 * Card codes: suit S/H/D/C, rank 23456789TJQKA ("10" is "T" so every card
 * is exactly two characters).
 */

import { CARD_COUNT, cardCode, parseCardCode } from "./cards";
import type { Deck } from "./deckMath";
import { assertValidDeck, DeckError } from "./validation";

/** Length of every valid notation string: 52 cards x 2 characters. */
export const NOTATION_LENGTH = CARD_COUNT * 2; // 104

/** Encode a deck as its canonical 104-character notation. */
export function deckToNotation(deck: Deck): string {
  assertValidDeck(deck);

  let out = "";
  for (let i = 0; i < CARD_COUNT; i++) {
    const card = deck[i] as number;
    out += encodeCard(card);
  }
  return out;
}

/**
 * Decode notation back to a deck.
 *
 * Case-insensitive, so a hand-typed `s2h3...` works. Throws
 * {@link DeckError} on the first problem it finds, with a human-readable
 * message that names the offending position.
 */
export function notationToDeck(notation: string): Deck {
  if (typeof notation !== "string") {
    throw new DeckError(
      "NOT_A_DECK",
      "Deck notation must be a string.",
      notation
    );
  }
  if (notation.length !== NOTATION_LENGTH) {
    throw new DeckError(
      "MALFORMED",
      `Deck notation must be exactly ${NOTATION_LENGTH} characters ` +
        `(${CARD_COUNT} cards x 2), got ${notation.length}.`,
      notation.length
    );
  }

  const deck: number[] = new Array<number>(CARD_COUNT);
  const seen = new Set<number>();

  for (let i = 0; i < CARD_COUNT; i++) {
    const token = notation.slice(i * 2, i * 2 + 2);
    const card = parseCardCode(token);

    if (card === null) {
      throw new DeckError(
        "MALFORMED",
        `Card ${i + 1} ("${token}") is not a valid card. ` +
          `Suits are S, H, D, C; ranks are 23456789TJQKA.`,
        token
      );
    }
    if (seen.has(card)) {
      throw new DeckError(
        "DUPLICATE",
        `Card ${i + 1} ("${token}") repeats an earlier card. A deck holds each card once.`,
        token
      );
    }

    seen.add(card);
    deck[i] = card;
  }

  return deck;
}

/** True when `notation` would decode cleanly. Never throws. */
export function isValidNotation(notation: string): boolean {
  try {
    notationToDeck(notation);
    return true;
  } catch {
    return false;
  }
}

function encodeCard(card: number): string {
  if (!Number.isInteger(card) || card < 0 || card >= CARD_COUNT) {
    throw new DeckError("INVALID_CARD", `Cannot encode card ID ${card}.`, card);
  }
  return cardCode(card);
}

/**
 * Split a notation string into readable 4-character groups for display
 * ("S2H3 D4C5 S6H7"), without changing its meaning.
 */
export function formatNotation(notation: string, groupSize = 4): string {
  const groups: string[] = [];
  for (let i = 0; i < notation.length; i += groupSize) {
    groups.push(notation.slice(i, i + groupSize));
  }
  return groups.join(" ");
}
