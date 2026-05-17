"use client";

import { useEffect, useRef, useState } from "react";

import {
  CATEGORY_SLUGS,
  categoryMeta,
  getCategoryDisplay,
  type CategorySlug,
} from "@/lib/categories";
import { copy, type AppLocale } from "@/lib/i18n";
import type { ListItemRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryChipProps = {
  item: Pick<ListItemRecord, "category" | "custom_category_label">;
  locale: AppLocale;
  onPick: (category: CategorySlug | null) => Promise<void> | void;
};

export function CategoryChip({ item, locale, onPick }: CategoryChipProps) {
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const display = getCategoryDisplay(item, t);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative mt-1.5 w-fit" ref={rootRef}>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition",
          display ? display.chipClass : "border border-olive/18 bg-paper text-ink/64",
        )}
      >
        {display ? display.label : t.pickCategory}
      </button>

      {open ? (
        <div
          className="absolute top-full z-30 mt-2 w-56 rounded-2xl border border-olive/14 bg-white p-2 shadow-[0_14px_32px_rgba(54,43,33,0.14)]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-2 pb-1 text-xs font-medium text-ink/56">{t.pickCategory}</p>
          <div className="space-y-1">
            {CATEGORY_SLUGS.map((slug) => {
              const labelKey = categoryMeta[slug].labelKey as keyof typeof t;
              return (
                <button
                  key={slug}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-start text-sm text-ink/82 transition hover:bg-olive/8"
                  onClick={async () => {
                    await onPick(slug);
                    setOpen(false);
                  }}
                >
                  <span>{t[labelKey]}</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      slug === "other" ? "border border-olive/26 bg-paper" : "bg-olive/30",
                    )}
                  />
                </button>
              );
            })}
            <button
              type="button"
              className="flex w-full rounded-xl px-2 py-2 text-start text-sm text-tomato transition hover:bg-tomato/8"
              onClick={async () => {
                await onPick(null);
                setOpen(false);
              }}
            >
              {t.clearCategory}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
