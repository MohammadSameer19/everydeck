import type { ReactNode } from "react";

/**
 * Shared surface primitives for the printed-specimen interface.
 *
 * No floating panels, no backdrop blur, no grey pills: a sheet of paper, a
 * hairline rule, and small-caps labels. The deck supplies the depth; the
 * chrome stays flat.
 */

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:outline-none";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "border-rule bg-raised pointer-events-auto border " + className
      }
    >
      {children}
    </div>
  );
}

/** A segmented control built from hairline-bordered cells. */
export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  title,
  className = "",
}: {
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (next: T) => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={"border-rule inline-flex border " + className}
      title={title}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={
              "border-rule cursor-pointer border-l px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors first:border-l-0 " +
              FOCUS +
              " " +
              (active ? "bg-ink text-paper" : "text-muted hover:text-ink")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A plain labelled button in the same family. */
export function SoftButton({
  children,
  onClick,
  title,
  className = "",
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={pressed}
      onClick={onClick}
      className={
        "border-rule cursor-pointer border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors " +
        FOCUS +
        " " +
        (pressed ? "text-ink" : "text-muted hover:border-ink hover:text-ink") +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

/**
 * An on/off control: a bordered button with a checkable box. The word keeps
 * the state legible; the border, hover surface, and tick make it read as a
 * control rather than a legend entry.
 */
export function BooleanToggle({
  value,
  onChange,
  label,
  title,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      title={title}
      className={
        "group inline-flex h-7 cursor-pointer items-center gap-2 border px-2 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors " +
        FOCUS +
        " " +
        (value
          ? "border-ink bg-raised text-ink"
          : "border-rule text-muted hover:border-muted hover:bg-raised hover:text-ink")
      }
    >
      <span
        aria-hidden="true"
        className={
          "flex h-3 w-3 shrink-0 items-center justify-center border transition-colors " +
          (value
            ? "border-accent bg-accent text-paper"
            : "border-rule group-hover:border-muted bg-transparent")
        }
      >
        {value ? (
          <svg
            viewBox="0 0 10 10"
            className="h-2 w-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M1.5 5.2 4 7.5 8.5 2.5" strokeLinecap="square" />
          </svg>
        ) : null}
      </span>
      {label}
    </button>
  );
}
