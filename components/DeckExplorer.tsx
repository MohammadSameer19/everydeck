"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CopyLinkButton from "./CopyLinkButton";
import DeckView from "./DeckView";
import IndexCounter from "./IndexCounter";
import PermutationInspector from "./PermutationInspector";
import RulerSlider from "./RulerSlider";
import StepControls from "./StepControls";
import { BooleanToggle, Panel } from "./ui";

import type { Deck } from "@/lib/cards";
import { deckToIndex, indexToDeck } from "@/lib/deckMath";
import { LAST_INDEX, TOTAL } from "@/lib/factorials";
import { formatScientific } from "@/lib/format";
import type { LayoutView } from "@/lib/layouts";
import { deckToNotation } from "@/lib/notation";
import { NAMED_DECKS } from "@/lib/patterns";
import { cryptoRandomBelow, randomDeck } from "@/lib/random";
import {
  DECK_PARAM,
  VIEW_PARAM,
  parseIndexHashLenient,
  type ViewName,
} from "@/lib/urlState";
import { clampIndex } from "@/lib/validation";
import {
  useIndexKeyboard,
  useIndexNavigation,
} from "@/hooks/useIndexNavigation";

/**
 * The whole interactive app.
 *
 * ## Layout
 *
 * A full-height flex column: masthead, counter, deck, footer. An earlier
 * version absolutely-positioned the chrome in the corners like the reference
 * app does, but that works only when the subject is a cube sitting in the
 * middle of the frame. A 13x4 grid of cards fills the viewport, so corner
 * chrome and cards end up in the same place and one of them has to lose.
 *
 * In a flex column the deck takes whatever height is left over after the
 * chrome, and nothing can ever overlap it. The deck measures its own box
 * and scales to fit whichever axis runs out first.
 *
 * ## State discipline
 *
 *  - `index` is the single source of truth. The deck is always derived from
 *    it with `indexToDeck`, never stored. One path from a number to a deck
 *    is what makes random decks, shared links and the ruler all trivially
 *    reproducible.
 *
 *  - the URL is written on a debounce with `replaceState`, so dragging the
 *    ruler does not fill the back button with hundreds of entries.
 */

const DEBOUNCE_MS = 300;

/** Landing delay per card, for big jumps. See DeckView. */
const STAGGER_MS = 14;

/** Jumps larger than this are worth animating as a cascade. */
const STAGGER_THRESHOLD = 1000n;

interface DeckExplorerProps {
  initialIndex: bigint;
  initialDeck: Deck;
  initialView: ViewName;
}

export default function DeckExplorer({
  initialIndex,
  initialDeck,
  initialView,
}: DeckExplorerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [view, setView] = useState<LayoutView>(initialView as LayoutView);
  const [animated, setAnimated] = useState(true);
  const [showPatterns, setShowPatterns] = useState(true);
  const [inspect, setInspect] = useState(false);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [stagger, setStagger] = useState(0);
  const inspectorRef = useRef<HTMLDivElement>(null);

  const deck = useMemo(() => indexToDeck(index), [index]);

  const update = useCallback((fn: (n: bigint) => bigint) => {
    setIndex((current) => clampIndex(fn(current)));
  }, []);

  // Scroll drives the index across the whole surface, not just the deck —
  // see the note in useIndexNavigation. Regions that can scroll opt out.
  useIndexNavigation(update, 1n);

  const onKey = useIndexKeyboard(update, true);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimated(!query.matches);
    const onChange = (e: MediaQueryListEvent) => setAnimated(!e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The inspector is a drawer, not a modal: a click outside its sheet puts it
  // away. Clicks on the sheet itself (including close) stay with the sheet.
  useEffect(() => {
    if (!inspect) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (inspectorRef.current?.contains(target)) return;
      if (target.closest("[data-inspector-toggle]")) return;
      setInspect(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [inspect]);

  // The fragment never reaches the server, so an index link has to be
  // resolved after hydration. `?deck=` is the more specific statement of
  // intent and wins, matching resolveState's precedence.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has(DECK_PARAM)) return;

    const fromHash = parseIndexHashLenient(window.location.hash);
    if (fromHash !== null) setIndex(fromHash);
  }, []);

  // --- URL sync ------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(DECK_PARAM, deckToNotation(deck));
      if (view !== "grid") url.searchParams.set(VIEW_PARAM, view);
      else url.searchParams.delete(VIEW_PARAM);
      // The deck parameter is the canonical address. Drop any fragment left
      // over from an index link, so it cannot go stale as the deck changes.
      url.hash = "";
      window.history.replaceState(null, "", url);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [deck, view]);

  // --- Actions -------------------------------------------------------------
  const jump = useCallback((next: bigint) => {
    setIndex((current) => {
      const delta = next > current ? next - current : current - next;
      setStagger(delta > STAGGER_THRESHOLD ? STAGGER_MS : 0);
      return clampIndex(next);
    });
  }, []);

  const random = useCallback(() => {
    setStagger(STAGGER_MS);
    setIndex(deckToIndex(randomDeck(cryptoRandomBelow)));
  }, []);

  // Clear the cascade once it has played, so later steps are not staggered.
  useEffect(() => {
    if (stagger === 0) return;
    const t = setTimeout(() => setStagger(0), 900);
    return () => clearTimeout(t);
  }, [stagger]);

  const step = useCallback(
    (delta: bigint) => update((n) => n + delta),
    [update]
  );

  const activePattern = useMemo(
    () => NAMED_DECKS.find((p) => p.index === index)?.name,
    [index]
  );

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      {/* --- masthead --- */}
      <header className="flex-none px-4 pt-4 sm:px-8 sm:pt-5">
        <div className="flex items-baseline justify-between gap-6">
          <div className="flex min-w-0 items-baseline gap-4">
            <h1 className="text-ink shrink-0 text-[12px] font-semibold tracking-[0.22em] uppercase">
              Every Deck
            </h1>
            {/* One line beside the wordmark, not a paragraph under it: the
                deck is the subject, and every row of chrome costs it height. */}
            <p className="text-muted-strong hidden truncate font-serif text-[12px] leading-relaxed italic lg:block">
              All 52! orderings of a deck of cards, addressed by one integer.
              Nothing is stored.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-center">
            <span className="text-muted-strong hidden font-mono text-[9px] tracking-[0.08em] sm:block">
              52! = {formatScientific(TOTAL)}
            </span>
            <a
              href="https://github.com/MohammadSameer19/everydeck"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Every Deck on GitHub"
              title="Every Deck on GitHub"
              className="border-ink bg-ink text-paper hover:border-accent hover:bg-accent focus-visible:ring-accent/45 inline-flex h-7 w-7 items-center justify-center border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="border-rule mt-2 border-t" />
      </header>

      {/* --- the counter gets its own full-width row, because 68 digits need
              the whole width to stay legible --- */}
      <div className="flex-none px-4 pt-3 sm:px-8">
        <IndexCounter
          index={index}
          onCommit={jump}
          action={
            <CopyLinkButton index={index} deck={deck} view={view as ViewName} />
          }
        />
      </div>

      {/* --- the deck takes every pixel left over --- */}
      <div className="min-h-0 flex-1 px-4 py-3 sm:px-8 sm:py-4">
        <DeckView
          deck={deck}
          view={view}
          animated={animated}
          stagger={stagger}
          highlightSlot={highlightSlot}
          onHoverSlot={setHighlightSlot}
        />
      </div>

      {/* --- footer --- */}
      <footer className="flex-none px-4 pb-3 sm:px-8 sm:pb-5">
        <RulerSlider
          index={index}
          onChange={jump}
          showPatterns={showPatterns}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <StepControls
            onStep={step}
            onRandom={random}
            onFirst={() => jump(0n)}
            onLast={() => jump(LAST_INDEX)}
            view={view}
            onViewChange={setView}
          />

          <div className="flex flex-wrap items-center gap-2">
            <BooleanToggle
              value={animated}
              onChange={setAnimated}
              label="Animate"
              title="Animate cards as they move between arrangements"
            />
            <BooleanToggle
              value={showPatterns}
              onChange={setShowPatterns}
              label="Named decks"
              title="Mark named decks on the ruler"
            />
            <div className="contents" data-inspector-toggle="">
              <BooleanToggle
                value={inspect}
                onChange={setInspect}
                label="Lehmer code"
                title="Show the Lehmer code this index is made of"
              />
            </div>
            {activePattern && (
              <span className="text-accent font-serif text-[11px] italic">
                {activePattern}
              </span>
            )}
          </div>
        </div>

        {/* Named decks as one scrollable text strip. A panel would take height
            away from the deck, which is the thing worth looking at. */}
        <div
          className="mt-2 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1"
          data-scroll-region
        >
          {NAMED_DECKS.map((entry, i) => {
            const active = entry.index === index;
            return (
              <span
                key={entry.name}
                className="flex shrink-0 items-center gap-2"
              >
                {i > 0 && <span className="text-rule">·</span>}
                <button
                  type="button"
                  onClick={() => jump(entry.index)}
                  title={`${entry.description}\n\nindex ${entry.index}`}
                  className={
                    "cursor-pointer text-[9px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase transition-colors " +
                    (active
                      ? "text-accent underline underline-offset-4"
                      : "text-muted hover:text-ink")
                  }
                >
                  {entry.name}
                </button>
              </span>
            );
          })}
        </div>
      </footer>

      {/* --- inspector slides over the deck --- */}
      <div
        ref={inspectorRef}
        className={
          "absolute inset-y-0 right-0 z-30 w-[min(30rem,100vw)] transition-transform duration-300 " +
          (inspect ? "translate-x-0" : "translate-x-full")
        }
      >
        <Panel className="flex h-full flex-col p-5">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-ink font-serif text-[15px] font-medium">
              How this deck is one integer
            </h2>
            <button
              type="button"
              onClick={() => setInspect(false)}
              className="text-muted hover:text-ink cursor-pointer text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors focus-visible:outline-none"
            >
              close
            </button>
          </div>

          <PermutationInspector
            deck={deck}
            index={index}
            onHoverSlot={setHighlightSlot}
          />
        </Panel>
      </div>
    </main>
  );
}
