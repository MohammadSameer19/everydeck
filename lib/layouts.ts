/**
 * Deck layouts.
 *
 * Pure geometry: given a view name, return the on-screen transform for each
 * of the 52 card slots. No React, no DOM — which means the deck can be laid
 * out and reasoned about without rendering anything, and the same function
 * feeds both the static layout and the FLIP animation's "after" state.
 *
 * Everything is computed on a fixed logical canvas and scaled to fit by the
 * caller. That keeps these functions free of viewport measurement, and keeps
 * the maths honest: a layout is a set of numbers, not a set of pixels that
 * happen to be correct on one screen.
 *
 * The *shape* of a layout does depend on the space it is going into. A fan of
 * 52 cards on one arc is unreadable anywhere — 1440 / 52 is 27px per card
 * before any margin — so the fan splits into hands. The caller passes its
 * measured box; the builders only use it to choose a shape, never to compute
 * coordinates, so the geometry stays deterministic and testable.
 */

export type LayoutView = "grid" | "fan" | "piles";

export const LAYOUT_VIEWS: readonly LayoutView[] = ["grid", "fan", "piles"];

export const LAYOUT_LABELS: Record<LayoutView, string> = {
  grid: "Grid",
  fan: "Fan",
  piles: "Piles",
};

/**
 * Logical canvas width. The renderer scales this to whatever width it is
 * given; the height is derived from the layout's own bounds so no view
 * carries dead space.
 */
export const CANVAS_WIDTH = 1040;

/** Fallback height before a layout has been measured. */
export const CANVAS_HEIGHT = 500;

/** Card proportions are 2.5 x 3.5 inches, i.e. 5:7. */
export const CARD_WIDTH = 70;
export const CARD_HEIGHT = 98;

/** The box a layout is being fitted into, in CSS pixels. */
export interface DeckBox {
  width: number;
  height: number;
}

export const DEFAULT_BOX: DeckBox = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};

export interface Slot {
  x: number;
  y: number;
  rotate: number;
  /** Paint order. Higher paints on top. */
  z: number;
}

const DEG = 180 / Math.PI;

/** 13 x 4. The canonical order already groups suits, so suits read as rows. */
function grid(count: number): Slot[] {
  const cols = 13;
  const gapX = 6;
  const gapY = 10;

  const x0 = (CANVAS_WIDTH - (cols * CARD_WIDTH + (cols - 1) * gapX)) / 2;

  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: x0 + col * (CARD_WIDTH + gapX),
      y: row * (CARD_HEIGHT + gapY),
      rotate: 0,
      z: i,
    };
  });
}

// --- fan -------------------------------------------------------------------

interface FanConfig {
  rows: 2 | 4;
  /** Horizontal step between card origins. */
  pitch: number;
  /** Total angular spread across one hand, in degrees. */
  spread: number;
  /** Vertical gap between rows. */
  rowGap: number;
}

const FAN_TWO_HANDS: FanConfig = {
  rows: 2,
  pitch: 38,
  spread: 16,
  rowGap: 26,
};

const FAN_FOUR_ROWS: FanConfig = {
  rows: 4,
  pitch: 54,
  spread: 14,
  rowGap: 8,
};

/**
 * Least exposed card width, in screen pixels, at which a two-hand fan is
 * still readable. Below this the fan falls back to four rows: 26 cards per
 * hand cannot be made wider on a narrow screen, so the only way to keep the
 * rank and suit visible is to put fewer cards on each arc.
 */
export const MIN_FAN_PITCH = 36;

export interface FanPlan {
  rows: number;
  perRow: number;
  pitch: number;
  spread: number;
  radius: number;
  rowGap: number;
}

function fanPlanFor(config: FanConfig, count: number): FanPlan {
  const perRow = Math.ceil(count / config.rows);
  const span = Math.max(0, (perRow - 1) * config.pitch);
  const half = config.spread / 2 / DEG;
  const radius = half === 0 ? 0 : span / (2 * Math.sin(half));

  return {
    rows: config.rows,
    perRow,
    pitch: config.pitch,
    spread: config.spread,
    radius,
    rowGap: config.rowGap,
  };
}

/**
 * How many hands the fan should be split into.
 *
 * Two hands is the wanted look — a deck cut and spread. It is only used when
 * it actually puts at least {@link MIN_FAN_PITCH} pixels of each card on
 * screen; otherwise four rows of 13 are used so the faces stay readable.
 */
export function fanPlan(box: DeckBox, count: number): FanPlan {
  const two = fanPlanFor(FAN_TWO_HANDS, count);
  const twoBounds = boundsFor(fan(count, two));
  const scale = fitScale(box, twoBounds);

  if (two.pitch * scale >= MIN_FAN_PITCH) return two;
  return fanPlanFor(FAN_FOUR_ROWS, count);
}

/**
 * A hand of cards following an arc.
 *
 * The upper hand opens upward. With two rows the lower hand mirrors it, so
 * the two arcs face each other like a deck cut and spread on a table.
 */
function fan(count: number, plan: FanPlan): Slot[] {
  const cx = CANVAS_WIDTH / 2;
  const half = plan.spread / 2 / DEG;
  const rise = plan.radius * (1 - Math.cos(half));
  const rowHeight = CARD_HEIGHT + rise;
  const mirror = plan.rows === 2;

  return Array.from({ length: count }, (_, i) => {
    const row = Math.min(Math.floor(i / plan.perRow), plan.rows - 1);
    const rowStart = row * plan.perRow;
    const rowCount = Math.min(plan.perRow, count - rowStart);
    const within = i - rowStart;

    // -0.5 at the left edge of the hand, +0.5 at the right edge. A row with
    // one card sits flat rather than dividing by zero.
    const t = rowCount <= 1 ? 0 : within / (rowCount - 1) - 0.5;
    const angle = t * plan.spread;
    const rad = angle / DEG;

    const baseY = row * (rowHeight + plan.rowGap);
    const flipped = mirror && row === 1;

    return {
      x: cx + plan.radius * Math.sin(rad) - CARD_WIDTH / 2,
      // Cards follow the tangent of the arc; the lower hand is mirrored.
      y: baseY + (flipped ? 1 : -1) * plan.radius * (1 - Math.cos(rad)),
      rotate: flipped ? -angle : angle,
      z: i,
    };
  });
}

// --- piles -----------------------------------------------------------------

/**
 * How much of each buried card is left showing. The corner index is a 13px
 * rank above an 11px suit, starting ~5px down a 98px card: 30px in total.
 * At 11px the old peek sliced the rank in half; 31px clears the suit with a
 * pixel to spare.
 */
const PILE_PEEK = 31;

export interface PilePlan {
  columns: number;
  gap: number;
  peek: number;
}

/**
 * Piles are four columns of 13. On a narrow screen the columns have to move
 * closer together or the four of them cannot be scaled up enough to read.
 */
export function pilePlan(box: DeckBox): PilePlan {
  return {
    columns: 4,
    gap: box.width >= 700 ? 236 : 120,
    peek: PILE_PEEK,
  };
}

/** Dealt into four hands, each stacked with a readable peek and a little tilt. */
function piles(count: number, plan: PilePlan): Slot[] {
  const perPile = Math.ceil(count / plan.columns);
  const totalWidth = (plan.columns - 1) * plan.gap + CARD_WIDTH;

  return Array.from({ length: count }, (_, i) => {
    const pile = Math.floor(i / perPile);
    const within = i % perPile;

    return {
      x: (CANVAS_WIDTH - totalWidth) / 2 + pile * plan.gap,
      y: within * plan.peek + Math.abs(pile - 1.5) * 16,
      rotate: (pile - 1.5) * 3.2,
      z: i,
    };
  });
}

/** Slot transforms for a view. Always returns exactly `count` slots. */
export function layoutFor(
  view: LayoutView,
  count: number,
  box: DeckBox = DEFAULT_BOX
): Slot[] {
  switch (view) {
    case "grid":
      return grid(count);
    case "fan":
      return fan(count, fanPlan(box, count));
    case "piles":
      return piles(count, pilePlan(box));
  }
}

export interface Bounds {
  /** Offset to apply to the card layer so nothing renders off-canvas. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/** How much of the box a layout can use. */
function fitScale(box: DeckBox, bounds: Bounds): number {
  const byWidth = box.width > 0 ? box.width / bounds.width : 1;
  const byHeight = box.height > 0 ? box.height / bounds.height : Infinity;
  return Math.min(byWidth, byHeight);
}

/**
 * How much room a layout actually needs, and where it starts.
 *
 * Cards are rotated, so this uses each card's bounding box rather than its
 * top-left corner — otherwise the outermost cards of the fan clip the edge.
 *
 * The fan in particular produces *negative* coordinates (the centre card is
 * the origin, the outer cards rise above it), so the returned offset is not
 * cosmetic: without applying it, half the fan renders outside the canvas.
 */
export function boundsFor(slots: readonly Slot[], padding = 10): Bounds {
  if (slots.length === 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of slots) {
    const rad = s.rotate / DEG;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    // Bounding box of a rotated card, measured from its top-left corner.
    const overflowX = (CARD_WIDTH * cos + CARD_HEIGHT * sin - CARD_WIDTH) / 2;
    const overflowY = (CARD_WIDTH * sin + CARD_HEIGHT * cos - CARD_HEIGHT) / 2;

    minX = Math.min(minX, s.x - overflowX);
    minY = Math.min(minY, s.y - overflowY);
    maxX = Math.max(maxX, s.x + CARD_WIDTH + overflowX);
    maxY = Math.max(maxY, s.y + CARD_HEIGHT + overflowY);
  }

  return {
    // Shift the layout's minimum corner to +padding, so every card lands
    // inside the canvas regardless of how negative the raw coordinates are.
    offsetX: padding - minX,
    offsetY: padding - minY,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/** Short label for the view, for the toggle. */
export function layoutName(view: LayoutView): string {
  return LAYOUT_LABELS[view];
}
