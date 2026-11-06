"use client";

import { useState } from "react";

import type { Deck } from "@/lib/cards";
import { deckToNotation } from "@/lib/notation";
import { buildShareUrl, type ViewName } from "@/lib/urlState";

/**
 * Copy a link to exactly what is on screen.
 *
 * The URL is rebuilt from state at click time rather than read from
 * `window.location`. The URL write is debounced, so a click immediately
 * after moving would otherwise copy a stale address — the link would open
 * on a different deck than the one you are looking at.
 */

type LinkForm = "deck" | "index";

function fallbackCopy(text: string): void {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

interface CopyLinkButtonProps {
  index: bigint;
  deck: Deck;
  view: ViewName;
}

export default function CopyLinkButton({
  index,
  deck,
  view,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<LinkForm>("deck");

  const copy = async () => {
    const url = buildShareUrl({
      origin: window.location.origin,
      pathname: window.location.pathname,
      index,
      deck,
      view,
      form,
    });

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      fallbackCopy(url);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="border-rule inline-flex border">
        {(["deck", "index"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setForm(f)}
            title={
              f === "deck"
                ? "Link the deck itself: ?deck=S2H3D4C5… (104 characters)"
                : "Link the numeric address: #123… (68 digits)"
            }
            className={
              "border-rule cursor-pointer border-l px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] uppercase transition-colors first:border-l-0 " +
              (form === f ? "bg-ink text-paper" : "text-muted hover:text-ink")
            }
          >
            {f === "deck" ? "deck" : "index"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={copy}
        title="Copy link to this deck"
        aria-label="Copy link to this deck"
        className="text-muted hover:border-rule hover:text-ink focus-visible:ring-accent/45 inline-flex h-6 w-6 shrink-0 items-center justify-center border border-transparent transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {copied ? (
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d="M3 8.5l3.2 3.2L13 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6.5 9.5 9.5 6.5" />
            <path d="M6.7 3.3 8 2c1.1-1.1 2.9-1.1 4 0s1.1 2.9 0 4l-1.3 1.3" />
            <path d="M9.3 12.7 8 14c-1.1 1.1-2.9 1.1-4 0s-1.1-2.9 0-4l1.3-1.3" />
          </svg>
        )}
      </button>
    </div>
  );
}
