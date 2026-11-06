import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/layouts";

/**
 * A single playing card face.
 *
 * Purely presentational: it knows how a card looks, not where it is or which
 * index produced it. Positioning belongs to {@link DeckView}.
 *
 * ## The shadow rule
 *
 * Borrowed from card-UI work: *a shadow never interpolates.* The drop shadow
 * is a fixed plate underneath the card, and hovering only moves the card
 * upward off it. If the shadow also grew or blurred, the card would read as
 * a fading blob rather than a physical object being lifted — which is
 * exactly what happens with a naive `hover:shadow-lg`.
 */

/** Shared face styling. Black suits are warm ink, not pure black. */
function faceClass(isRed: boolean): string {
  return [
    "relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[6px]",
    "border bg-raised",
    "border-rule",
    // A contact shadow, not a float: the card sits on the paper.
    "shadow-[0_1px_0_rgba(27,25,23,0.05),0_2px_5px_-1px_rgba(27,25,23,0.16)]",
    "px-[6%] py-[5%]",
    isRed ? "text-accent" : "text-ink",
  ].join(" ");
}

function cornerClass(): string {
  return "flex flex-col items-center leading-none font-semibold [font-variant-numeric:tabular-nums]";
}

const RANKS = [
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
];
const SUIT_SYMBOL = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
} as const;
const SUIT_ORDER = ["spades", "hearts", "diamonds", "clubs"] as const;

type SuitName = (typeof SUIT_ORDER)[number];

export interface CardProps {
  cardId: number;
  /** Suppresses the centre pip on very small renders, where it is just noise. */
  compact?: boolean;
}

export default function Card({ cardId, compact = false }: CardProps) {
  const suit = SUIT_ORDER[Math.floor(cardId / 13)] as SuitName;
  const rank = RANKS[cardId % 13] as string;
  const symbol = SUIT_SYMBOL[suit];
  const isRed = suit === "hearts" || suit === "diamonds";

  return (
    <div className={faceClass(isRed)}>
      <div className={`${cornerClass()} text-[13px] leading-[1.08]`}>
        <span>{rank}</span>
        <span className="mt-[1px] text-[11px] leading-[1.08] opacity-90">
          {symbol}
        </span>
      </div>

      {!compact && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[38px] leading-none opacity-95">{symbol}</span>
        </div>
      )}

      <div className={`${cornerClass()} text-[13px] leading-[1.08]`}>
        <span>{rank}</span>
        <span className="mt-[1px] text-[11px] leading-[1.08] opacity-90">
          {symbol}
        </span>
      </div>
    </div>
  );
}

/** Intrinsic size, so callers do not re-derive it. */
export const CARD_BOX = { width: CARD_WIDTH, height: CARD_HEIGHT } as const;
