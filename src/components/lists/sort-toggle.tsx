"use client";

import { copy, type AppLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SortMode = "time" | "category";

type SortToggleProps = {
  value: SortMode;
  locale: AppLocale;
  onChange: (value: SortMode) => void;
};

export function SortToggle({ value, locale, onChange }: SortToggleProps) {
  const t = copy[locale];

  return (
    <div className="inline-flex rounded-full border border-olive/16 bg-white/70 p-1">
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium transition",
          value === "time"
            ? "bg-olive text-paper"
            : "text-ink/72 hover:bg-olive/10",
        )}
        onClick={() => onChange("time")}
      >
        {t.sortByTime}
      </button>
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium transition",
          value === "category"
            ? "bg-olive text-paper"
            : "text-ink/72 hover:bg-olive/10",
        )}
        onClick={() => onChange("category")}
      >
        {t.sortByCategory}
      </button>
    </div>
  );
}
