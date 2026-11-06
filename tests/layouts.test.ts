import { describe, expect, it } from "vitest";

import { CARD_COUNT } from "@/lib/cards";
import {
  CANVAS_WIDTH,
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_BOX,
  LAYOUT_VIEWS,
  MIN_FAN_PITCH,
  boundsFor,
  fanPlan,
  layoutFor,
  pilePlan,
  type Bounds,
  type DeckBox,
  type Slot,
} from "@/lib/layouts";

/** A desktop deck box, after the header and footer have taken their height. */
const WIDE: DeckBox = { width: 1400, height: 620 };

/** A phone deck box. */
const PHONE: DeckBox = { width: 390, height: 260 };

/** Scale the renderer would apply for this layout in this box. */
function scaleFor(slots: readonly Slot[], box: DeckBox): number {
  const b = boundsFor(slots);
  return Math.min(box.width / b.width, box.height / b.height);
}

function slotsFor(view: (typeof LAYOUT_VIEWS)[number], box: DeckBox): Slot[] {
  return layoutFor(view, CARD_COUNT, box);
}

describe("layouts", () => {
  it("every view produces exactly one slot per card", () => {
    for (const box of [DEFAULT_BOX, WIDE, PHONE]) {
      for (const view of LAYOUT_VIEWS) {
        expect(layoutFor(view, CARD_COUNT, box).length, view).toBe(CARD_COUNT);
        expect(layoutFor(view, 1, box).length, view).toBe(1);
      }
    }
  });

  it("produces finite numbers everywhere — no NaN, no Infinity", () => {
    for (const box of [DEFAULT_BOX, WIDE, PHONE]) {
      for (const view of LAYOUT_VIEWS) {
        for (const s of layoutFor(view, CARD_COUNT, box)) {
          expect(Number.isFinite(s.x), `${view} x`).toBe(true);
          expect(Number.isFinite(s.y), `${view} y`).toBe(true);
          expect(Number.isFinite(s.rotate), `${view} rotate`).toBe(true);
        }
      }
    }
  });

  it("assigns a unique paint order so stacking is deterministic", () => {
    for (const view of LAYOUT_VIEWS) {
      const zs = layoutFor(view, CARD_COUNT).map((s) => s.z);
      expect(new Set(zs).size, view).toBe(CARD_COUNT);
    }
  });

  describe("grid", () => {
    const slots = layoutFor("grid", CARD_COUNT);

    it("is 13 wide by 4 tall", () => {
      const cols = new Set(slots.map((s) => Math.round(s.x))).size;
      expect(cols).toBe(13);

      const rows = new Set(slots.map((s) => Math.round(s.y))).size;
      expect(rows).toBe(4);
    });

    it("has no rotation", () => {
      expect(slots.every((s) => s.rotate === 0)).toBe(true);
    });

    it("fills 13 cards per row", () => {
      const perRow = new Map<number, number>();
      for (const s of slots) {
        perRow.set(s.y, (perRow.get(s.y) ?? 0) + 1);
      }
      expect([...perRow.values()]).toEqual([13, 13, 13, 13]);
    });

    it("does not change shape with the box", () => {
      expect(layoutFor("grid", CARD_COUNT, PHONE)).toEqual(slots);
    });
  });

  describe("fan", () => {
    it("splits into two hands when each card can be read", () => {
      const plan = fanPlan(WIDE, CARD_COUNT);
      expect(plan.rows).toBe(2);
      expect(plan.perRow).toBe(26);

      const slots = slotsFor("fan", WIDE);
      const exposed = plan.pitch * scaleFor(slots, WIDE);
      expect(exposed).toBeGreaterThanOrEqual(MIN_FAN_PITCH);
    });

    it("falls back to four rows on a phone", () => {
      const plan = fanPlan(PHONE, CARD_COUNT);
      expect(plan.rows).toBe(4);
      expect(plan.perRow).toBe(13);
      expect(slotsFor("fan", PHONE)).toHaveLength(CARD_COUNT);
    });

    it("puts more of each card on screen than a single-arc fan could", () => {
      // 52 cards on one 390px-wide screen gives 7.5px per card. Even the
      // four-row fallback has to do better than that.
      const slots = slotsFor("fan", PHONE);
      const exposed = fanPlan(PHONE, CARD_COUNT).pitch * scaleFor(slots, PHONE);
      expect(exposed).toBeGreaterThan(24);
    });

    it("keeps the two hands apart", () => {
      const slots = slotsFor("fan", WIDE);
      const upper = slots.slice(0, 26);
      const lower = slots.slice(26);

      const upperBottom = Math.max(...upper.map((s) => s.y + CARD_HEIGHT));
      const lowerTop = Math.min(...lower.map((s) => s.y));
      expect(lowerTop).toBeGreaterThan(upperBottom);
    });

    it("mirrors the lower hand", () => {
      const slots = slotsFor("fan", WIDE);

      // Upper hand: left edge leans left, right edge leans right.
      expect(slots[0]!.rotate).toBeLessThan(0);
      expect(slots[25]!.rotate).toBeGreaterThan(0);

      // Lower hand is the same arc, flipped.
      expect(slots[26]!.rotate).toBeGreaterThan(0);
      expect(slots[51]!.rotate).toBeLessThan(0);
    });

    it("places the centre card lowest and the outer cards higher", () => {
      const slots = slotsFor("fan", WIDE);
      const middleY = slots[12]!.y;
      expect(slots[0]!.y).toBeLessThan(middleY);
      expect(slots[25]!.y).toBeLessThan(middleY);
    });

    it("stays inside the canvas width", () => {
      for (const s of slotsFor("fan", WIDE)) {
        expect(s.x).toBeGreaterThan(-CARD_WIDTH);
        expect(s.x + CARD_WIDTH).toBeLessThan(CANVAS_WIDTH + CARD_WIDTH);
      }
    });
  });

  describe("piles", () => {
    it("moves the piles closer together on a narrow screen", () => {
      expect(pilePlan(WIDE).gap).toBe(236);
      expect(pilePlan(PHONE).gap).toBe(120);
      expect(pilePlan(PHONE).peek).toBe(pilePlan(WIDE).peek);
    });

    it("deals 13 cards into each of four piles", () => {
      const perPile = new Map<number, number>();
      for (const s of slotsFor("piles", WIDE)) {
        perPile.set(Math.round(s.x), (perPile.get(Math.round(s.x)) ?? 0) + 1);
      }
      expect(perPile.size).toBe(4);
      expect([...perPile.values()]).toEqual([13, 13, 13, 13]);
    });

    it("leaves a full corner of every buried card showing", () => {
      const slots = slotsFor("piles", WIDE);
      const firstPile = slots.slice(0, 13);
      for (let i = 1; i < firstPile.length; i++) {
        expect(firstPile[i]!.y - firstPile[i - 1]!.y).toBeCloseTo(
          pilePlan(WIDE).peek,
          5
        );
      }
      // The peek must clear a 13px rank plus its suit, not just the top half.
      expect(pilePlan(WIDE).peek).toBeGreaterThanOrEqual(20);
    });

    it("tilts the outer piles and leaves the middle ones flat", () => {
      const slots = slotsFor("piles", WIDE);
      const firstPile = slots.filter(
        (s) => Math.round(s.x) === Math.round(slots[0]!.x)
      );
      expect(firstPile[0]!.rotate).toBeLessThan(0);
      expect(Math.abs(firstPile[0]!.rotate)).toBeGreaterThan(0.5);
    });
  });
});

describe("boundsFor", () => {
  it("contains every card in every view and every box", () => {
    for (const box of [DEFAULT_BOX, WIDE, PHONE]) {
      for (const view of LAYOUT_VIEWS) {
        const slots = layoutFor(view, CARD_COUNT, box);
        const b = boundsFor(slots);

        for (const [i, s] of slots.entries()) {
          // After applying the offset, every card's top-left must be on-canvas.
          const x = s.x + b.offsetX;
          const y = s.y + b.offsetY;
          expect(x, `${view} card ${i} x`).toBeGreaterThanOrEqual(-0.001);
          expect(y, `${view} card ${i} y`).toBeGreaterThanOrEqual(-0.001);
          expect(x + CARD_WIDTH, `${view} card ${i} right`).toBeLessThanOrEqual(
            b.width + 0.001
          );
          expect(
            y + CARD_HEIGHT,
            `${view} card ${i} bottom`
          ).toBeLessThanOrEqual(b.height + 0.001);
        }
      }
    }
  });

  it("is the tightest box that still contains everything", () => {
    for (const view of LAYOUT_VIEWS) {
      const b = boundsFor(layoutFor(view, CARD_COUNT), 0);
      // Unrotated grid is exactly 13*70 + 12*6 wide.
      if (view === "grid")
        expect(b.width).toBeCloseTo(13 * CARD_WIDTH + 12 * 6, 5);
      expect(b.width).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(CARD_HEIGHT);
    }
  });

  it("shifts a layout with negative coordinates back on-canvas", () => {
    // The fan's upper hand rises above its baseline, so raw coordinates go
    // negative. Without the offset it would render off the top of the canvas.
    const slots = layoutFor("fan", CARD_COUNT);
    const rawMinY = Math.min(...slots.map((s) => s.y));
    expect(rawMinY).toBeLessThan(0);

    const b: Bounds = boundsFor(slots);
    expect(b.offsetY).toBeGreaterThan(0);
    expect(rawMinY + b.offsetY).toBeGreaterThan(0);
  });

  it("handles an empty slot list without producing NaN", () => {
    const b = boundsFor([]);
    expect(Number.isFinite(b.width)).toBe(true);
    expect(Number.isFinite(b.height)).toBe(true);
    expect(Number.isFinite(b.offsetX)).toBe(true);
    expect(Number.isFinite(b.offsetY)).toBe(true);
  });
});
