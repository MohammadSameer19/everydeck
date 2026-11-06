/**
 * URL state.
 *
 * Every Deck has two interchangeable, exact addresses:
 *
 *   ?deck=S2H3D4C5...     104 characters, human-readable, content-addressed
 *   #39445782035834...   68 digits, the canonical integer address
 *
 * `?deck=` wins when both are present, because it names what is being shown
 * rather than where it sits in the ordering. The fragment is the fallback
 * for people who want to talk about the position itself.
 *
 * Rules that this module enforces, so no component has to:
 *
 *  - URLs are untrusted input. Everything is validated before it reaches
 *    the math core, and failures throw {@link DeckError}.
 *  - The fragment is written on a debounce and never per animation frame.
 *  - Only genuine state changes produce history entries.
 */

import type { Deck } from "./cards";
import { deckToIndex, indexToDeck } from "./deckMath";
import { DeckError, assertValidIndex, clampIndex } from "./validation";
import { deckToNotation, notationToDeck } from "./notation";

/** Query parameter carrying deck notation. */
export const DECK_PARAM = "deck";

/** Optional view/layout parameter. */
export const VIEW_PARAM = "view";

export type ViewName = "grid" | "fan" | "piles";
export const VIEW_NAMES: readonly ViewName[] = ["grid", "fan", "piles"];
const DEFAULT_VIEW: ViewName = "grid";

export interface ResolvedState {
  index: bigint;
  deck: Deck;
  /** Which part of the URL decided this. Useful for showing "from a link". */
  source: "param" | "hash" | "default";
  view: ViewName;
}

/** Read `?deck=` and decode it. Throws DeckError with a readable message. */
export function parseDeckParam(raw: string | undefined | null): Deck | null {
  if (raw === undefined || raw === null || raw === "") return null;
  return notationToDeck(decodeURIComponent(raw));
}

/** Read `#<decimal>` and validate it. Throws DeckError on garbage. */
export function parseIndexHash(hash: string | undefined | null): bigint | null {
  if (!hash) return null;

  const cleaned = hash.replace(/^#/, "").trim();
  if (cleaned === "") return null;

  if (!/^\d+$/.test(cleaned)) {
    throw new DeckError(
      "MALFORMED",
      `"${cleaned}" is not a decimal integer. Indices are plain digits with no sign or separators.`,
      cleaned
    );
  }

  const index = BigInt(cleaned);
  // The regex already rules out signs, so the only range failure left is
  // the upper bound. assertValidIndex supplies a message worth showing.
  assertValidIndex(index);
  return index;
}

/**
 * Read `#<decimal>` and clamp it into range instead of throwing. For lenient
 * entry points such as a live-updating hash that the user is mid-way
 * through typing into the address bar.
 */
export function parseIndexHashLenient(
  hash: string | undefined | null
): bigint | null {
  const cleaned = (hash ?? "").replace(/^#/, "").trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return clampIndex(BigInt(cleaned));
}

function parseView(raw: string | undefined | null): ViewName {
  if (!raw) return DEFAULT_VIEW;
  const lower = raw.toLowerCase();
  return (VIEW_NAMES as readonly string[]).includes(lower)
    ? (lower as ViewName)
    : DEFAULT_VIEW;
}

/**
 * Resolve a URL into a concrete deck state.
 *
 * @throws DeckError when a supplied value is present but unusable.
 */
export function resolveState(input: {
  deck?: string | undefined | null;
  hash?: string | undefined | null;
  view?: string | undefined | null;
}): ResolvedState {
  const view = parseView(input.view);

  // `?deck=` wins — it is the more specific statement of intent.
  const deck = parseDeckParam(input.deck);
  if (deck) {
    return { index: deckToIndex(deck), deck, source: "param", view };
  }

  const index = parseIndexHash(input.hash);
  if (index !== null) {
    return { index, deck: indexToDeck(index), source: "hash", view };
  }

  const identity = indexToDeck(0n);
  return { index: 0n, deck: identity, source: "default", view };
}

/** The canonical `?deck=` value for a deck. */
export function toDeckParam(deck: Deck): string {
  return deckToNotation(deck);
}

/**
 * The canonical `#<index>` fragment. Index 0 returns an empty string so the
 * landing page stays clean — it is already the default.
 */
export function toIndexHash(index: bigint): string {
  return index === 0n ? "" : `#${index.toString()}`;
}

/**
 * Build a shareable URL for the current state.
 *
 * Accepts an explicit `origin` so it is pure and testable, rather than
 * reaching for `window.location` — which may be stale if the hash write is
 * still sitting in its debounce.
 */
export function buildShareUrl(options: {
  origin: string;
  pathname: string;
  index: bigint;
  deck: Deck;
  view?: ViewName;
  /** Prefer the 104-char deck notation over the 68-digit index. */
  form?: "deck" | "index";
}): string {
  const {
    origin,
    pathname,
    index,
    deck,
    view = "grid",
    form = "deck",
  } = options;

  const params = new URLSearchParams();
  if (view !== DEFAULT_VIEW) params.set(VIEW_PARAM, view);
  if (form === "deck") params.set(DECK_PARAM, toDeckParam(deck));

  const query = params.toString();
  const base = `${origin}${pathname}${query ? `?${query}` : ""}`;
  return `${base}${form === "index" ? toIndexHash(index) : ""}`;
}

/**
 * Whether the URL should be rewritten for this state. Used to avoid pushing
 * redundant history entries while dragging the ruler.
 */
export function shouldWriteUrl(
  current: {
    deck?: string | undefined | null;
    hash?: string | undefined | null;
    view?: string | undefined | null;
  },
  next: { index: bigint; deck: Deck; view: ViewName }
): boolean {
  const view = parseView(current.view);
  if (view !== next.view) return true;

  const currentDeck = parseDeckParam(current.deck);
  if (currentDeck) {
    return currentDeck.join(",") !== next.deck.join(",");
  }

  const currentIndex = parseIndexHash(current.hash) ?? 0n;
  return currentIndex !== next.index;
}
