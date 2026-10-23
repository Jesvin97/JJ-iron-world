"use client";

import { useRef } from "react";

export const RATING_LABELS = ["", "Very poor", "Poor", "Average", "Good", "Excellent"] as const;

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-11 w-11 transition-transform duration-150 sm:h-12 sm:w-12" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9L12 2.5z"
        fill={filled ? "#b08a4e" : "#fff"}
        stroke={filled ? "#8a6a35" : "#6b564b"}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Accessible radio-group star picker: arrow keys move, Space/Enter select, labels are announced. */
export function StarRating({ value, onChange, name = "Rating" }: { value: number; onChange: (n: number) => void; name?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, n: number) {
    let next = n;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, n + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, n - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  }

  return (
    <div>
      <div role="radiogroup" aria-label={name} className="flex justify-center gap-1 sm:gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const checked = value === n;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${n} star${n > 1 ? "s" : ""} – ${RATING_LABELS[n]}`}
              tabIndex={checked || (value === 0 && n === 1) ? 0 : -1}
              onClick={() => onChange(n)}
              onKeyDown={(e) => onKey(e, n)}
              className="group rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
            >
              <span className="block group-hover:scale-110 group-active:scale-95">
                <Star filled={n <= value} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 h-6 text-center font-serif text-xl text-gold-dark" aria-live="polite">
        {value ? RATING_LABELS[value] : ""}
      </p>
    </div>
  );
}
