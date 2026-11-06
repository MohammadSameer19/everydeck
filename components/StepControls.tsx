"use client";

import { useState } from "react";

import { SoftButton, ToggleGroup } from "./ui";

import { formatScientific } from "@/lib/format";
import { LAYOUT_VIEWS, type LayoutView } from "@/lib/layouts";

/**
 * Navigation controls.
 *
 * Powers of ten, because in a 68-digit space "a bit more" and "a bit less"
 * are meaningless without them — and the step is itself a BigInt, so 10^48 is
 * as cheap to step by as 1.
 *
 * Flat hairline controls, not segmented pills: the chrome should read as a
 * printed control strip beside the deck, not as a floating instrument.
 */

const PRESET_EXPONENTS = [0, 1, 2, 3, 6, 12, 24, 48];

const VIEW_OPTIONS = LAYOUT_VIEWS.map((v) => ({
  value: v,
  label: v === "grid" ? "Grid" : v === "fan" ? "Fan" : "Piles",
  title: `Show the deck as ${v}`,
}));

interface StepControlsProps {
  onStep: (delta: bigint) => void;
  onRandom: () => void;
  onFirst: () => void;
  onLast: () => void;
  view: LayoutView;
  onViewChange: (view: LayoutView) => void;
}

export default function StepControls({
  onStep,
  onRandom,
  onFirst,
  onLast,
  view,
  onViewChange,
}: StepControlsProps) {
  const [exponent, setExponent] = useState(3);
  const step = 10n ** BigInt(exponent);

  const navButton =
    "h-7 w-7 cursor-pointer text-[12px] text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft focus-visible:text-accent focus-visible:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="divide-rule border-rule inline-flex divide-x border">
        <button
          type="button"
          className={navButton}
          onClick={onFirst}
          title="First arrangement"
          aria-label="First arrangement"
        >
          ⏮
        </button>
        <button
          type="button"
          className={navButton}
          onClick={() => onStep(-step)}
          title={`Back ${formatScientific(step)}`}
          aria-label="Step back"
        >
          −
        </button>
        <button
          type="button"
          className={navButton}
          onClick={() => onStep(step)}
          title={`Forward ${formatScientific(step)}`}
          aria-label="Step forward"
        >
          +
        </button>
        <button
          type="button"
          className={navButton}
          onClick={onLast}
          title="Last arrangement"
          aria-label="Last arrangement"
        >
          ⏭
        </button>
      </div>

      <label className="text-muted inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase">
        <span>step</span>
        <select
          value={exponent}
          onChange={(e) => setExponent(Number(e.target.value))}
          aria-label="Step size"
          className="border-rule text-ink focus:border-ink cursor-pointer border bg-transparent px-1.5 py-1 text-[10px] font-semibold tracking-[0.04em] [font-variant-numeric:tabular-nums] focus:outline-none"
        >
          {PRESET_EXPONENTS.map((e) => (
            <option key={e} value={e}>
              10^{e}
            </option>
          ))}
        </select>
      </label>

      <SoftButton
        onClick={onRandom}
        title="Generate a uniformly random ordering"
      >
        Random deck
      </SoftButton>

      <ToggleGroup
        value={view}
        options={VIEW_OPTIONS}
        onChange={onViewChange}
        title="Deck layout"
      />
    </div>
  );
}
